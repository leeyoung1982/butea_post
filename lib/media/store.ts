"use client";

/**
 * Local media library backed by IndexedDB.
 *
 * The markdown source only ever holds a short reference like
 * `butea-media://abc-123-…`. The real binary lives in IndexedDB. At render
 * time, the renderer asks `resolveBlobUrlSync` for an in-memory `blob:`
 * URL (or a placeholder if not yet hydrated).
 *
 * Why not base64 inline? Three reasons:
 *   1. Markdown becomes huge and slow to edit in CodeMirror.
 *   2. Most publish targets (notably WeChat) strip `data:` URLs from <img>.
 *   3. Copy / paste of the canonical draft elsewhere stays human-readable.
 */

export const MEDIA_URL_PREFIX = "butea-media://";

export type MediaRecord = {
  id: string;
  name: string;
  mime: string;
  size: number;
  createdAt: number;
  blob: Blob;
};

const DB_NAME = "butea-media";
const STORE = "files";
const VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("media store only available in the browser"));
  }
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

export async function saveMedia(blob: Blob, name: string): Promise<MediaRecord> {
  const db = await openDb();
  const id = crypto.randomUUID();
  const record: MediaRecord = {
    id,
    name,
    mime: blob.type || "application/octet-stream",
    size: blob.size,
    createdAt: Date.now(),
    blob,
  };
  await idbPut(db, record);
  // Pre-warm blob URL cache so the next render is instant. touchCache
  // enforces the LRU cap; defined below but hoisted so safe to call here.
  touchCache(id, URL.createObjectURL(blob));
  return record;
}

export async function getMedia(id: string): Promise<MediaRecord | null> {
  const db = await openDb();
  return idbGet<MediaRecord>(db, id);
}

export async function listMedia(): Promise<MediaRecord[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result as MediaRecord[]);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Overwrite an existing media record's binary while preserving its id. Used
 * by the image editor's "覆盖原图" path so that any existing
 * `butea-media://<id>` references in the user's markdown keep resolving
 * after the edit. The blob URL cache is invalidated so the next
 * resolveBlobUrl() call mints a fresh object URL for the new bytes.
 */
export async function updateMediaInPlace(
  id: string,
  blob: Blob,
  name?: string
): Promise<MediaRecord> {
  const existing = await getMedia(id);
  if (!existing) throw new Error(`media ${id} not found`);
  const db = await openDb();
  const updated: MediaRecord = {
    ...existing,
    name: name ?? existing.name,
    blob,
    size: blob.size,
    mime: blob.type || existing.mime,
  };
  await idbPut(db, updated);
  const cached = blobUrlCache.get(id);
  if (cached) {
    URL.revokeObjectURL(cached);
    blobUrlCache.delete(id);
  }
  return updated;
}

/**
 * One-time seed of a starter asset into IDB with a fixed (deterministic) id,
 * so the welcome doc can reference it as `butea-media://<id>` AND the asset
 * shows up in the Assets panel. Idempotent — if the id already exists, this
 * is a no-op. Best-effort: a failed fetch (offline / 404) silently skips,
 * the welcome doc's image just won't render.
 */
export async function seedStarterAsset(opts: {
  id: string;
  publicUrl: string;
  name: string;
}): Promise<void> {
  if (typeof window === "undefined") return;
  const existing = await getMedia(opts.id).catch(() => null);
  if (existing) return;
  try {
    const res = await fetch(opts.publicUrl);
    if (!res.ok) return;
    const blob = await res.blob();
    const db = await openDb();
    const record: MediaRecord = {
      id: opts.id,
      name: opts.name,
      mime: blob.type || "image/png",
      size: blob.size,
      createdAt: Date.now(),
      blob,
    };
    await idbPut(db, record);
    touchCache(opts.id, URL.createObjectURL(blob));
  } catch {
    // best-effort
  }
}

export async function deleteMedia(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    const cached = blobUrlCache.get(id);
    if (cached) {
      URL.revokeObjectURL(cached);
      blobUrlCache.delete(id);
    }
  });
}

// =====================================================================
// Blob URL cache.
//
// `URL.createObjectURL(blob)` returns a `blob:…` string scoped to the page
// and KEEPS THE UNDERLYING BLOB ALIVE in memory until revoked. A long
// session with hundreds of distinct images would leak memory without an
// upper bound — we use a bounded LRU and revoke the oldest entries.
// =====================================================================

const BLOB_CACHE_CAP = 100;

// JS Map preserves insertion order, so a re-insert on hit gives us LRU
// behavior with one Map and no extra bookkeeping.
const blobUrlCache = new Map<string, string>();

if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    for (const url of blobUrlCache.values()) URL.revokeObjectURL(url);
    blobUrlCache.clear();
  });
}

function touchCache(id: string, url: string): void {
  blobUrlCache.delete(id);
  blobUrlCache.set(id, url);
  while (blobUrlCache.size > BLOB_CACHE_CAP) {
    const oldest = blobUrlCache.keys().next().value;
    if (oldest === undefined) break;
    const oldUrl = blobUrlCache.get(oldest);
    if (oldUrl) URL.revokeObjectURL(oldUrl);
    blobUrlCache.delete(oldest);
  }
}

/** Returns a `blob:` URL for the media, fetching from IndexedDB if necessary. */
export async function resolveBlobUrl(id: string): Promise<string | null> {
  const cached = blobUrlCache.get(id);
  if (cached) {
    touchCache(id, cached); // refresh LRU position
    return cached;
  }
  const record = await getMedia(id);
  if (!record) return null;
  const url = URL.createObjectURL(record.blob);
  touchCache(id, url);
  return url;
}

// =====================================================================
// URL helpers used by markdown rendering.
// =====================================================================

export function mediaIdToMarkdownUrl(id: string): string {
  return MEDIA_URL_PREFIX + id;
}

export function parseMediaUrl(url: string): string | null {
  if (url.startsWith(MEDIA_URL_PREFIX)) return url.slice(MEDIA_URL_PREFIX.length);
  return null;
}

/**
 * Replace every `butea-media://<id>` occurrence in the markdown with a
 * `blob:` URL (resolved from IndexedDB). Unresolved IDs are left as-is.
 */
export async function resolveMediaInMarkdown(md: string): Promise<string> {
  const ids = new Set<string>();
  const re = /butea-media:\/\/([\w-]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(md)) !== null) ids.add(m[1]);
  if (ids.size === 0) return md;

  const urlMap = new Map<string, string>();
  await Promise.all(
    Array.from(ids).map(async (id) => {
      const url = await resolveBlobUrl(id);
      if (url) urlMap.set(id, url);
    })
  );

  return md.replace(/butea-media:\/\/([\w-]+)/g, (full, id) => {
    return urlMap.get(id) ?? full;
  });
}

// =====================================================================
// IndexedDB low-level helpers
// =====================================================================

function idbPut(db: IDBDatabase, value: MediaRecord): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function idbGet<T>(db: IDBDatabase, key: string): Promise<T | null> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve((req.result as T) ?? null);
    req.onerror = () => reject(req.error);
  });
}
