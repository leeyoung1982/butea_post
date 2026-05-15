"use client";

import { Extension, Mark } from "@tiptap/core";

/**
 * Custom TipTap extensions for the text-styling toolbar (color, font size,
 * line height, alignment). Color, TextStyle, TextAlign are official TipTap
 * extensions; FontSize and LineHeight are project-local because TipTap 3
 * doesn't ship them.
 *
 * All styles serialize as inline `style="..."` attributes on a `<span>` or
 * the block element — so they round-trip through tiptap-markdown's `html:
 * true` parser and survive into the rendered HTML for previews / publishing.
 */

// =====================================================================
// FontSize — a separate mark with its own span. Could be folded into
// TextStyle but keeping it standalone makes serialization simpler.
// =====================================================================

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    fontSize: {
      setFontSize: (size: string) => ReturnType;
      unsetFontSize: () => ReturnType;
    };
    lineHeight: {
      setLineHeight: (value: string) => ReturnType;
      unsetLineHeight: () => ReturnType;
    };
  }
}

export const FontSize = Mark.create({
  name: "fontSize",

  addAttributes() {
    return {
      size: {
        default: null as string | null,
        parseHTML: (el: HTMLElement) => el.style.fontSize || null,
        renderHTML: (attrs: { size?: string | null }) =>
          attrs.size ? { style: `font-size: ${attrs.size}` } : {},
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "span[style*='font-size']",
        getAttrs: (el) => {
          const fs = (el as HTMLElement).style.fontSize;
          return fs ? { size: fs } : false;
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", HTMLAttributes, 0];
  },

  addCommands() {
    return {
      setFontSize:
        (size: string) =>
        ({ chain }) =>
          chain().setMark(this.name, { size }).run(),
      unsetFontSize:
        () =>
        ({ chain }) =>
          chain().unsetMark(this.name).run(),
    };
  },
});

// =====================================================================
// LineHeight — block-level extension that adds a line-height attribute
// to paragraphs and headings.
// =====================================================================

export const LineHeight = Extension.create({
  name: "lineHeight",

  addGlobalAttributes() {
    return [
      {
        types: ["paragraph", "heading"],
        attributes: {
          lineHeight: {
            default: null as string | null,
            parseHTML: (el: HTMLElement) => el.style.lineHeight || null,
            renderHTML: (attrs: { lineHeight?: string | null }) =>
              attrs.lineHeight
                ? { style: `line-height: ${attrs.lineHeight}` }
                : {},
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setLineHeight:
        (value: string) =>
        ({ commands }) => {
          return (
            commands.updateAttributes("paragraph", { lineHeight: value }) ||
            commands.updateAttributes("heading", { lineHeight: value })
          );
        },
      unsetLineHeight:
        () =>
        ({ commands }) => {
          return (
            commands.resetAttributes("paragraph", "lineHeight") ||
            commands.resetAttributes("heading", "lineHeight")
          );
        },
    };
  },
});

// =====================================================================
// Preset values for the toolbar dropdowns
// =====================================================================

export const FONT_SIZE_PRESETS = [
  { label: "极小", value: "12px" },
  { label: "小", value: "14px" },
  { label: "默认", value: null }, // clears the mark
  { label: "中", value: "18px" },
  { label: "大", value: "22px" },
  { label: "特大", value: "28px" },
  { label: "标题", value: "36px" },
];

export const LINE_HEIGHT_PRESETS = [
  { label: "紧凑", value: "1.3" },
  { label: "标准", value: null }, // clears
  { label: "舒适", value: "1.8" },
  { label: "宽松", value: "2.2" },
];

export const COLOR_PRESETS = [
  // First row: neutrals
  { label: "默认", value: null },
  { label: "黑", value: "#111111" },
  { label: "深灰", value: "#444444" },
  { label: "灰", value: "#888888" },
  { label: "浅灰", value: "#BBBBBB" },
  // Second row: accents (the Butea palette + common publishing colors)
  { label: "橙", value: "#EA580C" },
  { label: "红", value: "#DC2626" },
  { label: "黄", value: "#EAB308" },
  { label: "绿", value: "#16A34A" },
  { label: "青", value: "#0891B2" },
  { label: "蓝", value: "#2563EB" },
  { label: "紫", value: "#7C3AED" },
  { label: "粉", value: "#DB2777" },
];
