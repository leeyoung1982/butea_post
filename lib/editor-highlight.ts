"use client";

import { Mark } from "@tiptap/core";

/**
 * Half-height highlight mark — renders as a colored band covering the
 * bottom ~35% of the text line, like a marker pen effect.
 *
 * CSS: `background: linear-gradient(transparent 60%, <color> 60%)`
 *
 * Serializes as `<mark style="background:...">` so it round-trips through
 * tiptap-markdown's `html: true` mode.
 */

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    halfHighlight: {
      setHalfHighlight: (color?: string) => ReturnType;
      unsetHalfHighlight: () => ReturnType;
      toggleHalfHighlight: (color?: string) => ReturnType;
    };
  }
}

export const DEFAULT_HIGHLIGHT_COLOR = "#FFE066";

export const HIGHLIGHT_COLORS = [
  { label: "黄", value: "#FFE066" },
  { label: "绿", value: "#B5F5C8" },
  { label: "蓝", value: "#BAE6FD" },
  { label: "粉", value: "#FBCFE8" },
  { label: "橙", value: "#FED7AA" },
  { label: "紫", value: "#DDD6FE" },
  { label: "红", value: "#FECACA" },
];

function buildGradient(color: string): string {
  return `linear-gradient(transparent 60%, ${color} 60%)`;
}

export const HalfHighlight = Mark.create({
  name: "halfHighlight",

  addAttributes() {
    return {
      color: {
        default: DEFAULT_HIGHLIGHT_COLOR,
        parseHTML: (el: HTMLElement) => {
          // Extract color from gradient string
          const bg = el.style.background || el.style.backgroundImage || "";
          const m = bg.match(/linear-gradient\(transparent\s+\d+%,\s*([^)]+?)\s+\d+%\)/);
          return m ? m[1].trim() : DEFAULT_HIGHLIGHT_COLOR;
        },
        renderHTML: (attrs: { color?: string }) => ({
          style: `background: ${buildGradient(attrs.color ?? DEFAULT_HIGHLIGHT_COLOR)}`,
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "mark",
        getAttrs: (el) => {
          const bg = (el as HTMLElement).style.background || "";
          if (bg.includes("linear-gradient")) return {};
          return false;
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ["mark", HTMLAttributes, 0];
  },

  addCommands() {
    return {
      setHalfHighlight:
        (color?: string) =>
        ({ chain }) =>
          chain()
            .setMark(this.name, { color: color ?? DEFAULT_HIGHLIGHT_COLOR })
            .run(),
      unsetHalfHighlight:
        () =>
        ({ chain }) =>
          chain().unsetMark(this.name).run(),
      toggleHalfHighlight:
        (color?: string) =>
        ({ chain }) =>
          chain()
            .toggleMark(this.name, { color: color ?? DEFAULT_HIGHLIGHT_COLOR })
            .run(),
    };
  },
});
