import type { Adapter, AdapterOutput, CanonicalDraft } from "./types";
import type { ArticleTheme } from "@/lib/themes/themes";
import { renderMarkdown } from "@/lib/md/render";
import { inlineHtmlWithTheme } from "@/lib/md/inline";
import { stripHtml } from "@/lib/utils";

/** 微信公众号 adapter — outputs themed, inline-styled HTML ready to paste. */
export const wechatAdapter: Adapter = {
  id: "wechat",
  name: "公众号",
  description: "微信公众号图文长读，内联样式可直粘后台",
  icon: "📰",
  category: "longform",
  accent: "#22C55E",
  limits: {
    note: "正文不限字数，建议 2000-5000 字；图片需上传到永久素材库换取 media_id",
  },
  requiresRewrite: false,
  async render(draft: CanonicalDraft, theme: ArticleTheme): Promise<AdapterOutput> {
    const { html, css } = await renderMarkdown(draft.markdown, theme);
    const inlined = inlineHtmlWithTheme(html, css, theme);
    const characterCount = stripHtml(html).replace(/\s/g, "").length;
    return {
      kind: "html",
      html: inlined,
      previewCss: css,
      stats: { characterCount },
    };
  },
};

