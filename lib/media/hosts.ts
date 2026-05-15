"use client";

/**
 * Image hosting providers. Each one takes a Blob and returns a public URL.
 * BYOK across the board — Butea never holds host credentials.
 */

import { getMedia, MEDIA_URL_PREFIX } from "./store";

export type HostId = "imgur" | "github";

export type ImgurConfig = {
  hostId: "imgur";
  clientId: string; // user-provided Imgur Client ID (free)
};

export type GitHubConfig = {
  hostId: "github";
  token: string; // Personal Access Token with repo scope
  owner: string;
  repo: string;
  branch: string;
  pathPrefix: string; // e.g. "images/butea/"
};

export type HostConfig = ImgurConfig | GitHubConfig;

const STORAGE_KEY = "butea:image-host";

export function loadHostConfig(): HostConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as HostConfig) : null;
  } catch {
    return null;
  }
}

export function saveHostConfig(c: HostConfig) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(c));
}

export function clearHostConfig() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}

// ---------- Cache: media-id → public URL (avoids re-uploads) ----------

const UPLOADED_KEY = "butea:image-host-uploads";

type UploadCache = Record<string, { url: string; hostId: HostId; at: number }>;

function loadUploadCache(): UploadCache {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(UPLOADED_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveUploadCache(c: UploadCache) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(UPLOADED_KEY, JSON.stringify(c));
}

export function getUploadedUrl(mediaId: string, hostId?: HostId): string | null {
  const cache = loadUploadCache();
  const entry = cache[mediaId];
  if (!entry) return null;
  if (hostId && entry.hostId !== hostId) return null;
  return entry.url;
}

function rememberUpload(mediaId: string, url: string, hostId: HostId) {
  const cache = loadUploadCache();
  cache[mediaId] = { url, hostId, at: Date.now() };
  saveUploadCache(cache);
}

// ---------- Provider implementations ----------

/** Imgur anonymous upload — needs only a free Client ID (no OAuth). */
async function uploadToImgur(cfg: ImgurConfig, blob: Blob): Promise<string> {
  const body = new FormData();
  body.append("image", blob);
  const res = await fetch("https://api.imgur.com/3/image", {
    method: "POST",
    headers: { Authorization: `Client-ID ${cfg.clientId}` },
    body,
  });
  // Imgur returns HTTP 200 + {success:false} for quota/auth issues, so we
  // check the JSON body's success flag rather than relying on res.ok alone.
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.success) {
    const err = data?.data?.error?.message || data?.data?.error || data?.message;
    throw new Error(
      `Imgur 上传失败 (${res.status}): ${err || res.statusText || "未知错误"}`
    );
  }
  if (!data?.data?.link) throw new Error("Imgur 返回缺少 link");
  return data.data.link as string;
}

/** GitHub upload — PUT to contents API of a repo, returns raw.githubusercontent URL. */
async function uploadToGitHub(cfg: GitHubConfig, blob: Blob, name: string): Promise<string> {
  const base64 = await blobToBase64(blob);
  const safeName = name.replace(/[^\w.\-]/g, "_");
  // Date.now() alone collides when multiple uploads fire within the same ms
  // (batch upload of N images); add a short random suffix.
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const path = `${cfg.pathPrefix.replace(/\/$/, "")}/${stamp}-${safeName}`;
  const url = `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${encodeURIComponent(path)}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `token ${cfg.token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: `butea: upload ${safeName}`,
      content: base64,
      branch: cfg.branch || "main",
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`GitHub 上传失败: ${res.status} ${text}`);
  }
  return `https://raw.githubusercontent.com/${cfg.owner}/${cfg.repo}/${cfg.branch || "main"}/${path}`;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const result = r.result as string;
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

// ---------- Public API ----------

export async function uploadOne(mediaId: string): Promise<string> {
  const cfg = loadHostConfig();
  if (!cfg) throw new Error("尚未配置图床 — 请在「发布」面板选择并填入");
  const cached = getUploadedUrl(mediaId, cfg.hostId);
  if (cached) return cached;

  const record = await getMedia(mediaId);
  if (!record) throw new Error(`找不到媒体 ${mediaId}`);

  let url: string;
  if (cfg.hostId === "imgur") url = await uploadToImgur(cfg, record.blob);
  else url = await uploadToGitHub(cfg, record.blob, record.name);

  rememberUpload(mediaId, url, cfg.hostId);
  return url;
}

/**
 * Replace every butea-media:// reference in the given markdown with the
 * uploaded public URL. Uploads what's missing from the cache.
 */
export async function uploadAllInMarkdown(
  md: string,
  onProgress?: (done: number, total: number, currentName?: string) => void
): Promise<{ markdown: string; uploaded: number; failed: { id: string; error: string }[] }> {
  const cfg = loadHostConfig();
  if (!cfg) throw new Error("尚未配置图床");

  const ids = new Set<string>();
  const re = new RegExp(`${escapeRegex(MEDIA_URL_PREFIX)}([\\w-]+)`, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(md)) !== null) ids.add(m[1]);

  const total = ids.size;
  if (total === 0) return { markdown: md, uploaded: 0, failed: [] };

  const urlMap = new Map<string, string>();
  const failed: { id: string; error: string }[] = [];
  let done = 0;

  for (const id of ids) {
    try {
      const url = await uploadOne(id);
      urlMap.set(id, url);
    } catch (e) {
      failed.push({ id, error: (e as Error).message });
    }
    done++;
    onProgress?.(done, total, id.slice(0, 8));
  }

  const newMd = md.replace(re, (full, id) => urlMap.get(id) ?? full);
  return { markdown: newMd, uploaded: urlMap.size, failed };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
