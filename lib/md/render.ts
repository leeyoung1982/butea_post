import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import remarkRehype from "remark-rehype";
import rehypeRaw from "rehype-raw";
import rehypeHighlight from "rehype-highlight";
import rehypeStringify from "rehype-stringify";
import type { ArticleTheme } from "@/lib/themes/themes";
import { resolveMediaInMarkdown } from "@/lib/media/store";

/**
 * Render markdown to HTML. Returns the inner HTML (without the root wrapper)
 * and the theme CSS string. The caller can:
 *   - Inject CSS into a <style> tag and wrap the HTML in a `.preview-root` div for live preview
 *   - Or pass both to inlineForWeChat() to get a paste-ready WeChat HTML string
 */
export async function renderMarkdown(
  markdown: string,
  theme: ArticleTheme
): Promise<{ html: string; css: string }> {
  // Substitute butea-media://<id> with blob: URLs before MD parsing, so the
  // resulting <img src="..."> points at usable browser-scoped data.
  let resolved = markdown || "";
  if (typeof window !== "undefined") {
    try {
      resolved = await resolveMediaInMarkdown(resolved);
    } catch {
      // If IndexedDB isn't available (e.g. private mode) just leave the
      // butea-media URLs in place; <img> will simply not load.
    }
  }

  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkBreaks)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeHighlight, { detect: true, ignoreMissing: true })
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process(resolved);

  let html = String(file);
  html = applyHeadingFlair(html, theme);
  html = applyAdmonitions(html, theme);
  html = applyCodeBlockLanguageBadges(html, theme);
  html = applyImageSuggestionHints(html, theme);
  html = applyImageCaptions(html);
  const css = buildThemeCss(theme);
  return { html, css };
}

/**
 * Promote images to `<figure>` blocks with captions. Two sources:
 *
 *   1. **alt text** — when the user has written meaningful alt text on
 *      `![alt](url)`, render it as a caption below the image
 *   2. **italic next-line** — if the paragraph immediately after the image
 *      is a sole italic (`*caption*`), treat that as the caption and
 *      *remove* the italic paragraph (so it doesn't render twice)
 *
 * Generic alts ("image", "img", "图片", filenames) are skipped. Images
 * that share a paragraph with other text are left alone — captions only
 * apply to images on their own block.
 */
