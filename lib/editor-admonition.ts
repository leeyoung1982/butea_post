"use client";

import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

/**
 * TipTap extension that detects `> [!type] Title` callout syntax inside
 * blockquote nodes and:
 *   1. Adds CSS class decoration on the blockquote for styling
 *   2. Hides the `[!type] ` token via inline decoration
 *   3. Inserts an emoji widget before the hidden token
 *   Title row separation is handled purely via CSS (> p:first-child).
 */

export const ADMONITION_TYPES = [
  { type: "note", label: "Note", icon: "\u{1F4DD}" },
  { type: "info", label: "Info", icon: "\u2139\uFE0F" },
  { type: "tip", label: "Tip", icon: "\u{1F4A1}" },
  { type: "warning", label: "Warning", icon: "\u26A0\uFE0F" },
  { type: "danger", label: "Danger", icon: "\u{1F6D1}" },
  { type: "quote", label: "Quote", icon: "\u275D" },
  // image-suggestion placeholder emitted by the writing agent. Stands out
  // visually (pink/rose) so users can't miss it; stripped from publish
  // output by lib/md/admonitions.ts with a count-based warning banner.
  { type: "image", label: "\u914D\u56FE\u5EFA\u8BAE", icon: "\u{1F4F8}" },
] as const;

export type AdmonitionType = (typeof ADMONITION_TYPES)[number]["type"];

// Accept both English type ids (`image`) and Chinese names (`配图`) — Chinese
// LLMs reliably emit Chinese tags but often refuse to switch to obscure
// English types like `[!image]`.
const CALLOUT_RE = /^\[!([\p{L}\w_-]+)\]\s*/u;

/** Maps Chinese / alternate tag names to the canonical English type id. */
const TYPE_ALIASES: Record<string, AdmonitionType> = {
  配图: "image",
  图片: "image",
  插图: "image",
  提示: "tip",
  注意: "warning",
  警告: "warning",
  危险: "danger",
  引用: "quote",
  笔记: "note",
  信息: "info",
};

const pluginKey = new PluginKey("admonitionDecoration");

function getAdmonitionMeta(kind: string) {
  const normalized = TYPE_ALIASES[kind] ?? kind.toLowerCase();
  return (
    ADMONITION_TYPES.find((a) => a.type === normalized) ?? ADMONITION_TYPES[0]
  );
}

export const AdmonitionDecoration = Extension.create({
  name: "admonitionDecoration",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: pluginKey,
        props: {
          decorations(state) {
            const decorations: Decoration[] = [];
            state.doc.descendants((node, pos) => {
              if (node.type.name !== "blockquote") return;
              const firstChild = node.firstChild;
              if (!firstChild || firstChild.type.name !== "paragraph") return;
              const text = firstChild.textContent;
              const m = CALLOUT_RE.exec(text);
              if (!m) return;
              const kind = m[1].toLowerCase();
              const meta = getAdmonitionMeta(kind);
              const hasBody = node.childCount > 1;

              // 1. Style the blockquote container
              decorations.push(
                Decoration.node(pos, pos + node.nodeSize, {
                  class: `admonition admonition-${kind}${hasBody ? " admonition-has-body" : ""}`,
                  "data-admonition": kind,
                })
              );

              // 2. Find the actual text start position inside the first paragraph.
              //    Walk the paragraph's children to find where the token text begins.
              const paraPos = pos + 1; // blockquote open
              let textStart = paraPos + 1; // paragraph open

              // 3. Hide [!type] token text
              const tokenEnd = textStart + m[0].length;
              decorations.push(
                Decoration.inline(textStart, tokenEnd, {
                  class: "admonition-token-hidden",
                })
              );

              // 4. Emoji + label widget
              decorations.push(
                Decoration.widget(
                  textStart,
                  () => {
                    const span = document.createElement("span");
                    span.className = "admonition-badge";
                    span.textContent = `${meta.icon} ${meta.label}`;
                    span.contentEditable = "false";
                    return span;
                  },
                  { side: -1 }
                )
              );
            });
            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },
});

/**
 * CSS for admonition styling inside the editor.
 * Title row separation is done via CSS child selectors — no node decoration needed.
 */
export function admonitionEditorCss(root: string): string {
  return `
${root} .admonition {
  border-left: 4px solid #888;
  border-radius: 0 6px 6px 0;
  padding: 12px 16px;
  margin: 1em 0;
}
${root} .admonition-token-hidden {
  font-size: 0 !important;
  letter-spacing: 0 !important;
  width: 0;
  overflow: hidden;
  display: inline-block;
  vertical-align: baseline;
  color: transparent !important;
}
${root} .admonition-badge {
  display: inline;
  font-weight: 700;
  font-size: 0.85em;
  letter-spacing: 0.04em;
  margin-right: 6px;
  user-select: none;
}
/* Title row = first paragraph inside the admonition */
${root} .admonition-has-body > p:first-child {
  font-weight: 700;
  font-size: 0.95em;
  padding-bottom: 6px;
  margin-bottom: 4px;
  border-bottom: 1px solid rgba(0,0,0,0.08);
}

/* --- Per-type colors --- */
${root} .admonition-note { background: #f5f5f5; border-left-color: #888; }
${root} .admonition-note .admonition-badge { color: #666; }
${root} .admonition-note.admonition-has-body > p:first-child { border-bottom-color: rgba(0,0,0,0.08); }

${root} .admonition-info { background: #eff6ff; border-left-color: #3b82f6; }
${root} .admonition-info .admonition-badge { color: #3b82f6; }
${root} .admonition-info.admonition-has-body > p:first-child { border-bottom-color: rgba(59,130,246,0.2); }

${root} .admonition-tip { background: #f0fdf4; border-left-color: #22c55e; }
${root} .admonition-tip .admonition-badge { color: #22c55e; }
${root} .admonition-tip.admonition-has-body > p:first-child { border-bottom-color: rgba(34,197,94,0.2); }

${root} .admonition-warning { background: #fffbeb; border-left-color: #f59e0b; }
${root} .admonition-warning .admonition-badge { color: #f59e0b; }
${root} .admonition-warning.admonition-has-body > p:first-child { border-bottom-color: rgba(245,158,11,0.2); }

${root} .admonition-danger { background: #fef2f2; border-left-color: #ef4444; }
${root} .admonition-danger .admonition-badge { color: #ef4444; }
${root} .admonition-danger.admonition-has-body > p:first-child { border-bottom-color: rgba(239,68,68,0.2); }

${root} .admonition-quote { background: #fafafa; border-left-color: #a78bfa; }
${root} .admonition-quote .admonition-badge { color: #a78bfa; }
${root} .admonition-quote.admonition-has-body > p:first-child { border-bottom-color: rgba(167,139,250,0.2); }

/* Image-suggestion: rose/pink, dashed border to signal "placeholder, not real
 * content". The badge is promoted to a block-level header (instead of inline)
 * so "配图建议" reads as a clear caption above the description, not a tiny
 * inline prefix. */
${root} .admonition-image {
  background: #fdf2f8;
  border-left: 4px dashed #ec4899;
}
${root} .admonition-image .admonition-badge {
  display: block;
  color: #be185d;
  font-size: 0.85em;
  font-weight: 700;
  letter-spacing: 0.06em;
  margin-bottom: 6px;
  padding-bottom: 4px;
  border-bottom: 1px dashed rgba(236, 72, 153, 0.35);
}
${root} .admonition-image.admonition-has-body > p:first-child { border-bottom-color: rgba(236,72,153,0.2); }
`;
}
