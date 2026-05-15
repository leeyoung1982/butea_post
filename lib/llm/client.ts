"use client";

import type { LLMSettings } from "./providers";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export async function* streamChat(
  settings: LLMSettings,
  messages: ChatMessage[],
  signal?: AbortSignal
): AsyncGenerator<string, void, unknown> {
  const res = await fetch("/api/llm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...settings, messages }),
    signal,
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `LLM request failed: ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  const isAnthropic = settings.providerId === "anthropic";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });

    let nl: number;
    while ((nl = buf.indexOf("\n")) !== -1) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (data === "[DONE]") return;

      try {
        const j = JSON.parse(data);
        if (isAnthropic) {
          // event types: content_block_delta -> delta.text
          if (j.type === "content_block_delta" && j.delta?.type === "text_delta") {
            yield j.delta.text as string;
          } else if (j.type === "message_stop") {
            return;
          }
        } else {
          const piece = j.choices?.[0]?.delta?.content;
          if (typeof piece === "string") yield piece;
        }
      } catch {
        // skip malformed lines
      }
    }
  }
}
