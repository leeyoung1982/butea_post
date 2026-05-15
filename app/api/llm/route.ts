import type { NextRequest } from "next/server";

export const runtime = "edge";

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

type Payload = {
  providerId: "openai" | "anthropic" | "deepseek" | "custom";
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  temperature?: number;
};

/**
 * Server-side proxy to LLM providers. We forward the user's own API key —
 * the key is stored in the browser and POSTed here on every call. This avoids
 * exposing it via `Origin`-bound CORS while still letting the user own their
 * credentials.
 *
 * Returns a streaming response that the client can consume as text/event-stream
 * (for OpenAI-compatible) or as the Anthropic stream format.
 */
export async function POST(req: NextRequest) {
  let body: Payload;
  try {
    body = (await req.json()) as Payload;
  } catch {
    return new Response("invalid json", { status: 400 });
  }

  if (!body.apiKey) {
    return new Response("missing apiKey", { status: 400 });
  }

  if (body.providerId === "anthropic") {
    return forwardAnthropic(body);
  }
  return forwardOpenAICompatible(body);
}

async function forwardOpenAICompatible(p: Payload): Promise<Response> {
  const url = `${p.baseUrl.replace(/\/$/, "")}/chat/completions`;
  const upstream = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${p.apiKey}`,
    },
    body: JSON.stringify({
      model: p.model,
      messages: p.messages,
      stream: true,
      temperature: p.temperature ?? 0.7,
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text().catch(() => "");
    return new Response(text || "upstream error", { status: upstream.status });
  }

  // Pass through SSE; the client parses `data: {choices:[{delta:{content}}]}`
  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}

async function forwardAnthropic(p: Payload): Promise<Response> {
  // Split out the optional system message; Anthropic expects it as a top-level
  // field, not a role in messages.
  const system = p.messages.find((m) => m.role === "system")?.content;
  const messages = p.messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role, content: m.content }));

  const url = `${p.baseUrl.replace(/\/$/, "")}/messages`;
  const upstream = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": p.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: p.model,
      max_tokens: 4096,
      stream: true,
      system,
      messages,
      temperature: p.temperature ?? 0.7,
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text().catch(() => "");
    return new Response(text || "upstream error", { status: upstream.status });
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
