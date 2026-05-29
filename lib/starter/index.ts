/**
 * Starter docs — the 3 example articles seeded on first run.
 *
 * Each entry is one file under this directory. Order in the array determines
 * the order they appear in the document library; DocSync bootstrap creates
 * them with staggered timestamps so the first item lands at the top.
 */

import type { ThemeId, ThemeTokens } from "@/lib/themes/themes";
import * as doc01 from "./01-readme";
import * as doc02 from "./02-features";
import * as doc03 from "./03-markdown";

export type StarterDoc = {
  title: string;
  markdown: string;
  themeId?: ThemeId;
  customThemeTokens?: ThemeTokens | null;
};

export const STARTER_DOCS: StarterDoc[] = [
  // Butea Post readme — 紫矿主题
  { title: doc01.TITLE, markdown: doc01.MARKDOWN, themeId: "butea" },
  // 功能介绍 — 知乎风格
  { title: doc02.TITLE, markdown: doc02.MARKDOWN, themeId: "zhihu" },
  // Markdown 语法 — 雾岚 + 网格纹理 (需要 custom + mist tokens + bgTexture)
  {
    title: doc03.TITLE,
    markdown: doc03.MARKDOWN,
    themeId: "custom",
    customThemeTokens: {
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
      fontTitle: "system-ui, -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif",
      fontBody: "system-ui, -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif",
      fontCode: "'JetBrains Mono', 'Fira Code', Menlo, monospace",
      bodySize: "14px",
      lineHeight: "1.85",
      paragraphSpacing: "1.4em",
      h1Style: "plain",
      h2Style: "barLeft",
      bgTexture: "grid",
    },
  },
];
