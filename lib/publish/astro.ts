"use client";

/**
 * Astro blog push — generates a .md file with frontmatter and commits it
 * to the user's Astro blog repo via the GitHub Contents API.
 *
 * Target format matches the standard Astro blog starter:
 *   src/content/blog/<slug>.md
 *   ---
 *   title: "..."
 *   description: "..."
 *   pubDate: "Jun 19 2024"
 *   heroImage: "/path/to/image.jpg"  (optional)
 *   ---
 */

const STORAGE_KEY = "butea:astro-blog";

export type AstroBlogConfig = {
  token: string; // GitHub PAT with repo scope
  owner: string;
  repo: string;
  branch: string; // default "main"
  contentPath: string; // default "src/content/blog"
};

export function loadAstroConfig(): AstroBlogConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AstroBlogConfig) : null;
  } catch {
    return null;
  }
}

export function saveAstroConfig(c: AstroBlogConfig) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(c));
}

export function clearAstroConfig() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}

export type AstroFrontmatter = {
  title: string;
  description: string;
  heroImage?: string;
};

/**
 * Build the full .md content with Astro-compatible frontmatter.
 */
export function buildAstroPost(
  markdown: string,
  frontmatter: AstroFrontmatter
): string {
  const now = new Date();
  const pubDate = now.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const fm = [
    "---",
    `title: "${escapeFm(frontmatter.title)}"`,
    `description: "${escapeFm(frontmatter.description)}"`,
    `pubDate: "${pubDate}"`,
  ];
  if (frontmatter.heroImage) {
    fm.push(`heroImage: "${frontmatter.heroImage}"`);
  }
  fm.push("---");

  // Strip H1 from body if it matches the title (avoid duplicate heading)
  let body = markdown;
  const h1Match = body.match(/^#\s+(.+)\n?/);
  if (h1Match && h1Match[1].trim() === frontmatter.title.trim()) {
    body = body.slice(h1Match[0].length);
  }

  return fm.join("\n") + "\n\n" + body.trim() + "\n";
}

/**
 * Push a post to the Astro blog repo via GitHub Contents API.
 */
export async function pushToAstroBlog(
  config: AstroBlogConfig,
  slug: string,
  content: string
): Promise<{ url: string; sha: string }> {
  const path = `${config.contentPath.replace(/\/$/, "")}/${slug}.md`;
  const apiUrl = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${encodeURIComponent(path)}`;

  // Check if file exists (to get SHA for update)
  let existingSha: string | undefined;
  try {
    const checkRes = await fetch(
      `${apiUrl}?ref=${encodeURIComponent(config.branch)}`,
      {
        headers: {
          Authorization: `token ${config.token}`,
          Accept: "application/vnd.github+json",
        },
      }
    );
    if (checkRes.ok) {
      const data = await checkRes.json();
      existingSha = data.sha;
    }
  } catch {
    // File doesn't exist, that's fine
  }

  const base64Content = btoa(
    new TextEncoder()
      .encode(content)
      .reduce((s, b) => s + String.fromCharCode(b), "")
  );

  const body: Record<string, string> = {
    message: `butea: publish "${slug}"`,
    content: base64Content,
    branch: config.branch || "main",
  };
  if (existingSha) {
    body.sha = existingSha;
  }

  const res = await fetch(apiUrl, {
    method: "PUT",
    headers: {
      Authorization: `token ${config.token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`GitHub push 失败: ${res.status} ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  return {
    url: data.content?.html_url ?? `https://github.com/${config.owner}/${config.repo}/blob/${config.branch}/${path}`,
    sha: data.content?.sha ?? "",
  };
}

/** Generate a URL-safe slug from the title. */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "untitled";
}

function escapeFm(s: string): string {
  return s.replace(/"/g, '\\"');
}
