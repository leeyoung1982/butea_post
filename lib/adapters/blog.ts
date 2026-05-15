import type { Adapter, AdapterOutput, CanonicalDraft } from "./types";
import type { ArticleTheme } from "@/lib/themes/themes";
import { renderMarkdown } from "@/lib/md/render";
import { inlineHtmlWithTheme } from "@/lib/md/inline";
import { stripHtml } from "@/lib/utils";

/**
 * 博客 / Blog adapter — structured HTML with rich inline styles, designed
 * to be pasted into Substack / Medium / Ghost / WordPress / Hugo and any
 * blog platform that accepts pasted rich text or raw HTML.
 *
 * Differences from the WeChat adapter:
 *   - Keeps semantic class names so a target with custom CSS (Ghost,
 *     Hugo, etc.) can override; WeChat strips them for tidiness
 *   - Preserves a richer set of inline styles (text color / size /
 *     line-height / letter-spacing / text-align) — most blog platforms
 *     accept these
 *   - Does NOT add WeChat-specific decorations (e.g. h2 numbering bars)
 *     unless the active theme requests them
 *
 * Step 1 implementation: reuse the same renderMarkdown pipeline + juice
 * inlining as WeChat, just skip the class-stripping pass. Future steps
 * can introduce a blog-specific theme variant with different typography.
 */
export const blogAdapter: Adapter = {
  id: "blog",
  name: "博客 / Blog",
  description: "结构化 HTML,粘到 Substack / Medium / Ghost / WordPress 都可用",
  icon: "📝",
  category: "longform",
  accent: "#7C3AED",
  limits: {
    note: "适合主流博客平台。粘贴到 Markdown 模式 (Hugo / Jekyll) 的编辑器请用纯 markdown 导出。",
  },
  requiresRewrite: false,
  async render(draft: CanonicalDraft, theme: ArticleTheme): Promise<AdapterOutput> {
    const { html, css } = await renderMarkdown(draft.markdown, theme);
    // Inline styles but preserve class names so blog-platform CSS can
    // override (most platforms accept both, and the inline wins anyway).
    const inlined = inlineHtmlWithTheme(html, css, theme);
    const cleaned = preserveStructure(inlined);
    const characterCount = stripHtml(html).replace(/\s/g, "").length;
    return {
      kind: "html",
      html: cleaned,
      previewCss: css,
      stats: { characterCount },
    };
  },
};

/**
 * Re-introduce semantic class names that the WeChat-targeted juice pass
 * stripped, and wrap the output in an `<article>` rather than `<section>`
 * so blog-platform HTML editors recognize it as the main content block.
 */
function preserveStructure(html: string): string {
  return html.replace(
    /^<section\b/i,
    '<article class="butea-blog-post"'
  ).replace(
    /<\/section>\s*$/i,
    "</article>"
  );
}

