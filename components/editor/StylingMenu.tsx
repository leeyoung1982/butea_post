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
import { getTipTapEditor } from "@/lib/editor-ref";
import {
  FONT_SIZE_PRESETS,
  LINE_HEIGHT_PRESETS,
  COLOR_PRESETS,
} from "@/lib/editor-text-style";

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
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

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
  const items: {
    id: "left" | "center" | "right" | "justify";
    Icon: React.ComponentType<{ size?: number }>;
    title: string;
  }[] = [
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
// Dispatch — TipTap only
// =====================================================================

function applyColor(color: string | null) {
  const tt = getTipTapEditor();
  if (!tt) return;
  if (color) tt.chain().focus().setColor(color).run();
  else tt.chain().focus().unsetColor().run();
}

function applyFontSize(size: string | null) {
  const tt = getTipTapEditor();
  if (!tt) return;
  if (size) tt.chain().focus().setFontSize(size).run();
  else tt.chain().focus().unsetFontSize().run();
}

function applyLineHeight(value: string | null) {
  const tt = getTipTapEditor();
  if (!tt) return;
  if (value) tt.chain().focus().setLineHeight(value).run();
  else tt.chain().focus().unsetLineHeight().run();
}

function applyTextAlign(align: "left" | "center" | "right" | "justify") {
  const tt = getTipTapEditor();
  if (!tt) return;
  tt.chain().focus().setTextAlign(align).run();
}
