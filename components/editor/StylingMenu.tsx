"use client";

import * as React from "react";
import * as Popover from "@radix-ui/react-popover";
import {
  Type,
  ChevronDown,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
} from "lucide-react";
import {
  getTipTapEditor,
  getEditorView,
  activeMode,
} from "@/lib/editor-ref";
import {
  FONT_SIZE_PRESETS,
  LINE_HEIGHT_PRESETS,
  COLOR_PRESETS,
} from "@/lib/editor-text-style";

/**
 * Text-styling dropdown — color / font size / line height / alignment.
 *
 * Used in BOTH editor toolbars. Detects the active editor at click time:
 *   - Visual (TipTap): calls the appropriate chain command
 *   - MD (CodeMirror): wraps the selection in `<span style="...">` or
 *     `<div style="...">` so the same effect renders in the preview
 *
 * Platform compatibility:
 *   - WeChat / Blog / X long-form: all styles render (inline CSS preserved
 *     through juice)
 *   - Short-form adapters (小红书 / X Thread / 微博 / 朋友圈): produce
 *     text-based outputs; styles naturally don't apply — same as preview
 *     showing native rendering
 */
export function StylingMenu() {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="flex items-center gap-1 px-1.5 py-1 rounded text-xs transition-colors text-app-fg-muted hover:text-app-fg hover:bg-app-surface-hover whitespace-nowrap"
          title="文字样式:颜色 / 字号 / 行高 / 对齐"
          onMouseDown={(e) => e.preventDefault()}
        >
          <Type size={12} />
          <span className="hidden md:inline">样式</span>
          <ChevronDown size={10} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          className="z-50 w-[300px] bg-app-surface border border-app-border rounded-lg shadow-xl p-3 animate-fade-in space-y-3"
        >
          <ColorSection />
          <FontSizeSection />
          <LineHeightSection />
          <AlignSection />
          <p className="text-[10px] text-app-fg-subtle leading-snug pt-1 border-t border-app-border">
            样式在公众号 / 博客 / X Long-form 中保留;短文平台(小红书 / Thread /
            微博 / 朋友圈)按各自原生纯文本呈现。
          </p>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

// =====================================================================
// Sections
// =====================================================================

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-app-fg-subtle mb-1.5">
        {title}
      </div>
      {children}
    </div>
  );
}

function ColorSection() {
  return (
    <Section title="颜色">
      <div className="grid grid-cols-7 gap-1">
        {COLOR_PRESETS.map((c) => (
          <button
            key={c.label}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyColor(c.value)}
            title={c.label}
            className="w-7 h-7 rounded border border-app-border hover:scale-110 transition-transform flex items-center justify-center text-[10px]"
            style={{
              background: c.value ?? "transparent",
              color: c.value ? "#fff" : "var(--app-fg-muted, #888)",
            }}
          >
            {c.value ? "" : "默"}
          </button>
        ))}
      </div>
    </Section>
  );
}

function FontSizeSection() {
  return (
    <Section title="字号">
      <div className="flex flex-wrap gap-1">
        {FONT_SIZE_PRESETS.map((f) => (
          <button
            key={f.label}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyFontSize(f.value)}
            className="px-2 py-1 text-[11px] rounded border border-app-border hover:bg-app-surface-hover transition-colors"
          >
            {f.label}
          </button>
        ))}
      </div>
    </Section>
  );
}

function LineHeightSection() {
  return (
    <Section title="行高">
      <div className="flex gap-1">
        {LINE_HEIGHT_PRESETS.map((l) => (
          <button
            key={l.label}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyLineHeight(l.value)}
            className="flex-1 px-2 py-1 text-[11px] rounded border border-app-border hover:bg-app-surface-hover transition-colors"
          >
            {l.label}
          </button>
        ))}
      </div>
    </Section>
  );
}

function AlignSection() {
  const items: { id: "left" | "center" | "right" | "justify"; Icon: React.ComponentType<{ size?: number }>; title: string }[] = [
    { id: "left", Icon: AlignLeft, title: "左对齐" },
    { id: "center", Icon: AlignCenter, title: "居中" },
    { id: "right", Icon: AlignRight, title: "右对齐" },
    { id: "justify", Icon: AlignJustify, title: "两端对齐" },
  ];
  return (
    <Section title="对齐">
      <div className="flex gap-1">
        {items.map((it) => (
          <button
            key={it.id}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyTextAlign(it.id)}
            title={it.title}
            className="flex-1 px-2 py-1.5 rounded border border-app-border hover:bg-app-surface-hover transition-colors flex items-center justify-center"
          >
            <it.Icon size={13} />
          </button>
        ))}
      </div>
    </Section>
  );
}

// =====================================================================
// Dispatch — editor-aware
// =====================================================================

function applyColor(color: string | null) {
  if (activeMode() === "visual") {
    const tt = getTipTapEditor();
    if (!tt) return;
    if (color) tt.chain().focus().setColor(color).run();
    else tt.chain().focus().unsetColor().run();
    return;
  }
  if (!color) return; // MD: "default" no-op (user removes span manually / undo)
  wrapInline(`color:${color}`);
}

function applyFontSize(size: string | null) {
  if (activeMode() === "visual") {
    const tt = getTipTapEditor();
    if (!tt) return;
    if (size) tt.chain().focus().setFontSize(size).run();
    else tt.chain().focus().unsetFontSize().run();
    return;
  }
  if (!size) return;
  wrapInline(`font-size:${size}`);
}

function applyLineHeight(value: string | null) {
  if (activeMode() === "visual") {
    const tt = getTipTapEditor();
    if (!tt) return;
    if (value) tt.chain().focus().setLineHeight(value).run();
    else tt.chain().focus().unsetLineHeight().run();
    return;
  }
  if (!value) return;
  wrapBlock(`line-height:${value}`);
}

function applyTextAlign(align: "left" | "center" | "right" | "justify") {
  if (activeMode() === "visual") {
    const tt = getTipTapEditor();
    if (!tt) return;
    tt.chain().focus().setTextAlign(align).run();
    return;
  }
  wrapBlock(`text-align:${align}`);
}

// =====================================================================
// CodeMirror helpers — wrap selection in span / div with inline style
// =====================================================================

function wrapInline(style: string) {
  const view = getEditorView();
  if (!view) return;
  const sel = view.state.selection.main;
  const selected = sel.empty
    ? ""
    : view.state.doc.sliceString(sel.from, sel.to);
  const left = `<span style="${style}">`;
  const right = `</span>`;
  view.dispatch({
    changes: { from: sel.from, to: sel.to, insert: left + selected + right },
    selection: { anchor: sel.from + left.length + selected.length },
  });
  view.focus();
}

function wrapBlock(style: string) {
  const view = getEditorView();
  if (!view) return;
  const sel = view.state.selection.main;
  const doc = view.state.doc;
  const startLine = doc.lineAt(sel.from);
  const endLine = doc.lineAt(sel.to);
  const from = startLine.from;
  const to = Math.min(endLine.to, doc.length);
  const block = doc.sliceString(from, to);
  if (!block.trim()) return; // don't wrap empty lines
  const left = `<div style="${style}">\n\n`;
  const right = `\n\n</div>`;
  view.dispatch({
    changes: { from, to, insert: left + block + right },
    selection: { anchor: from + left.length + block.length },
  });
  view.focus();
}
