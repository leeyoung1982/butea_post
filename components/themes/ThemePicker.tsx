"use client";

import * as React from "react";
import * as Popover from "@radix-ui/react-popover";
import { Palette, Check, ChevronDown, RotateCcw, Save, Trash2 } from "lucide-react";
import {
  THEMES,
  DEFAULT_CUSTOM_TOKENS,
  BG_TEXTURES,
  type ThemeId,
  type ThemeTokens,
  type ArticleTheme,
  type BgTextureId,
} from "@/lib/themes/themes";
import { useWorkshop } from "@/lib/store";
import { cn } from "@/lib/utils";

export function ThemePicker() {
  const themeId = useWorkshop((s) => s.themeId);
  const setThemeId = useWorkshop((s) => s.setThemeId);
  const customTokens = useWorkshop((s) => s.customThemeTokens);
  const setCustomTokens = useWorkshop((s) => s.setCustomThemeTokens);

  const current =
    themeId === "custom"
      ? null
      : THEMES.find((t) => t.id === themeId) ?? THEMES[0];
  const currentName = current?.name ?? "自定义";
  const currentSwatch = current?.swatch ?? [
    customTokens?.accent ?? "#111",
    customTokens?.fg ?? "#333",
    customTokens?.bg ?? "#fff",
  ];

  const [tab, setTab] = React.useState<"color" | "style" | "custom">("color");

  const colorThemes = THEMES.filter((t) => t.category === "color");
  const styleThemes = THEMES.filter((t) => t.category === "style");

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          className="flex items-center gap-1.5 px-1.5 py-1 rounded text-xs text-app-fg-muted hover:text-app-fg hover:bg-app-surface-hover transition-colors whitespace-nowrap"
          title="排版主题"
        >
          <span
            className="w-3 h-3 rounded-full border border-app-border shrink-0"
            style={{
              background: `linear-gradient(135deg, ${currentSwatch[0]} 50%, ${currentSwatch[1]} 50%)`,
            }}
          />
          <span className="hidden lg:inline">{currentName}</span>
          <ChevronDown size={10} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          className="z-50 w-[360px] max-h-[480px] bg-app-surface border border-app-border rounded-lg shadow-xl animate-fade-in flex flex-col"
        >
          {/* Tabs */}
          <div className="flex border-b border-app-border px-2 pt-2 gap-1 shrink-0">
            <TabBtn active={tab === "color"} onClick={() => setTab("color")}>
              配色
            </TabBtn>
            <TabBtn active={tab === "style"} onClick={() => setTab("style")}>
              风格
            </TabBtn>
            <TabBtn active={tab === "custom"} onClick={() => setTab("custom")}>
              自定义
            </TabBtn>
          </div>

          {/* List */}
          {tab !== "custom" && (
            <div className="overflow-auto flex-1 p-2">
              <div className="grid grid-cols-1 gap-1">
                {(tab === "color" ? colorThemes : styleThemes).map((t) => (
                  <ThemeRow
                    key={t.id}
                    theme={t}
                    active={t.id === themeId}
                    onPick={() => setThemeId(t.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Custom editor */}
          {tab === "custom" && (
            <CustomThemeEditor
              tokens={customTokens ?? DEFAULT_CUSTOM_TOKENS}
              isActive={themeId === "custom"}
              onApply={(tokens) => {
                setCustomTokens(tokens);
                setThemeId("custom");
              }}
              onReset={() => {
                setCustomTokens(DEFAULT_CUSTOM_TOKENS);
              }}
            />
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function ThemeRow({
  theme,
  active,
  onPick,
}: {
  theme: ArticleTheme;
  active: boolean;
  onPick: () => void;
}) {
  return (
    <button
      onClick={onPick}
      className={cn(
        "flex items-center gap-3 px-2.5 py-2 rounded-md text-left hover:bg-app-surface-hover transition-colors",
        active && "bg-app-surface-hover"
      )}
    >
      <div className="flex -space-x-1 shrink-0">
        {theme.swatch.map((c, i) => (
          <span
            key={i}
            className="w-4.5 h-4.5 rounded-full border border-app-border"
            style={{ background: c, width: 18, height: 18 }}
          />
        ))}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-app-fg">{theme.name}</div>
        <div className="text-[11px] text-app-fg-muted truncate">
          {theme.tagline}
        </div>
      </div>
      {active && <Check size={14} className="text-app-fg shrink-0" />}
    </button>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 text-xs rounded-t transition-colors",
        active
          ? "bg-app-surface-hover text-app-fg font-medium border-b-2 border-app-fg"
          : "text-app-fg-muted hover:text-app-fg"
      )}
    >
      {children}
    </button>
  );
}

// =====================================================================
// Custom theme editor
// =====================================================================

type EditableField = {
  key: keyof ThemeTokens;
  label: string;
  type: "color" | "select" | "text";
  options?: { label: string; value: string }[];
};

const FONT_OPTIONS = [
  { label: "无衬线 (黑体)", value: '"PingFang SC", -apple-system, "HarmonyOS Sans SC", "Microsoft YaHei", "Hiragino Sans GB", sans-serif' },
  { label: "衬线 (宋体)", value: '"Source Han Serif SC", "Noto Serif SC", "Songti SC", "STSong", serif' },
  { label: "系统默认", value: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' },
  { label: "Georgia", value: 'Georgia, "Times New Roman", "Source Han Serif SC", "Noto Serif SC", serif' },
  { label: "Charter", value: 'Charter, "Bitstream Charter", Georgia, "Source Han Serif SC", serif' },
];

const SIZE_OPTIONS = [
  { label: "14px", value: "14px" },
  { label: "15px", value: "15px" },
  { label: "16px", value: "16px" },
  { label: "17px", value: "17px" },
  { label: "18px", value: "18px" },
  { label: "20px", value: "20px" },
];

const LINE_HEIGHT_OPTIONS = [
  { label: "1.5", value: "1.5" },
  { label: "1.7", value: "1.7" },
  { label: "1.8", value: "1.8" },
  { label: "1.85", value: "1.85" },
  { label: "1.9", value: "1.9" },
  { label: "2.0", value: "2.0" },
  { label: "2.1", value: "2.1" },
];

const SPACING_OPTIONS = [
  { label: "紧凑 (0.5em)", value: "0.5em" },
  { label: "标准 (1.2em)", value: "1.2em" },
  { label: "舒适 (1.4em)", value: "1.4em" },
  { label: "宽松 (1.6em)", value: "1.6em" },
  { label: "超宽 (1.8em)", value: "1.8em" },
];

const H1_STYLE_OPTIONS = [
  { label: "默认", value: "plain" },
  { label: "下划线", value: "underline" },
  { label: "左竖线", value: "barLeft" },
  { label: "居中装饰", value: "centerOrnament" },
];

const H2_STYLE_OPTIONS = [
  { label: "默认", value: "plain" },
  { label: "下划线", value: "underline" },
  { label: "左竖线", value: "barLeft" },
  { label: "色带", value: "ribbon" },
  { label: "编号", value: "numbered" },
];

const TEXTURE_OPTIONS = BG_TEXTURES.map((t) => ({
  label: t.label,
  value: t.id,
}));

const FIELD_GROUPS: { title: string; fields: EditableField[] }[] = [
  {
    title: "基础配色",
    fields: [
      { key: "bg", label: "背景", type: "color" },
      { key: "fg", label: "正文", type: "color" },
      { key: "fgMuted", label: "次要文字", type: "color" },
      { key: "accent", label: "强调色", type: "color" },
      { key: "linkColor", label: "链接", type: "color" },
      { key: "border", label: "边框", type: "color" },
    ],
  },
  {
    title: "标题",
    fields: [
      { key: "h1Color", label: "H1 颜色", type: "color" },
      { key: "h2Color", label: "H2 颜色", type: "color" },
      { key: "h3Color", label: "H3 颜色", type: "color" },
      { key: "h1Style", label: "H1 样式", type: "select", options: H1_STYLE_OPTIONS },
      { key: "h2Style", label: "H2 样式", type: "select", options: H2_STYLE_OPTIONS },
    ],
  },
  {
    title: "引用与代码",
    fields: [
      { key: "quoteBg", label: "引用背景", type: "color" },
      { key: "quoteBar", label: "引用竖线", type: "color" },
      { key: "codeBg", label: "代码块背景", type: "color" },
      { key: "codeFg", label: "代码块文字", type: "color" },
      { key: "codeInlineBg", label: "行内代码背景", type: "color" },
    ],
  },
  {
    title: "字体与排版",
    fields: [
      { key: "fontTitle", label: "标题字体", type: "select", options: FONT_OPTIONS },
      { key: "fontBody", label: "正文字体", type: "select", options: FONT_OPTIONS },
      { key: "bodySize", label: "字号", type: "select", options: SIZE_OPTIONS },
      { key: "lineHeight", label: "行高", type: "select", options: LINE_HEIGHT_OPTIONS },
      { key: "paragraphSpacing", label: "段间距", type: "select", options: SPACING_OPTIONS },
      { key: "bgTexture", label: "背景纹理", type: "select", options: TEXTURE_OPTIONS },
    ],
  },
];

// =====================================================================
// Saved presets — stored in localStorage
// =====================================================================

const PRESETS_KEY = "butea:custom-theme-presets";

type SavedPreset = { name: string; tokens: ThemeTokens };

function loadPresets(): SavedPreset[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(PRESETS_KEY);
    return raw ? (JSON.parse(raw) as SavedPreset[]) : [];
  } catch {
    return [];
  }
}

function savePresets(presets: SavedPreset[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
}

function CustomThemeEditor({
  tokens,
  isActive,
  onApply,
  onReset,
}: {
  tokens: ThemeTokens;
  isActive: boolean;
  onApply: (tokens: ThemeTokens) => void;
  onReset: () => void;
}) {
  const [draft, setDraft] = React.useState<ThemeTokens>(tokens);
  const [presets, setPresets] = React.useState<SavedPreset[]>(() => loadPresets());
  const [saveName, setSaveName] = React.useState("");
  const [showSaveInput, setShowSaveInput] = React.useState(false);

  React.useEffect(() => {
    setDraft(tokens);
  }, [tokens]);

  const update = (key: keyof ThemeTokens, value: string) => {
    const next = { ...draft, [key]: value };
    setDraft(next);
    if (key === "accent") {
      next.accentSoft = hexToSoft(value);
    }
    onApply(next);
  };

  const handleSavePreset = () => {
    const name = saveName.trim();
    if (!name) return;
    const existing = presets.filter((p) => p.name !== name);
    const next = [...existing, { name, tokens: { ...draft } }];
    setPresets(next);
    savePresets(next);
    setSaveName("");
    setShowSaveInput(false);
  };

  const handleDeletePreset = (name: string) => {
    const next = presets.filter((p) => p.name !== name);
    setPresets(next);
    savePresets(next);
  };

  const handleLoadPreset = (p: SavedPreset) => {
    setDraft({ ...p.tokens });
    onApply({ ...p.tokens });
  };

  return (
    <div className="overflow-auto flex-1 p-3 space-y-4">
      {/* Saved presets */}
      {presets.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-app-fg-subtle mb-1.5">
            已保存的预设
          </div>
          <div className="space-y-1">
            {presets.map((p) => (
              <div
                key={p.name}
                className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-app-surface-hover transition-colors group"
              >
                <button
                  onClick={() => handleLoadPreset(p)}
                  className="flex items-center gap-2 flex-1 min-w-0 text-left"
                >
                  <span
                    className="w-4 h-4 rounded-full border border-app-border shrink-0"
                    style={{
                      background: `linear-gradient(135deg, ${p.tokens.accent} 50%, ${p.tokens.fg} 50%)`,
                    }}
                  />
                  <span className="text-xs text-app-fg truncate">{p.name}</span>
                </button>
                <button
                  onClick={() => handleDeletePreset(p.name)}
                  className="opacity-0 group-hover:opacity-100 text-app-fg-subtle hover:text-red-500 transition-all"
                  title="删除预设"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Save current as preset */}
      <div>
        {showSaveInput ? (
          <div className="flex gap-1.5">
            <input
              type="text"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSavePreset()}
              placeholder="预设名称"
              autoFocus
              className="flex-1 h-6 px-2 text-[11px] rounded border border-app-border bg-app-bg text-app-fg focus:outline-none focus:border-app-fg-muted"
            />
            <button
              onClick={handleSavePreset}
              disabled={!saveName.trim()}
              className="px-2 h-6 text-[11px] rounded bg-app-fg text-app-bg disabled:opacity-40"
            >
              保存
            </button>
            <button
              onClick={() => setShowSaveInput(false)}
              className="px-1.5 h-6 text-[11px] text-app-fg-muted hover:text-app-fg"
            >
              取消
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowSaveInput(true)}
            className="flex items-center gap-1 text-[11px] text-app-fg-muted hover:text-app-fg transition-colors"
          >
            <Save size={11} />
            保存当前配置为预设
          </button>
        )}
      </div>

      {/* Quick-start: base on existing theme */}
      <div>
        <div className="text-[10px] uppercase tracking-wider text-app-fg-subtle mb-1.5">
          基于已有主题
        </div>
        <div className="flex flex-wrap gap-1">
          {THEMES.slice(0, 10).map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setDraft({ ...t.tokens });
                onApply({ ...t.tokens });
              }}
              title={`基于 ${t.name}`}
              className="w-5 h-5 rounded-full border border-app-border hover:scale-110 transition-transform"
              style={{
                background: `linear-gradient(135deg, ${t.swatch[0]} 50%, ${t.swatch[1]} 50%)`,
              }}
            />
          ))}
          <button
            onClick={onReset}
            title="重置为默认"
            className="w-5 h-5 rounded-full border border-app-border hover:scale-110 transition-transform flex items-center justify-center bg-app-bg"
          >
            <RotateCcw size={10} className="text-app-fg-muted" />
          </button>
        </div>
      </div>

      {FIELD_GROUPS.map((group) => (
        <div key={group.title}>
          <div className="text-[10px] uppercase tracking-wider text-app-fg-subtle mb-2">
            {group.title}
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-2">
            {group.fields.map((f) => (
              <FieldEditor
                key={f.key}
                field={f}
                value={(draft[f.key] as string) ?? ""}
                onChange={(v) => update(f.key, v)}
              />
            ))}
          </div>
        </div>
      ))}

      {/* Preview strip */}
      <div
        className="rounded border p-3 text-xs space-y-1"
        style={{
          background: draft.bg,
          color: draft.fg,
          borderColor: draft.border,
          fontFamily: draft.fontBody,
          fontSize: draft.bodySize,
          lineHeight: draft.lineHeight,
        }}
      >
        <div
          style={{
            color: draft.h1Color,
            fontFamily: draft.fontTitle,
            fontWeight: 700,
            fontSize: "1.2em",
          }}
        >
          标题预览 Title Preview
        </div>
        <div style={{ color: draft.fg }}>
          正文文字预览，这是一段示例内容。
          <span style={{ color: draft.linkColor, textDecoration: "underline" }}>
            链接文字
          </span>
        </div>
        <div
          style={{
            background: draft.quoteBg,
            borderLeft: `3px solid ${draft.quoteBar}`,
            padding: "6px 10px",
            color: draft.quoteFg,
            borderRadius: "0 4px 4px 0",
          }}
        >
          引用文字
        </div>
        <span
          style={{
            background: draft.codeInlineBg,
            color: draft.codeInlineFg,
            padding: "1px 4px",
            borderRadius: 3,
            fontFamily: draft.fontCode,
          }}
        >
          inline code
        </span>
      </div>

      {!isActive && (
        <button
          onClick={() => onApply(draft)}
          className="w-full py-1.5 rounded bg-app-fg text-app-bg text-xs font-medium hover:opacity-90 transition-opacity"
        >
          应用自定义主题
        </button>
      )}
    </div>
  );
}

function FieldEditor({
  field,
  value,
  onChange,
}: {
  field: EditableField;
  value: string;
  onChange: (v: string) => void;
}) {
  if (field.type === "color") {
    return (
      <label className="flex items-center gap-2">
        <input
          type="color"
          value={value || "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="w-5 h-5 rounded border border-app-border cursor-pointer p-0"
          style={{ WebkitAppearance: "none" }}
        />
        <span className="text-[11px] text-app-fg-muted flex-1 truncate">
          {field.label}
        </span>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-[60px] h-5 px-1 text-[10px] font-mono rounded border border-app-border bg-app-bg text-app-fg focus:outline-none"
        />
      </label>
    );
  }

  if (field.type === "select" && field.options) {
    return (
      <label className="block">
        <span className="text-[11px] text-app-fg-muted">{field.label}</span>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="mt-0.5 w-full h-6 px-1 text-[11px] rounded border border-app-border bg-app-bg text-app-fg focus:outline-none"
        >
          {field.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <label className="block">
      <span className="text-[11px] text-app-fg-muted">{field.label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-0.5 w-full h-6 px-1 text-[11px] font-mono rounded border border-app-border bg-app-bg text-app-fg focus:outline-none"
      />
    </label>
  );
}

/** Generate a soft/pastel version of a hex color for accentSoft. */
function hexToSoft(hex: string): string {
  const c = hex.replace("#", "");
  if (c.length < 6) return "#f5f5f5";
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const sr = Math.round(r + (255 - r) * 0.85);
  const sg = Math.round(g + (255 - g) * 0.85);
  const sb = Math.round(b + (255 - b) * 0.85);
  return `#${sr.toString(16).padStart(2, "0")}${sg.toString(16).padStart(2, "0")}${sb.toString(16).padStart(2, "0")}`;
}
