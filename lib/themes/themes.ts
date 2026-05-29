// Article themes for preview/export.
// Each theme is a flat token bag — easy to inline-style via juice on export.

export type ThemeId =
  | "butea"
  | "mist"
  | "ink"
  | "sky"
  | "forest"
  | "dawn"
  | "terminal"
  | "github"
  | "medium"
  | "notion"
  | "zhihu"
  | "sspai"
  | "zhubai"
  | "substack"
  | "weread"
  | "brutalist"
  | "muji"
  | "custom";

export type ThemeCategory = "color" | "style";

export type ThemeTokens = {
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
  // Background texture (optional, CSS pattern overlaid on bg)
  bgTexture?: BgTextureId;
};

export type BgTextureId =
  | "none"
  | "paper"
  | "grid"
  | "dots"
  | "linen"
  | "noise";

export const BG_TEXTURES: { id: BgTextureId; label: string; css: string }[] = [
  { id: "none", label: "无", css: "" },
  {
    id: "paper",
    label: "纸纹",
    css: `background-image: url("data:image/svg+xml,%3Csvg width='100' height='100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");`,
  },
  {
    id: "grid",
    label: "网格",
    css: `background-image: linear-gradient(rgba(0,0,0,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.03) 1px, transparent 1px); background-size: 24px 24px;`,
  },
  {
    id: "dots",
    label: "圆点",
    css: `background-image: radial-gradient(circle, rgba(0,0,0,0.06) 1px, transparent 1px); background-size: 20px 20px;`,
  },
  {
    id: "linen",
    label: "亚麻",
    css: `background-image: linear-gradient(45deg, rgba(0,0,0,0.02) 25%, transparent 25%), linear-gradient(-45deg, rgba(0,0,0,0.02) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(0,0,0,0.02) 75%), linear-gradient(-45deg, transparent 75%, rgba(0,0,0,0.02) 75%); background-size: 16px 16px; background-position: 0 0, 0 8px, 8px -8px, -8px 0px;`,
  },
  {
    id: "noise",
    label: "噪点",
    css: `background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='turbulence' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.035'/%3E%3C/svg%3E"); background-size: 150px 150px;`,
  },
];

export type ArticleTheme = {
  id: ThemeId;
  name: string;
  tagline: string;
  swatch: [string, string, string];
  isDark: boolean;
  category: ThemeCategory;
  tokens: ThemeTokens;
};

const CN_FONT_STACK =
  '"PingFang SC", -apple-system, "HarmonyOS Sans SC", "Microsoft YaHei", "Hiragino Sans GB", sans-serif';
const CN_SERIF_STACK =
  '"Source Han Serif SC", "Noto Serif SC", "Songti SC", "STSong", serif';
const MONO_STACK =
  '"JetBrains Mono", "SF Mono", Menlo, Consolas, "Courier New", monospace';
const SYSTEM_STACK =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const GEORGIA_STACK =
  'Georgia, "Times New Roman", "Source Han Serif SC", "Noto Serif SC", serif';
const CHARTER_STACK =
  'Charter, "Bitstream Charter", Georgia, "Source Han Serif SC", serif';

