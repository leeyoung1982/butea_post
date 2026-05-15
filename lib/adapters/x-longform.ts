import type { Adapter, AdapterOutput, CanonicalDraft } from "./types";
import type { ArticleTheme } from "@/lib/themes/themes";
import { renderMarkdown } from "@/lib/md/render";
import { inlineHtmlWithTheme } from "@/lib/md/inline";
import { stripHtml } from "@/lib/utils";

const X_PREMIUM_LIMIT = 25_000;

/**
 * X Long-form adapter — renders MD as a full long-form article in X's style:
 * tighter paragraphs, mono-color, no fancy heading flair.
 */
export const xLongformAdapter: Adapter = {
  id: "x-longform",
  name: "X / Long",
  description: "X Premium 长文，25k 字内一条发完",
  icon: "📝",
  category: "longform",
  accent: "#0F172A",
  limits: {
    bodyMax: X_PREMIUM_LIMIT,
    note: "需 X Premium 订阅；最长 25000 字",
  },
  requiresRewrite: false,
  async render(draft: CanonicalDraft, theme: ArticleTheme): Promise<AdapterOutput> {
    // X long-form is closer to a stripped-back blog style; we render with
    // the user's chosen theme but soften the heading flair.
    const xTheme: ArticleTheme = {
      ...theme,
      tokens: {
        ...theme.tokens,
        h1Style: "plain",
        h2Style: "plain",
      },
    };
    const { html, css } = await renderMarkdown(draft.markdown, xTheme);
    const inlined = inlineHtmlWithTheme(html, css, xTheme);
    const charCount = stripHtml(html).length;
    const warnings: string[] = [];
    if (charCount > X_PREMIUM_LIMIT) {
      warnings.push(`超过 X Premium 25k 字限制 (${charCount.toLocaleString()})，需 X 端拆分`);
    }
    return {
      kind: "html",
      html: inlined,
      previewCss: css,
      stats: { characterCount: charCount, warnings: warnings.length ? warnings : undefined },
    };
  },
};

