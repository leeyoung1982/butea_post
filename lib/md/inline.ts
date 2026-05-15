import juice from "juice";
import type { ArticleTheme } from "@/lib/themes/themes";
import { buildThemeCss, renderMarkdown } from "./render";

/**
 * Convert markdown directly to a WeChat-ready HTML string with all styles
 * inlined onto the elements. The result is safe to paste into the WeChat
 * Official Account back-office editor.
 */
export async function markdownToWeChatHtml(
  markdown: string,
  theme: ArticleTheme
): Promise<string> {
  const { html, css } = await renderMarkdown(markdown, theme);
  return inlineHtmlWithTheme(html, css, theme);
}

export function inlineHtmlWithTheme(
  html: string,
  css: string,
  theme: ArticleTheme
): string {
  // Juice expects a single document — wrap in the .preview-root container so
  // selectors match.
  const wrapped = `<section class="preview-root">${html}</section>`;
  const composed = `<style>${css}</style>${wrapped}`;

  const inlined = juice(composed, {
    removeStyleTags: true,
    preserveImportant: true,
    preserveMediaQueries: false,
    preservePseudos: false,
    inlinePseudoElements: false,
    webResources: { images: false, links: false, scripts: false },
  });

  // WeChat strips unknown classes; remove all `class="..."` attributes from
  // the resulting HTML to keep it tidy and tiny.
  const cleaned = inlined
    .replace(/\sclass="[^"]*"/g, "")
    .replace(/<section style="/g, '<section style="background:' + theme.tokens.bg + ';');

  return cleaned;
}

/**
 * Build a `style` string for the live-preview container so the wrapping `<div>`
 * paints the theme background even before children load.
 */
export function previewContainerStyle(theme: ArticleTheme): React.CSSProperties {
  return {
    background: theme.tokens.bg,
    color: theme.tokens.fg,
    fontFamily: theme.tokens.fontBody,
    fontSize: theme.tokens.bodySize,
    lineHeight: theme.tokens.lineHeight,
    minHeight: "100%",
  };
}
