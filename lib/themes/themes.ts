// 6 article themes for the WeChat preview/export.
// Each theme is a flat token bag — easy to inline-style via juice on export.

export type ThemeId =
  | "butea"
  | "mist"
  | "ink"
  | "sky"
  | "forest"
  | "dawn"
  | "terminal";

export type ArticleTheme = {
  id: ThemeId;
  name: string;
  tagline: string;
  swatch: [string, string, string];
  isDark: boolean;
  tokens: {
    // Layout
    bg: string;
    fg: string;
    fgMuted: string;
    border: string;
    accent: string;
    accentSoft: string;
    // Headings
    h1Color: string;
    h2Color: string;
    h3Color: string;
    // Quote
    quoteBg: string;
    quoteFg: string;
    quoteBar: string;
    // Code
    codeBg: string;
    codeFg: string;
    codeInlineBg: string;
    codeInlineFg: string;
    // Link
    linkColor: string;
    // Table
    tableHeaderBg: string;
    tableBorder: string;
    // Typography
    fontTitle: string;
    fontBody: string;
    fontCode: string;
    bodySize: string;
    lineHeight: string;
    paragraphSpacing: string;
    // Heading flair
    h1Style: "plain" | "underline" | "barLeft" | "centerOrnament";
    h2Style: "plain" | "underline" | "barLeft" | "ribbon" | "numbered";
  };
};

const CN_FONT_STACK =
  '"PingFang SC", -apple-system, "HarmonyOS Sans SC", "Microsoft YaHei", "Hiragino Sans GB", sans-serif';
const CN_SERIF_STACK =
  '"Source Han Serif SC", "Noto Serif SC", "Songti SC", "STSong", serif';
const MONO_STACK =
  '"JetBrains Mono", "SF Mono", Menlo, Consolas, "Courier New", monospace';

