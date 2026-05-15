// =====================================================================
// Platform Adapter contract.
//
// Each platform we publish to is implemented as one file under
// `lib/adapters/<platform>.ts`. To add a new platform, copy any existing
// adapter file and replace its `transform` / `render` / `exportPayload`
// functions. The UI auto-discovers all adapters via `index.ts`.
// =====================================================================

import type { ArticleTheme } from "@/lib/themes/themes";

export type PlatformId =
  | "wechat"
  | "blog"
  | "x-thread"
  | "x-longform"
  | "xiaohongshu"
  | "weibo"
  | "moments";

export type PlatformCategory =
  | "longform" // 长文：公众号 / X long / Substack / Medium / Ghost
  | "thread" // 串：X thread / 微博长串
  | "visual" // 视觉：小红书 / IG
  | "microblog" // 短帖：微博 / Mastodon / Bluesky
  | "summary"; // 摘要 + 卡片：朋友圈

export type CanonicalDraft = {
  /** The source markdown the user is editing. */
  markdown: string;
  /** Extracted title (the first `# H1`) or user-set. */
  title?: string;
  /** Optional context the user provides via the AI panel. */
  topic?: string;
  audience?: string;
};

/** Discriminated union of every form an adapter might emit. */
export type AdapterOutput =
  | {
      kind: "html";
      /** Full inline-styled HTML safe to paste into target platform. */
      html: string;
      /** Optional `<style>` payload for live preview only (not exported). */
      previewCss?: string;
      stats?: OutputStats;
    }
  | {
      kind: "thread";
      /** Ordered list of posts in the thread. */
      posts: ThreadPost[];
      stats?: OutputStats;
    }
  | {
      kind: "cards";
      /** Image-card sequence (Xiaohongshu). */
      title: string;
      tags: string[];
      cards: VisualCard[];
      body: string;
      stats?: OutputStats;
    }
  | {
      kind: "summary";
      /** Short summary (朋友圈 / 微博). */
      text: string;
      link?: string;
      stats?: OutputStats;
    };

export type ThreadPost = {
  index: number;
  text: string;
  charCount: number;
  overLimit: boolean;
};

export type VisualCard = {
  /** Card index (1-based) */
  n: number;
  /** Short headline for the card */
  headline: string;
  /** Body text shown on the card */
  body: string;
};

export type OutputStats = {
  characterCount: number;
  paragraphCount?: number;
  warnings?: string[];
};

export type Adapter = {
  id: PlatformId;
  /** Display name in tabs. */
  name: string;
  /** One-line description shown on hover. */
  description: string;
  /** Lucide icon name OR emoji. */
  icon: string;
  /** Category for sorting & filtering. */
  category: PlatformCategory;
  /** Hex accent color for tab indicator. */
  accent: string;
  /**
   * Render the canonical draft into platform-native output.
   * Theme is only meaningful for HTML-producing adapters.
   */
  render(draft: CanonicalDraft, theme: ArticleTheme): Promise<AdapterOutput>;
  /** Hard character limits and any platform-specific notes. */
  limits: {
    bodyMax?: number;
    titleMax?: number;
    perPostMax?: number; // for thread adapters
    mediaMax?: number;
    note?: string;
  };
  /**
   * Whether this platform meaningfully benefits from an AI *rewrite* of the
   * source draft. Long-form platforms (公众号 / X long-form / blogs) should
   * use the user's prose as-is — only structure/format. Short-form
   * platforms (小红书 / X thread / 微博 / 朋友圈) need the LLM to actually
   * restructure and condense, because their constraints fundamentally
   * change the content shape.
   *
   * When false, the platform self-adapt button skips the LLM call and the
   * adapter just renders the source markdown directly.
   */
  requiresRewrite: boolean;
};
