import type { Adapter, AdapterOutput, CanonicalDraft } from "./types";

const SHORT_LIMIT = 140;

/**
 * 微博 adapter.
 *
 * For now we produce a single "short" post by taking the H1 as the hook and
 * the first paragraph or two as supporting text, capped at 140 chars to fit
 * the free-tier limit. Power users can switch to V+ long-text by extending
 * `bodyMax`.
 */
export const weiboAdapter: Adapter = {
  id: "weibo",
  name: "微博",
  description: "钩子 + 短文，自动 hashtag 包裹与字数控制",
  icon: "🟧",
  category: "microblog",
  accent: "#E6162D",
  limits: {
    bodyMax: SHORT_LIMIT,
    note: "普通用户 140 字；微博会员可发长文（暂未实现长文形态）",
  },
  requiresRewrite: true,
  async render(draft: CanonicalDraft): Promise<AdapterOutput> {
    const title = (/^#\s+(.+)$/m.exec(draft.markdown)?.[1] ?? "").trim();
    const firstPara = firstParagraph(draft.markdown);
    const tagPart = (draft.topic ? `#${draft.topic.replace(/\s+/g, "")}# ` : "");
    const head = title ? `【${title}】` : "";
    const raw = `${tagPart}${head}${firstPara}`;
    const text = raw.length > SHORT_LIMIT ? raw.slice(0, SHORT_LIMIT - 1) + "…" : raw;
    const warnings: string[] = [];
    if (raw.length > SHORT_LIMIT) {
      warnings.push(`原内容 ${raw.length} 字，已自动截断到 ${SHORT_LIMIT} 字以内`);
    }
    return {
      kind: "summary",
      text,
      stats: {
        characterCount: text.length,
        warnings: warnings.length ? warnings : undefined,
      },
    };
  },
};

function firstParagraph(md: string): string {
  const body = md
    .replace(/^---[\s\S]*?---/, "")
    .replace(/^#\s+.+$/m, "")
    .replace(/```[\s\S]*?```/g, "");
  const para = body.split(/\n\n+/).find((p) => p.trim()) ?? "";
  return para.replace(/^[#>\-*]\s*/, "").replace(/[*_~`]+/g, "").trim();
}
