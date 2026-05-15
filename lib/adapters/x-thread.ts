import type {
  Adapter,
  AdapterOutput,
  CanonicalDraft,
  ThreadPost,
} from "./types";

const X_LIMIT = 280;

/**
 * X / Twitter Thread adapter.
 *
 * Splits the markdown into a numbered thread by walking paragraphs and packing
 * sentences into ≤280-char posts. Lists and code blocks get their own posts
 * to keep them readable on the timeline.
 */
export const xThreadAdapter: Adapter = {
  id: "x-thread",
  name: "X / Thread",
  description: "拆成 ≤280 字的连续推文串，首推钩子，末推 CTA",
  icon: "🧵",
  category: "thread",
  accent: "#0F172A",
  limits: {
    perPostMax: X_LIMIT,
    note: "Free tier 单推 280 字；Premium 单推可达 25000 字（用 X Long-form 适配器）",
  },
  requiresRewrite: true,
  async render(draft: CanonicalDraft): Promise<AdapterOutput> {
    const cleaned = stripFrontmatter(draft.markdown);
    const segments = segmentize(cleaned);
    const posts = pack(segments);
    return {
      kind: "thread",
      posts,
      stats: {
        characterCount: cleaned.length,
        paragraphCount: posts.length,
        warnings: posts.filter((p) => p.overLimit).length
          ? [`${posts.filter((p) => p.overLimit).length} 条推文超过 ${X_LIMIT} 字，发布前需手动拆分`]
          : undefined,
      },
    };
  },
};

function stripFrontmatter(md: string): string {
  return md.replace(/^---\n[\s\S]*?\n---\n/, "").trim();
}

/** Split the markdown into "logical units" — paragraphs, list items, code blocks. */
function segmentize(md: string): string[] {
  const lines = md.split("\n");
  const segments: string[] = [];
  let buffer: string[] = [];
  let inCode = false;

  const flush = () => {
    if (buffer.length) {
      const text = buffer.join("\n").trim();
      if (text) segments.push(text);
      buffer = [];
    }
  };

  for (const line of lines) {
    if (line.startsWith("```")) {
      if (inCode) {
        buffer.push(line);
        flush();
        inCode = false;
      } else {
        flush();
        buffer.push(line);
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      buffer.push(line);
      continue;
    }
    if (line.trim() === "") {
      flush();
      continue;
    }
    // Treat each H1/H2 line as its own segment for emphasis
    if (/^#{1,3}\s/.test(line)) {
      flush();
      segments.push(line.replace(/^#+\s+/, "").trim());
      continue;
    }
    // Bullet list items: each becomes a segment to keep them legible
    if (/^[-*+]\s+/.test(line)) {
      flush();
      segments.push("• " + line.replace(/^[-*+]\s+/, "").trim());
      continue;
    }
    buffer.push(line);
  }
  flush();
  return segments;
}

/** Pack segments into ≤280-char posts; long segments stand alone. */
function pack(segments: string[]): ThreadPost[] {
  const posts: ThreadPost[] = [];
  let current = "";
  for (const seg of segments) {
    // A segment that already exceeds limit becomes its own post (over-limit flag set)
    if (seg.length > X_LIMIT) {
      if (current) {
        posts.push(makePost(posts.length + 1, current));
        current = "";
      }
      posts.push(makePost(posts.length + 1, seg));
      continue;
    }
    const candidate = current ? current + "\n\n" + seg : seg;
    if (candidate.length <= X_LIMIT) {
      current = candidate;
    } else {
      posts.push(makePost(posts.length + 1, current));
      current = seg;
    }
  }
  if (current) posts.push(makePost(posts.length + 1, current));

  // Add thread numbering hints in posts >1 for posts that fit
  return posts.map((p, i) => {
    if (posts.length <= 1) return p;
    const prefix = `${i + 1}/${posts.length} `;
    const next = prefix + p.text;
    if (next.length <= X_LIMIT) {
      return { ...p, text: next, charCount: next.length };
    }
    return p;
  });
}

function makePost(index: number, text: string): ThreadPost {
  const t = text.trim();
  return {
    index,
    text: t,
    charCount: t.length,
    overLimit: t.length > X_LIMIT,
  };
}
