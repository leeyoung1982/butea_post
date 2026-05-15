import type { NextRequest } from "next/server";

export const runtime = "edge";

type Payload = {
  apiKey: string;
  baseUrl: string;
  model: string;
  /** Wire format. Defaults to `openai` for backward compat. */
  format?: "openai" | "fal";
  prompt: string;
  size: string;
  style?: string;
  quality?: string;
  n?: number;
};

type ImageOut = { b64: string; revisedPrompt?: string };

/**
 * Image generation proxy. BYOK — the user's key is forwarded, not stored.
 *
 * Supports two upstream wire formats:
 *   - `openai`: standard OpenAI Images API (DALL-E 3, gpt-image-1) AND any
 *     OpenAI-compatible gateway. Returns b64_json directly.
 *   - `fal`:    fal.ai's native API. Model name is in the URL path; the
 *     response gives image URLs which we fetch + base64-encode so the
 *     downstream client doesn't need to know the difference.
 */
export async function POST(req: NextRequest) {
  let body: Payload;
  try {
    body = (await req.json()) as Payload;
  } catch {
    return new Response("invalid json", { status: 400 });
  }
  if (!body.apiKey) return new Response("missing apiKey", { status: 400 });
  if (!body.prompt) return new Response("missing prompt", { status: 400 });

  try {
    const images =
      body.format === "fal"
        ? await callFal(body)
        : await callOpenAI(body);
    return Response.json({ images });
  } catch (e) {
    const msg = (e as Error).message;
    return new Response(msg || "upstream error", { status: 502 });
  }
}

// ====================================================================
// OpenAI (and OpenAI-compatible)
// ====================================================================

async function callOpenAI(body: Payload): Promise<ImageOut[]> {
  const url = `${body.baseUrl.replace(/\/$/, "")}/images/generations`;

  // DALL-E 3 vs gpt-image-1 have slightly different params. We send a
  // common superset; OpenAI ignores unknown fields per model.
  const requestBody: Record<string, unknown> = {
    model: body.model,
    prompt: body.prompt,
    size: body.size,
    n: body.n ?? 1,
  };
  if (body.model === "dall-e-3") {
    requestBody.response_format = "b64_json";
    requestBody.style = body.style;
    requestBody.quality = body.quality;
  } else {
    // gpt-image-1 returns b64_json by default
    requestBody.output_format = "png";
  }

  const upstream = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${body.apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!upstream.ok) {
    const text = await upstream.text().catch(() => "");
    throw new Error(`OpenAI ${upstream.status}: ${text || upstream.statusText}`);
  }

  const data = (await upstream.json()) as {
    data?: Array<{ b64_json?: string; revised_prompt?: string }>;
  };
  return (
    data.data?.map((d) => ({
      b64: d.b64_json ?? "",
      revisedPrompt: d.revised_prompt,
    })) ?? []
  );
}

// ====================================================================
// fal.ai
// ====================================================================

type FalSize =
  | "square_hd"
  | "square"
  | "portrait_4_3"
  | "portrait_16_9"
  | "landscape_4_3"
  | "landscape_16_9"
  | { width: number; height: number };

async function callFal(body: Payload): Promise<ImageOut[]> {
  // Model path lives in the URL (e.g. /openai/gpt-image-2).
  const modelPath = body.model.replace(/^\/+|\/+$/g, "");
  const url = `${body.baseUrl.replace(/\/$/, "")}/${modelPath}`;

  const requestBody: Record<string, unknown> = {
    prompt: body.prompt,
    image_size: toFalSize(body.size),
    num_images: body.n ?? 1,
    output_format: "png",
  };
  // fal.ai's GPT Image 2 accepts a "quality" field with values low/medium/high.
  // We map OpenAI's standard/hd → medium/high for compatibility.
  if (body.quality) {
    requestBody.quality =
      body.quality === "hd" ? "high" : body.quality === "standard" ? "medium" : body.quality;
  }

  const upstream = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // fal.ai uses `Key` scheme, NOT `Bearer`
      Authorization: `Key ${body.apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!upstream.ok) {
    const text = await upstream.text().catch(() => "");
    throw new Error(`fal.ai ${upstream.status}: ${text || upstream.statusText}`);
  }

  const data = (await upstream.json()) as {
    images?: Array<{ url: string; content_type?: string }>;
  };
  const urls = data.images?.map((i) => i.url).filter(Boolean) ?? [];
  if (urls.length === 0) {
    throw new Error("fal.ai 返回中没有 image URL");
  }

  // Fetch each image and base64-encode so the client gets the same shape
  // it would from OpenAI. Done in parallel.
  const out = await Promise.all(
    urls.map(async (u) => {
      const res = await fetch(u);
      if (!res.ok) throw new Error(`下载 fal 图片失败: ${res.status}`);
      const buf = new Uint8Array(await res.arrayBuffer());
      return { b64: toBase64(buf) };
    })
  );
  return out;
}

/** Map OpenAI "WxH" string to fal's named/object sizes. */
function toFalSize(s: string): FalSize {
  switch (s) {
    case "1024x1024":
      return "square_hd";
    case "1792x1024":
      return "landscape_16_9";
    case "1024x1792":
      return "portrait_16_9";
    default: {
      const m = /^(\d+)x(\d+)$/.exec(s);
      if (m) return { width: Number(m[1]), height: Number(m[2]) };
      return "square_hd";
    }
  }
}

/** btoa-equivalent for Uint8Array in edge runtime (no Buffer). */
function toBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
