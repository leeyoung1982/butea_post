"use client";

import {
  loadSettings,
  resolveImageKey,
  resolveImageModel,
  resolveImageBaseUrl,
  resolveImageFormat,
} from "./providers";
import { saveMedia, mediaIdToMarkdownUrl } from "@/lib/media/store";

export type ImageSize = "1024x1024" | "1024x1792" | "1792x1024";
export type ImageStyle = "natural" | "vivid";
export type ImageQuality = "standard" | "hd";

export class MissingImageKeyError extends Error {
  constructor() {
    super("尚未配置图片生成 API Key — 请在 AI 设置里填入 OpenAI key");
    this.name = "MissingImageKeyError";
  }
}

export type GenerateImageRequest = {
  prompt: string;
  size?: ImageSize;
  style?: ImageStyle;
  quality?: ImageQuality;
  n?: 1 | 2 | 3 | 4;
};

export type GenerateImageResult = {
  /** base64-encoded image (no `data:` prefix) */
  b64: string;
  /** the actual prompt OpenAI used (DALL-E 3 rewrites it; useful for transparency) */
  revisedPrompt?: string;
};

export async function generateImage(
  req: GenerateImageRequest,
  signal?: AbortSignal
): Promise<GenerateImageResult[]> {
  const settings = loadSettings();
  const key = resolveImageKey(settings);
  if (!key) throw new MissingImageKeyError();
  const model = resolveImageModel(settings);
  const baseUrl = resolveImageBaseUrl(settings);
  const format = resolveImageFormat(settings);

  const res = await fetch("/api/image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      apiKey: key,
      baseUrl,
      model,
      format,
      prompt: req.prompt,
      size: req.size ?? "1024x1024",
      style: req.style ?? "vivid",
      quality: req.quality ?? "standard",
      n: req.n ?? 1,
    }),
    signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Image gen failed: ${res.status}`);
  }
  const data = (await res.json()) as { images: GenerateImageResult[] };
  return data.images;
}

/**
 * Save a generated/uploaded image to the local media library and return a
 * compact Markdown `![alt](butea-media://<id>)` reference. The renderer
 * will resolve that reference to a blob URL at preview time.
 *
 * Accepts either a base64 string (from OpenAI's image API) or a Blob/File
 * (from local upload / drag-drop).
 */
export async function imageMarkdown(
  source: string | Blob,
  alt = "image"
): Promise<string> {
  let blob: Blob;
  let name = alt;
  if (typeof source === "string") {
    blob = base64ToBlob(source, "image/png");
    name = (alt || "image") + ".png";
  } else {
    blob = source;
    name = source instanceof File ? source.name : (alt || "image");
  }
  const record = await saveMedia(blob, name);
  const safeAlt = alt.replace(/[\[\]]/g, "");
  return `![${safeAlt}](${mediaIdToMarkdownUrl(record.id)})`;
}

function base64ToBlob(b64: string, mime: string): Blob {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}
