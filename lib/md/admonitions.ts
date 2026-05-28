/**
 * Helpers for handling `[!type]` admonition callouts in raw Markdown,
 * independent of the TipTap editor extension in `lib/editor-admonition.ts`.
 *
 * Specifically: image-suggestion blocks emitted by the writing agent should
 * be visible while the user is writing (handled by the editor extension)
 * but stripped before publishing — with a count returned so the UI can warn
 * the user about any placeholders they forgot to fulfill.
 */

export type StripResult = {
  /** Markdown with image-suggestion admonitions removed. */
  stripped: string;
  /** How many image-suggestion blocks were found. */
  count: number;
};

// Accept the canonical English type (`image`) plus the Chinese aliases the
// editor extension also recognizes (`配图` / `图片` / `插图`).
const IMAGE_CALLOUT_LINE = /^>\s*\[!(image|配图|图片|插图)\]/i;

/**
 * Remove every `> [!image] ...` callout from the markdown source.
 *
 * A callout is detected as any contiguous block of blockquote lines (starting
 * with `>`) whose first line matches `[!image]`. Continuation blockquote
 * lines (multi-line image descriptions) are stripped together with the
 * marker line, including the trailing blank line if present.
 */
export function stripImageAdmonitions(markdown: string): StripResult {
  if (!markdown) return { stripped: "", count: 0 };

  const lines = markdown.split("\n");
  const out: string[] = [];
  let count = 0;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (IMAGE_CALLOUT_LINE.test(line)) {
      count++;
      i++;
      // Swallow any continuation blockquote lines that belong to this callout.
      while (i < lines.length && /^>/.test(lines[i])) {
        i++;
      }
      // Also collapse one trailing blank line so we don't leave a double-gap.
      if (i < lines.length && lines[i].trim() === "") {
        i++;
      }
      continue;
    }
    out.push(line);
    i++;
  }

  return { stripped: out.join("\n").replace(/\n{3,}/g, "\n\n"), count };
}

/** Convenience: just count without producing a stripped copy. */
export function countImageAdmonitions(markdown: string): number {
  return stripImageAdmonitions(markdown).count;
}
