import type {
  Adapter,
  AdapterOutput,
  CanonicalDraft,
  VisualCard,
} from "./types";

const TITLE_MAX = 20;
const BODY_MAX = 1000;
const MAX_CARDS = 9;

/**
 * 小红书 adapter.
 *
 * Strategy: each H2/H3 heading becomes a card; if there are too few headings,
 * paragraphs at the top of the doc are promoted to cards. Title is the H1.
 * Hashtags are extracted from existing `#hashtag` tokens or seeded from the
 * topic field.
 */
export const xiaohongshuAdapter: Adapter = {
  id: "xiaohongshu",
  name: "小红书",
  description: "图卡笔记：H1=标题，每个 H2/H3 化为一张卡，正文 ≤1000 字",
  icon: "📕",
  category: "visual",
  accent: "#FF2442",
  limits: {
    titleMax: TITLE_MAX,
    bodyMax: BODY_MAX,
    mediaMax: 9,
    note: "标题 ≤20 字、正文 ≤1000 字、图片建议 ≤9 张、标签 3-5 个",
  },
  requiresRewrite: true,
  async render(draft: CanonicalDraft): Promise<AdapterOutput> {
    const md = draft.markdown;
    const title = extractTitle(md) || draft.topic || "未命名笔记";
    const cards = extractCards(md);
    const body = composeBody(md);
    const tags = extractOrSeedTags(md, draft.topic);

    const warnings: string[] = [];
    if (title.length > TITLE_MAX) warnings.push(`标题超过 ${TITLE_MAX} 字（当前 ${title.length}）`);
    if (body.length > BODY_MAX) warnings.push(`正文超过 ${BODY_MAX} 字（当前 ${body.length}）`);
    if (cards.length > MAX_CARDS) warnings.push(`卡片超过 ${MAX_CARDS} 张，发布时只保留前 ${MAX_CARDS} 张`);

    return {
      kind: "cards",
      title,
      tags,
      cards: cards.slice(0, MAX_CARDS),
      body,
      stats: {
        characterCount: body.length,
        paragraphCount: cards.length,
        warnings: warnings.length ? warnings : undefined,
      },
    };
  },
};

function extractTitle(md: string): string {
  const m = /^#\s+(.+)$/m.exec(md);
  return m ? m[1].trim() : "";
}

function extractCards(md: string): VisualCard[] {
  const lines = md.split("\n");
  const cards: VisualCard[] = [];
  let currentHeadline: string | null = null;
  let currentBody: string[] = [];

  const push = () => {
    if (currentHeadline) {
      cards.push({
        n: cards.length + 1,
        headline: currentHeadline.slice(0, 18),
        body: currentBody.join("\n").trim().slice(0, 80),
      });
    }
  };

  for (const line of lines) {
    const m = /^(#{2,3})\s+(.+)$/.exec(line);
    if (m) {
      push();
      currentHeadline = m[2].trim();
      currentBody = [];
    } else if (currentHeadline) {
      if (line.trim()) currentBody.push(line);
    }
  }
  push();

  // Fallback: if no H2/H3, take the first paragraphs as cards
  if (cards.length === 0) {
    const paragraphs = md
      .replace(/^---[\s\S]*?---/, "")
      .replace(/^#\s+.+$/m, "")
      .split(/\n\n+/)
      .map((p) => p.trim())
      .filter((p) => p && !p.startsWith("```"));
    for (let i = 0; i < Math.min(paragraphs.length, MAX_CARDS); i++) {
      const text = paragraphs[i].replace(/^[#>\-*]\s*/, "");
      cards.push({
        n: i + 1,
        headline: text.slice(0, 18),
        body: text.slice(0, 80),
      });
    }
  }

  return cards;
}

function composeBody(md: string): string {
  // Strip MD syntax for the body shown under the cards
  return md
    .replace(/^---[\s\S]*?---/, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/^#+\s+/gm, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_~`]+/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractOrSeedTags(md: string, topic?: string): string[] {
  const tags = new Set<string>();
  // hashtags in the doc, e.g. `#副业`
  const re = /(?:^|\s)#([一-龥A-Za-z0-9_]{1,20})(?!\w)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(md)) !== null) tags.add(m[1]);

  // Seed from topic if user provided one
  if (topic && tags.size < 3) {
    topic
      .split(/[,，\s]+/)
      .filter(Boolean)
      .slice(0, 3)
      .forEach((t) => tags.add(t));
  }
  // Generic fallback
  if (tags.size === 0) tags.add("笔记");
  return Array.from(tags).slice(0, 5);
}
