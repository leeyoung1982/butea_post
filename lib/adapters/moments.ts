import type { Adapter, AdapterOutput, CanonicalDraft } from "./types";

const MOMENT_LIMIT = 200;

/**
 * 微信朋友圈 adapter.
 *
 * No public publishing API exists, so this adapter produces a paste-ready
 * 200-char summary + (optionally) a follow-up "卡片链接" you can grab from
 * the published WeChat article URL. The summary is hook-first, no hashtags.
 */
export const momentsAdapter: Adapter = {
  id: "moments",
  name: "朋友圈",
  description: "200 字钩子摘要 + 文章链接，最高完读引导",
  icon: "🟢",
  category: "summary",
  accent: "#04C160",
  limits: {
    bodyMax: MOMENT_LIMIT,
    note: "朋友圈无开放 API；本工具生成可手动粘贴的摘要 + 链接卡片预览",
  },
  requiresRewrite: true,
  async render(draft: CanonicalDraft): Promise<AdapterOutput> {
    const title = (/^#\s+(.+)$/m.exec(draft.markdown)?.[1] ?? "").trim();
    const hook = firstHook(draft.markdown);
    const composed = title ? `「${title}」\n\n${hook}` : hook;
    const text =
      composed.length > MOMENT_LIMIT
        ? composed.slice(0, MOMENT_LIMIT - 1) + "…"
        : composed;
    return {
      kind: "summary",
      text,
      stats: {
        characterCount: text.length,
        warnings:
          composed.length > MOMENT_LIMIT
            ? [`原内容 ${composed.length} 字，已自动截到 ${MOMENT_LIMIT} 字`]
            : undefined,
      },
    };
  },
};

/** Pull the first 1-2 paragraphs after the H1 as the "hook". */
function firstHook(md: string): string {
  const body = md
    .replace(/^---[\s\S]*?---/, "")
    .replace(/^#\s+.+$/m, "")
    .replace(/```[\s\S]*?```/g, "");
  const paragraphs = body
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  return paragraphs
    .slice(0, 2)
    .join(" ")
    .replace(/^[#>\-*]+\s*/, "")
    .replace(/[*_~`]+/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .trim();
}
