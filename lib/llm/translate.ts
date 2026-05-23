"use client";

import type { PlatformId } from "@/lib/adapters/types";
import { getTranslationPrompt, type TranslationContext } from "./translations";
import { streamChat } from "./client";
import { loadSettings, type LLMSettings } from "./providers";

export type TranslateProgress = (chunk: string, accumulated: string) => void;

export class MissingLLMKeyError extends Error {
  constructor() {
    super("尚未配置 LLM Provider — 请在 AI 写作助手里填入 API key");
    this.name = "MissingLLMKeyError";
  }
}

/**
 * Run an AI translation for the given platform on the given canonical draft.
 * Streams progress (token by token) via `onProgress` and resolves with the
 * complete translated markdown.
 *
 * The LLM key is read from localStorage (BYOK). Throws `MissingLLMKeyError`
 * if not configured.
 */
export async function translateForPlatform(
  platformId: PlatformId,
  ctx: TranslationContext,
  onProgress?: TranslateProgress,
  signal?: AbortSignal
): Promise<string> {
  const settings: LLMSettings | null = loadSettings();
  if (!settings?.apiKey) {
    throw new MissingLLMKeyError();
  }

  const prompt = getTranslationPrompt(platformId);
  const stream = streamChat(
    settings,
    [
      { role: "system", content: prompt.system },
      { role: "user", content: prompt.buildUser(ctx) },
    ],
    signal
  );

  let acc = "";
  for await (const chunk of stream) {
    acc += chunk;
    onProgress?.(chunk, acc);
  }
  return stripCodeFence(acc.trim());
}

/**
 * Some models wrap the entire output in ```markdown ... ``` even when told
 * not to. Strip it.
 */
function stripCodeFence(s: string): string {
  const m = /^```(?:markdown|md)?\n([\s\S]*?)\n```\s*$/.exec(s);
  if (m) return m[1];
  return s;
}

/**
 * Cheap, non-cryptographic hash for invalidating stale translations. djb2.
 */
export function hashMarkdown(md: string): string {
  let h = 5381;
  for (let i = 0; i < md.length; i++) {
    h = ((h << 5) + h + md.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}