export const THEMES: ArticleTheme[] = [
  {
    id: "butea",
    name: "紫矿",
    tagline: "本品牌主题·暖紫·东方现代",
    swatch: ["#6B2737", "#EA580C", "#FEF7ED"],
    isDark: false,
    tokens: {
      bg: "#FEF7ED",
      fg: "#1C1917",
      fgMuted: "#57534E",
      border: "#FED7AA",
      accent: "#6B2737",
      accentSoft: "#FDF2F8",
      h1Color: "#6B2737",
      h2Color: "#9F1239",
      h3Color: "#BE123C",
      quoteBg: "#FFF7ED",
      quoteFg: "#7C2D12",
      quoteBar: "#EA580C",
      codeBg: "#1C1917",
      codeFg: "#FED7AA",
      codeInlineBg: "#FFEDD5",
      codeInlineFg: "#9A3412",
      linkColor: "#9F1239",
      tableHeaderBg: "#FFEDD5",
      tableBorder: "#FED7AA",
      fontTitle: CN_FONT_STACK,
      fontBody: CN_FONT_STACK,
      fontCode: MONO_STACK,
      bodySize: "16px",
      lineHeight: "1.9",
      paragraphSpacing: "1.45em",
      h1Style: "centerOrnament",
      h2Style: "barLeft",
    },
  },
  {
    id: "mist",
    name: "雾岚",
    tagline: "极简·科技·性冷淡",
    swatch: ["#1f2937", "#6b7280", "#f4f4f5"],
    isDark: false,
    tokens: {
      bg: "#ffffff",
      fg: "#1f2937",
      fgMuted: "#6b7280",
      border: "#e5e7eb",
      accent: "#111827",
      accentSoft: "#f4f4f5",
      h1Color: "#111827",
      h2Color: "#111827",
      h3Color: "#374151",
      quoteBg: "#f9fafb",
      quoteFg: "#4b5563",
      quoteBar: "#d1d5db",
      codeBg: "#f4f4f5",
      codeFg: "#1f2937",
      codeInlineBg: "#f1f5f9",
      codeInlineFg: "#0f172a",
      linkColor: "#1d4ed8",
      tableHeaderBg: "#f4f4f5",
      tableBorder: "#e5e7eb",
      fontTitle: CN_FONT_STACK,
      fontBody: CN_FONT_STACK,
      fontCode: MONO_STACK,
      bodySize: "16px",
      lineHeight: "1.85",
      paragraphSpacing: "1.4em",
      h1Style: "plain",
      h2Style: "barLeft",
    },
  },
  {
    id: "ink",
    name: "墨黑",
    tagline: "印刷感·严肃·权威",
    swatch: ["#0a0a0a", "#a8742a", "#fafaf7"],
    isDark: false,
    tokens: {
      bg: "#fafaf7",
      fg: "#0a0a0a",
      fgMuted: "#525252",
      border: "#d6d3d1",
      accent: "#a8742a",
      accentSoft: "#f5f1e8",
      h1Color: "#0a0a0a",
      h2Color: "#0a0a0a",
      h3Color: "#262626",
      quoteBg: "#f5f1e8",
      quoteFg: "#3f3f46",
      quoteBar: "#a8742a",
      codeBg: "#1c1917",
      codeFg: "#fafaf7",
      codeInlineBg: "#e7e5e4",
      codeInlineFg: "#1c1917",
      linkColor: "#a8742a",
      tableHeaderBg: "#f5f1e8",
      tableBorder: "#d6d3d1",
      fontTitle: CN_SERIF_STACK,
      fontBody: CN_SERIF_STACK,
      fontCode: MONO_STACK,
      bodySize: "16px",
      lineHeight: "1.95",
      paragraphSpacing: "1.5em",
      h1Style: "centerOrnament",
      h2Style: "ribbon",
    },
  },
  {
    id: "sky",
    name: "天青",
    tagline: "清爽·产品·UX",
    swatch: ["#0369a1", "#3b82f6", "#f0f9ff"],
    isDark: false,
    tokens: {
      bg: "#ffffff",
      fg: "#0f172a",
      fgMuted: "#475569",
      border: "#e0f2fe",
      accent: "#0369a1",
      accentSoft: "#eff6ff",
      h1Color: "#0c4a6e",
      h2Color: "#0369a1",
      h3Color: "#0284c7",
      quoteBg: "#eff6ff",
      quoteFg: "#1e3a8a",
      quoteBar: "#3b82f6",
      codeBg: "#f1f5f9",
      codeFg: "#0f172a",
      codeInlineBg: "#dbeafe",
      codeInlineFg: "#1e3a8a",
      linkColor: "#0369a1",
      tableHeaderBg: "#eff6ff",
      tableBorder: "#bae6fd",
      fontTitle: CN_FONT_STACK,
      fontBody: CN_FONT_STACK,
      fontCode: MONO_STACK,
      bodySize: "16px",
      lineHeight: "1.85",
      paragraphSpacing: "1.3em",
      h1Style: "underline",
      h2Style: "barLeft",
    },
  },
  {
    id: "forest",
    name: "林深",
    tagline: "自然·人文·长读",
    swatch: ["#14532d", "#84cc16", "#f7fee7"],
    isDark: false,
    tokens: {
      bg: "#fdfdf6",
      fg: "#1c1917",
      fgMuted: "#57534e",
      border: "#dcfce7",
      accent: "#14532d",
      accentSoft: "#f7fee7",
      h1Color: "#14532d",
      h2Color: "#166534",
      h3Color: "#15803d",
      quoteBg: "#f7fee7",
      quoteFg: "#365314",
      quoteBar: "#84cc16",
      codeBg: "#f5f5f4",
      codeFg: "#1c1917",
      codeInlineBg: "#ecfccb",
      codeInlineFg: "#365314",
      linkColor: "#15803d",
      tableHeaderBg: "#f7fee7",
      tableBorder: "#d9f99d",
      fontTitle: CN_SERIF_STACK,
      fontBody: CN_FONT_STACK,
      fontCode: MONO_STACK,
      bodySize: "16px",
      lineHeight: "1.9",
      paragraphSpacing: "1.4em",
      h1Style: "centerOrnament",
      h2Style: "numbered",
    },
  },
  {
    id: "dawn",
    name: "拂晓",
    tagline: "温柔·明亮·生活方式",
    swatch: ["#be185d", "#f472b6", "#fff1f2"],
    isDark: false,
    tokens: {
      bg: "#fffaf7",
      fg: "#3f3f46",
      fgMuted: "#71717a",
      border: "#fce7f3",
      accent: "#be185d",
      accentSoft: "#fff1f2",
      h1Color: "#9d174d",
      h2Color: "#be185d",
      h3Color: "#db2777",
      quoteBg: "#fff1f2",
      quoteFg: "#831843",
      quoteBar: "#f472b6",
      codeBg: "#fdf2f8",
      codeFg: "#831843",
      codeInlineBg: "#fce7f3",
      codeInlineFg: "#9d174d",
      linkColor: "#be185d",
      tableHeaderBg: "#fff1f2",
      tableBorder: "#fbcfe8",
      fontTitle: CN_FONT_STACK,
      fontBody: CN_FONT_STACK,
      fontCode: MONO_STACK,
      bodySize: "16px",
      lineHeight: "1.9",
      paragraphSpacing: "1.4em",
      h1Style: "centerOrnament",
      h2Style: "ribbon",
    },
  },
  {
    id: "terminal",
    name: "终端",
    tagline: "暗色·Geek·程序员",
    swatch: ["#0f172a", "#10b981", "#1e293b"],
    isDark: true,
    tokens: {
      bg: "#0f172a",
      fg: "#e2e8f0",
      fgMuted: "#94a3b8",
      border: "#1e293b",
      accent: "#10b981",
      accentSoft: "#0f2922",
      h1Color: "#10b981",
      h2Color: "#34d399",
      h3Color: "#6ee7b7",
      quoteBg: "#0f2922",
      quoteFg: "#a7f3d0",
      quoteBar: "#10b981",
      codeBg: "#020617",
      codeFg: "#e2e8f0",
      codeInlineBg: "#1e293b",
      codeInlineFg: "#34d399",
      linkColor: "#34d399",
      tableHeaderBg: "#1e293b",
      tableBorder: "#334155",
      fontTitle: CN_FONT_STACK,
      fontBody: CN_FONT_STACK,
      fontCode: MONO_STACK,
      bodySize: "16px",
      lineHeight: "1.85",
      paragraphSpacing: "1.3em",
      h1Style: "barLeft",
      h2Style: "plain",
    },
  },
];

export function getTheme(id: ThemeId): ArticleTheme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}