export const THEMES: ArticleTheme[] = [
  // =====================================================================
  // Color themes (original 7)
  // =====================================================================
  {
    id: "butea",
    name: "紫矿",
    tagline: "本品牌主题·暖紫·东方现代",
    swatch: ["#6B2737", "#EA580C", "#FEF7ED"],
    isDark: false,
    category: "color",
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
      bodySize: "14px",
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
    category: "color",
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
      bodySize: "14px",
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
    category: "color",
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
      bodySize: "14px",
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
    category: "color",
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
      bodySize: "14px",
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
    category: "color",
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
      bodySize: "14px",
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
    category: "color",
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
      bodySize: "14px",
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
    category: "color",
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
      bodySize: "14px",
      lineHeight: "1.85",
      paragraphSpacing: "1.3em",
      h1Style: "barLeft",
      h2Style: "plain",
    },
  },

  // =====================================================================
  // Style themes (10 new)
  // =====================================================================
  {
    id: "github",
    name: "GitHub",
    tagline: "技术文档·Markdown 原味·开发者友好",
    swatch: ["#24292f", "#0969da", "#ffffff"],
    isDark: false,
    category: "style",
    tokens: {
      bg: "#ffffff",
      fg: "#24292f",
      fgMuted: "#656d76",
      border: "#d0d7de",
      accent: "#0969da",
      accentSoft: "#ddf4ff",
      h1Color: "#24292f",
      h2Color: "#24292f",
      h3Color: "#24292f",
      quoteBg: "#f6f8fa",
      quoteFg: "#656d76",
      quoteBar: "#d0d7de",
      codeBg: "#161b22",
      codeFg: "#e6edf3",
      codeInlineBg: "#eff1f3",
      codeInlineFg: "#24292f",
      linkColor: "#0969da",
      tableHeaderBg: "#f6f8fa",
      tableBorder: "#d0d7de",
      fontTitle: SYSTEM_STACK,
      fontBody: SYSTEM_STACK,
      fontCode: MONO_STACK,
      bodySize: "14px",
      lineHeight: "1.75",
      paragraphSpacing: "1.2em",
      h1Style: "underline",
      h2Style: "underline",
    },
  },
  {
    id: "medium",
    name: "Medium",
    tagline: "衬线长文·优雅阅读·沉浸叙事",
    swatch: ["#242424", "#1a8917", "#ffffff"],
    isDark: false,
    category: "style",
    tokens: {
      bg: "#ffffff",
      fg: "#242424",
      fgMuted: "#6b6b6b",
      border: "#e6e6e6",
      accent: "#1a8917",
      accentSoft: "#f2f9f2",
      h1Color: "#242424",
      h2Color: "#242424",
      h3Color: "#242424",
      quoteBg: "transparent",
      quoteFg: "#6b6b6b",
      quoteBar: "#242424",
      codeBg: "#f2f2f2",
      codeFg: "#242424",
      codeInlineBg: "#f2f2f2",
      codeInlineFg: "#242424",
      linkColor: "#1a8917",
      tableHeaderBg: "#f9f9f9",
      tableBorder: "#e6e6e6",
      fontTitle: CHARTER_STACK,
      fontBody: CHARTER_STACK,
      fontCode: MONO_STACK,
      bodySize: "16px",
      lineHeight: "1.95",
      paragraphSpacing: "1.6em",
      h1Style: "plain",
      h2Style: "plain",
    },
  },
  {
    id: "notion",
    name: "Notion",
    tagline: "系统字体·干净留白·轻量笔记",
    swatch: ["#37352f", "#2eaadc", "#ffffff"],
    isDark: false,
    category: "style",
    tokens: {
      bg: "#ffffff",
      fg: "#37352f",
      fgMuted: "#787774",
      border: "#e3e2e0",
      accent: "#2eaadc",
      accentSoft: "#e8f5fa",
      h1Color: "#37352f",
      h2Color: "#37352f",
      h3Color: "#37352f",
      quoteBg: "#f7f6f3",
      quoteFg: "#37352f",
      quoteBar: "#e3e2e0",
      codeBg: "#f7f6f3",
      codeFg: "#eb5757",
      codeInlineBg: "#f7f6f3",
      codeInlineFg: "#eb5757",
      linkColor: "#37352f",
      tableHeaderBg: "#f7f6f3",
      tableBorder: "#e3e2e0",
      fontTitle: SYSTEM_STACK,
      fontBody: SYSTEM_STACK,
      fontCode: MONO_STACK,
      bodySize: "14px",
      lineHeight: "1.7",
      paragraphSpacing: "0.5em",
      h1Style: "plain",
      h2Style: "plain",
    },
  },
  {
    id: "zhihu",
    name: "知乎",
    tagline: "蓝色调·知识分享·专业问答",
    swatch: ["#1a1a1a", "#0066ff", "#ffffff"],
    isDark: false,
    category: "style",
    tokens: {
      bg: "#ffffff",
      fg: "#1a1a1a",
      fgMuted: "#8590a6",
      border: "#ebebeb",
      accent: "#0066ff",
      accentSoft: "#f0f6ff",
      h1Color: "#1a1a1a",
      h2Color: "#1a1a1a",
      h3Color: "#1a1a1a",
      quoteBg: "#f6f6f6",
      quoteFg: "#999999",
      quoteBar: "#0066ff",
      codeBg: "#1e1e1e",
      codeFg: "#d4d4d4",
      codeInlineBg: "#f6f6f6",
      codeInlineFg: "#c7254e",
      linkColor: "#0066ff",
      tableHeaderBg: "#f6f6f6",
      tableBorder: "#ebebeb",
      fontTitle: CN_FONT_STACK,
      fontBody: CN_FONT_STACK,
      fontCode: MONO_STACK,
      bodySize: "14px",
      lineHeight: "1.8",
      paragraphSpacing: "1.4em",
      h1Style: "plain",
      h2Style: "barLeft",
    },
  },
  {
    id: "sspai",
    name: "少数派",
    tagline: "红色调·科技人文·精致排版",
    swatch: ["#333333", "#d71a1b", "#ffffff"],
    isDark: false,
    category: "style",
    tokens: {
      bg: "#ffffff",
      fg: "#333333",
      fgMuted: "#999999",
      border: "#eaeaea",
      accent: "#d71a1b",
      accentSoft: "#fff5f5",
      h1Color: "#333333",
      h2Color: "#d71a1b",
      h3Color: "#333333",
      quoteBg: "#fafafa",
      quoteFg: "#666666",
      quoteBar: "#d71a1b",
      codeBg: "#282c34",
      codeFg: "#abb2bf",
      codeInlineBg: "#f5f5f5",
      codeInlineFg: "#d71a1b",
      linkColor: "#d71a1b",
      tableHeaderBg: "#fafafa",
      tableBorder: "#eaeaea",
      fontTitle: CN_FONT_STACK,
      fontBody: CN_FONT_STACK,
      fontCode: MONO_STACK,
      bodySize: "14px",
      lineHeight: "1.85",
      paragraphSpacing: "1.4em",
      h1Style: "plain",
      h2Style: "barLeft",
    },
  },
  {
    id: "zhubai",
    name: "竹白",
    tagline: "素雅留白·Newsletter·深度长文",
    swatch: ["#1d1d1f", "#8b8b8b", "#fafafa"],
    isDark: false,
    category: "style",
    tokens: {
      bg: "#fafafa",
      fg: "#1d1d1f",
      fgMuted: "#8b8b8b",
      border: "#e8e8e8",
      accent: "#1d1d1f",
      accentSoft: "#f0f0f0",
      h1Color: "#1d1d1f",
      h2Color: "#1d1d1f",
      h3Color: "#3d3d3f",
      quoteBg: "#f5f5f5",
      quoteFg: "#6b6b6b",
      quoteBar: "#c0c0c0",
      codeBg: "#f0f0f0",
      codeFg: "#1d1d1f",
      codeInlineBg: "#f0f0f0",
      codeInlineFg: "#1d1d1f",
      linkColor: "#1d1d1f",
      tableHeaderBg: "#f0f0f0",
      tableBorder: "#e8e8e8",
      fontTitle: CN_SERIF_STACK,
      fontBody: CN_FONT_STACK,
      fontCode: MONO_STACK,
      bodySize: "14px",
      lineHeight: "2.0",
      paragraphSpacing: "1.6em",
      h1Style: "plain",
      h2Style: "underline",
    },
  },
  {
    id: "substack",
    name: "Substack",
    tagline: "美式 Newsletter·衬线·宽松行距",
    swatch: ["#282828", "#ff6719", "#ffffff"],
    isDark: false,
    category: "style",
    tokens: {
      bg: "#ffffff",
      fg: "#282828",
      fgMuted: "#7c7c7c",
      border: "#e5e5e5",
      accent: "#ff6719",
      accentSoft: "#fff4ed",
      h1Color: "#282828",
      h2Color: "#282828",
      h3Color: "#282828",
      quoteBg: "transparent",
      quoteFg: "#7c7c7c",
      quoteBar: "#e5e5e5",
      codeBg: "#f5f5f5",
      codeFg: "#282828",
      codeInlineBg: "#f5f5f5",
      codeInlineFg: "#282828",
      linkColor: "#ff6719",
      tableHeaderBg: "#fafafa",
      tableBorder: "#e5e5e5",
      fontTitle: GEORGIA_STACK,
      fontBody: GEORGIA_STACK,
      fontCode: MONO_STACK,
      bodySize: "16px",
      lineHeight: "2.0",
      paragraphSpacing: "1.5em",
      h1Style: "plain",
      h2Style: "plain",
    },
  },
  {
    id: "weread",
    name: "微信读书",
    tagline: "暖纸色底·阅读器质感·护眼",
    swatch: ["#3b3b3b", "#c49b6c", "#f5edd6"],
    isDark: false,
    category: "style",
    tokens: {
      bg: "#f5edd6",
      fg: "#3b3b3b",
      fgMuted: "#7a7468",
      border: "#e0d5be",
      accent: "#c49b6c",
      accentSoft: "#f0e6cf",
      h1Color: "#2b2b2b",
      h2Color: "#3b3b3b",
      h3Color: "#4b4b4b",
      quoteBg: "#efe5cd",
      quoteFg: "#5a5347",
      quoteBar: "#c49b6c",
      codeBg: "#2b2b2b",
      codeFg: "#e0d5be",
      codeInlineBg: "#efe5cd",
      codeInlineFg: "#7a5c30",
      linkColor: "#c49b6c",
      tableHeaderBg: "#efe5cd",
      tableBorder: "#e0d5be",
      fontTitle: CN_SERIF_STACK,
      fontBody: CN_SERIF_STACK,
      fontCode: MONO_STACK,
      bodySize: "15px",
      lineHeight: "2.0",
      paragraphSpacing: "1.5em",
      h1Style: "centerOrnament",
      h2Style: "plain",
    },
  },
  {
    id: "brutalist",
    name: "Brutalist",
    tagline: "反设计·粗体大字·高对比·观点输出",
    swatch: ["#000000", "#ff0000", "#ffffff"],
    isDark: false,
    category: "style",
    tokens: {
      bg: "#ffffff",
      fg: "#000000",
      fgMuted: "#555555",
      border: "#000000",
      accent: "#ff0000",
      accentSoft: "#fff0f0",
      h1Color: "#000000",
      h2Color: "#000000",
      h3Color: "#000000",
      quoteBg: "#f0f0f0",
      quoteFg: "#000000",
      quoteBar: "#ff0000",
      codeBg: "#000000",
      codeFg: "#00ff00",
      codeInlineBg: "#f0f0f0",
      codeInlineFg: "#000000",
      linkColor: "#ff0000",
      tableHeaderBg: "#000000",
      tableBorder: "#000000",
      fontTitle: SYSTEM_STACK,
      fontBody: SYSTEM_STACK,
      fontCode: MONO_STACK,
      bodySize: "15px",
      lineHeight: "1.7",
      paragraphSpacing: "1.3em",
      h1Style: "barLeft",
      h2Style: "underline",
    },
  },
  {
    id: "muji",
    name: "Muji",
    tagline: "无印风·极简留白·灰调·呼吸感",
    swatch: ["#4a4a4a", "#b0a090", "#f8f7f5"],
    isDark: false,
    category: "style",
    tokens: {
      bg: "#f8f7f5",
      fg: "#4a4a4a",
      fgMuted: "#9a9590",
      border: "#e8e4df",
      accent: "#b0a090",
      accentSoft: "#f2efeb",
      h1Color: "#3a3a3a",
      h2Color: "#4a4a4a",
      h3Color: "#5a5a5a",
      quoteBg: "#f2efeb",
      quoteFg: "#7a7570",
      quoteBar: "#c8c0b8",
      codeBg: "#eae6e1",
      codeFg: "#4a4a4a",
      codeInlineBg: "#eae6e1",
      codeInlineFg: "#4a4a4a",
      linkColor: "#8a7a6a",
      tableHeaderBg: "#f2efeb",
      tableBorder: "#e8e4df",
      fontTitle: CN_FONT_STACK,
      fontBody: CN_FONT_STACK,
      fontCode: MONO_STACK,
      bodySize: "14px",
      lineHeight: "2.1",
      paragraphSpacing: "1.8em",
      h1Style: "plain",
      h2Style: "plain",
    },
  },
];

/**
 * Default tokens used as the base for the custom theme.
 * Matches the "mist" palette — neutral starting point.
 */
export const DEFAULT_CUSTOM_TOKENS: ThemeTokens = {
  ...THEMES.find((t) => t.id === "mist")!.tokens,
};

/**
 * Build a custom ArticleTheme from user-supplied tokens.
 */
export function buildCustomTheme(tokens: ThemeTokens): ArticleTheme {
  return {
    id: "custom",
    name: "自定义",
    tagline: "自定义配色与排版",
    swatch: [tokens.accent, tokens.fg, tokens.bg],
    isDark: isColorDark(tokens.bg),
    category: "style",
    tokens,
  };
}

export function getTheme(id: ThemeId, customTokens?: ThemeTokens): ArticleTheme {
  if (id === "custom" && customTokens) {
    return buildCustomTheme(customTokens);
  }
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

/** Simple luminance check for swatch rendering. */
function isColorDark(hex: string): boolean {
  const c = hex.replace("#", "");
  if (c.length < 6) return false;
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 < 128;
}