function applyImageCaptions(html: string): string {
  // Fast-path: skip the DOMParser cost entirely when there's no image
  // (the common case for short drafts and outline-only docs).
  if (!/<img\b/i.test(html)) return html;
  if (typeof document === "undefined") return html;
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${html}</div>`, "text/html");
  const root = doc.body.firstElementChild;
  if (!root) return html;

  const placeholderAlts = new Set(["image", "img", "picture", "图片", ""]);
  const ps = Array.from(root.querySelectorAll("p"));
  for (const p of ps) {
    const text = (p.textContent ?? "").trim();
    const imgs = p.querySelectorAll("img");
    if (imgs.length !== 1) continue;
    if (text.length > 0) continue; // image has surrounding text — skip

    const img = imgs[0];
    const alt = (img.getAttribute("alt") ?? "").trim();

    // Mode 3: italic-only next paragraph
    let caption: string | null = null;
    const next = p.nextElementSibling;
    if (next && next.tagName === "P") {
      const ems = next.querySelectorAll("em");
      if (
        next.children.length === 1 &&
        ems.length === 1 &&
        (next.textContent ?? "").trim() === (ems[0].textContent ?? "").trim()
      ) {
        caption = (ems[0].textContent ?? "").trim();
        next.remove();
      }
    }

    // Mode 1: alt as caption (skip placeholder / generic values)
    if (!caption && !placeholderAlts.has(alt.toLowerCase())) {
      // Skip alts that look like filenames (e.g. "IMG_1234", "screenshot.png")
      const looksLikeFilename = /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(alt) ||
        /^(img|dsc|screen[\s-]?shot)[\s_-]?\d+/i.test(alt);
      if (!looksLikeFilename) caption = alt;
    }

    if (caption) {
      // Use a wrapping div with the same semantics as <figure> — div is
      // more universally accepted by publishing platforms' sanitizers.
      const fig = doc.createElement("div");
      fig.setAttribute("data-butea-figure", "true");
      fig.setAttribute(
        "style",
        "margin:1.4em 0;text-align:center;"
      );
      while (p.firstChild) fig.appendChild(p.firstChild);
      const cap = doc.createElement("div");
      cap.setAttribute("data-butea-figcaption", "true");
      cap.setAttribute(
        "style",
        "margin-top:0.6em;font-style:italic;font-size:0.88em;color:#888;text-align:center;line-height:1.5;"
      );
      cap.textContent = caption;
      fig.appendChild(cap);
      p.replaceWith(fig);
    }
  }

  return root.innerHTML;
}

/**
 * Render `> [!info]` style callouts (Obsidian/GitHub syntax) as styled
 * admonition boxes. We post-process the rendered HTML because doing it via
 * a remark plugin would be heavier; the regex is targeted enough.
 */
function applyAdmonitions(html: string, theme: ArticleTheme): string {
  // Matches blockquote whose first paragraph starts with [!TYPE]
  // e.g. <blockquote>\n<p>[!info]\nHello</p>\n</blockquote>
  const t = theme.tokens;
  const palette: Record<string, { bg: string; bar: string; fg: string; label: string; icon: string }> = {
    note: { bg: t.accentSoft, bar: t.accent, fg: t.fg, label: "Note", icon: "📝" },
    info: { bg: "#EFF6FF", bar: "#3B82F6", fg: "#1E3A8A", label: "Info", icon: "ℹ️" },
    tip: { bg: "#F0FDF4", bar: "#22C55E", fg: "#14532D", label: "Tip", icon: "💡" },
    warning: { bg: "#FFFBEB", bar: "#F59E0B", fg: "#78350F", label: "Warning", icon: "⚠️" },
    danger: { bg: "#FEF2F2", bar: "#EF4444", fg: "#7F1D1D", label: "Danger", icon: "🛑" },
    quote: { bg: t.quoteBg, bar: t.quoteBar, fg: t.quoteFg, label: "Quote", icon: "❝" },
  };
  return html.replace(
    /<blockquote>\s*<p>\[!(\w+)\][^\n<]*([\s\S]*?)<\/blockquote>/gi,
    (_m, kindRaw: string, rest: string) => {
      const kind = kindRaw.toLowerCase();
      const p = palette[kind] ?? palette.note;
      // Strip the leading "[!info]" token from the first paragraph's content
      const cleaned = rest.replace(/^\s*[^\n<]*/, "").trim();
      return `<aside data-admonition="${kind}" style="background:${p.bg};border-left:4px solid ${p.bar};color:${p.fg};padding:12px 16px;border-radius:0 6px 6px 0;margin:1.4em 0;">
        <div style="font-weight:600;font-size:0.85em;letter-spacing:0.05em;margin-bottom:0.5em;text-transform:uppercase;color:${p.bar};">${p.icon}&nbsp;${p.label}</div>
        ${cleaned}
      </aside>`;
    }
  );
}

/**
 * Decorate <pre><code class="language-X"> blocks with:
 *   - A small language label in the TOP-LEFT
 *   - A copy-to-clipboard button in the TOP-RIGHT
 * Padding-top is added to <pre> so content doesn't collide with the chrome.
 */
function applyCodeBlockLanguageBadges(html: string, _theme: ArticleTheme): string {
  return html.replace(
    /<pre><code class="(hljs language-([^"]+))">/g,
    (_m, fullClass, lang) =>
      `<pre data-lang="${lang}" style="position:relative;padding-top:30px !important;">` +
      `<span style="position:absolute;top:8px;left:12px;font-size:0.7em;font-family:inherit;text-transform:uppercase;letter-spacing:0.08em;opacity:0.55;font-weight:600;">${lang}</span>` +
      `<button data-copy-code aria-label="复制代码" style="position:absolute;top:6px;right:8px;background:transparent;border:1px solid rgba(255,255,255,0.15);color:inherit;opacity:0.5;font-size:0.7em;padding:2px 8px;border-radius:4px;cursor:pointer;transition:opacity 0.15s;">复制</button>` +
      `<code class="${fullClass}">`
  );
}

/**
 * Render `<!-- 📸 配图建议：... -->` markers (emitted by the body-generation
 * skill) as a subtle hint card so the user can see *where* the AI thinks
 * an image would help, without the marker bleeding into the published copy.
 * On WeChat export these become regular HTML and degrade gracefully.
 */
function applyImageSuggestionHints(html: string, theme: ArticleTheme): string {
  const t = theme.tokens;
  return html.replace(
    /<!--\s*📸\s*配图建议[：:]\s*([\s\S]*?)-->/g,
    (_m, text) =>
      `<aside data-image-hint="true" style="border:1px dashed ${t.border};color:${t.fgMuted};font-size:0.85em;padding:8px 12px;border-radius:6px;margin:1em 0;background:${t.accentSoft};">
        <span style="font-weight:600;margin-right:6px;">📸 配图建议</span>
        ${text.trim()}
      </aside>`
  );
}

/**
 * Decorate h1/h2 text with ornament characters/numbers when the theme requests it.
 * Done as plain text substitution because pseudo-elements don't survive WeChat's
 * sanitizer.
 */
function applyHeadingFlair(html: string, theme: ArticleTheme): string {
  const { h1Style, h2Style } = theme.tokens;

  if (h1Style === "centerOrnament") {
    html = html.replace(
      /<h1>([\s\S]*?)<\/h1>/g,
      (_m, inner) => `<h1>✦&nbsp;&nbsp;${inner}&nbsp;&nbsp;✦</h1>`
    );
  }

  if (h2Style === "numbered") {
    let n = 0;
    html = html.replace(/<h2>([\s\S]*?)<\/h2>/g, (_m, inner) => {
      n += 1;
      const num = String(n).padStart(2, "0");
      return `<h2><span class="h2-number">${num}</span>${inner}</h2>`;
    });
  }

  return html;
}

/**
 * Build a CSS string with selectors scoped to `.preview-root`. The selectors
 * are intentionally simple (single class or tag selectors) so juice can inline
 * them onto every matching element when exporting.
 */
export function buildThemeCss(theme: ArticleTheme): string {
  const t = theme.tokens;

  const h1Flair = (() => {
    switch (t.h1Style) {
      case "underline":
        return `border-bottom:2px solid ${t.accent};padding-bottom:0.35em;`;
      case "barLeft":
        return `border-left:4px solid ${t.accent};padding-left:14px;`;
      case "centerOrnament":
        return `text-align:center;letter-spacing:0.05em;`;
      default:
        return "";
    }
  })();

  const h2Flair = (() => {
    switch (t.h2Style) {
      case "underline":
        return `border-bottom:1px solid ${t.border};padding-bottom:0.25em;`;
      case "barLeft":
        return `border-left:4px solid ${t.accent};padding-left:12px;`;
      case "ribbon":
        return `display:inline-block;background:${t.accent};color:#fff;padding:6px 14px;border-radius:4px;`;
      case "numbered":
        return ``;
      default:
        return "";
    }
  })();

  return `
.preview-root {
  background: ${t.bg};
  color: ${t.fg};
  font-family: ${t.fontBody};
  font-size: ${t.bodySize};
  line-height: ${t.lineHeight};
  padding: 32px 28px;
  max-width: 100%;
  word-wrap: break-word;
}
.preview-root h1 {
  font-family: ${t.fontTitle};
  font-size: 1.7em;
  font-weight: 700;
  color: ${t.h1Color};
  margin: 1.5em 0 0.8em;
  line-height: 1.4;
  ${h1Flair}
}
.preview-root h2 {
  font-family: ${t.fontTitle};
  font-size: 1.35em;
  font-weight: 700;
  color: ${t.h2Color};
  margin: 1.6em 0 0.7em;
  line-height: 1.4;
  ${h2Flair}
}
.preview-root h2 .h2-number {
  display: inline-block;
  margin-right: 10px;
  color: ${t.accent};
  font-family: ${t.fontCode};
  font-weight: 600;
  font-size: 0.85em;
  letter-spacing: 0.05em;
}
.preview-root h3 {
  font-family: ${t.fontTitle};
  font-size: 1.12em;
  font-weight: 600;
  color: ${t.h3Color};
  margin: 1.4em 0 0.6em;
}
.preview-root h4,
.preview-root h5,
.preview-root h6 {
  font-family: ${t.fontTitle};
  font-weight: 600;
  color: ${t.fg};
  margin: 1.2em 0 0.5em;
}
.preview-root p {
  margin: 0 0 ${t.paragraphSpacing};
  line-height: ${t.lineHeight};
  letter-spacing: 0.02em;
}
.preview-root a {
  color: ${t.linkColor};
  text-decoration: none;
  border-bottom: 1px solid ${t.linkColor}40;
}
.preview-root strong {
  color: ${t.fg};
  font-weight: 700;
}
.preview-root em {
  font-style: italic;
}
.preview-root blockquote {
  margin: 1.4em 0;
  padding: 14px 18px;
  background: ${t.quoteBg};
  color: ${t.quoteFg};
  border-left: 3px solid ${t.quoteBar};
  border-radius: 0 4px 4px 0;
  font-size: 0.95em;
}
.preview-root blockquote p {
  margin: 0;
}
.preview-root blockquote p + p {
  margin-top: 0.6em;
}
.preview-root ul,
.preview-root ol {
  margin: 0 0 ${t.paragraphSpacing};
  padding-left: 1.5em;
  line-height: ${t.lineHeight};
}
.preview-root li {
  margin: 0.4em 0;
}
.preview-root li > p {
  margin: 0;
}
.preview-root hr {
  height: 1px;
  border: none;
  background: ${t.border};
  margin: 2em 0;
}
.preview-root code {
  background: ${t.codeInlineBg};
  color: ${t.codeInlineFg};
  padding: 0.15em 0.4em;
  border-radius: 3px;
  font-family: ${t.fontCode};
  font-size: 0.9em;
}
.preview-root pre {
  background: ${t.codeBg};
  color: ${t.codeFg};
  padding: 16px 18px;
  border-radius: 6px;
  overflow-x: auto;
  margin: 1.4em 0;
  font-size: 0.9em;
  line-height: 1.6;
}
.preview-root pre code {
  background: transparent;
  color: inherit;
  padding: 0;
  border-radius: 0;
  font-size: 1em;
}
.preview-root table {
  width: 100%;
  border-collapse: collapse;
  margin: 1.4em 0;
  font-size: 0.92em;
}
.preview-root th {
  background: ${t.tableHeaderBg};
  color: ${t.fg};
  padding: 10px 12px;
  border: 1px solid ${t.tableBorder};
  font-weight: 600;
  text-align: left;
}
.preview-root td {
  padding: 10px 12px;
  border: 1px solid ${t.tableBorder};
}
.preview-root img {
  max-width: 100%;
  height: auto;
  margin: 1em 0;
}
`.trim();
}
