"use client";

/**
 * Document library backed by IndexedDB.
 *
 * Two object stores:
 *   - `documents`  active docs the user is working on
 *   - `trash`      deleted docs, purged after TRASH_TTL_DAYS
 *
 * The Zustand store keeps the *active* doc's content in memory (so the
 * editor stays synchronous); this module is the persistent ground truth.
 */

import {
  type ButeaDocument,
  type DocumentSource,
  type TrashedDocument,
  TRASH_TTL_DAYS,
  MAX_SNAPSHOTS_PER_DOC,
} from "./types";

const DB_NAME = "butea-docs";
const STORE_DOCS = "documents";
const STORE_TRASH = "trash";
const VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("doc store is browser-only"));
  }
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_DOCS)) {
        db.createObjectStore(STORE_DOCS, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_TRASH)) {
        db.createObjectStore(STORE_TRASH, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

// ====================================================================
// Documents (active)
// ====================================================================

export async function listDocuments(): Promise<ButeaDocument[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_DOCS, "readonly");
    const req = tx.objectStore(STORE_DOCS).getAll();
    req.onsuccess = () => {
      const all = (req.result as ButeaDocument[]) ?? [];
      all.sort((a, b) => b.updatedAt - a.updatedAt);
      resolve(all);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getDocument(id: string): Promise<ButeaDocument | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_DOCS, "readonly");
    const req = tx.objectStore(STORE_DOCS).get(id);
    req.onsuccess = () => resolve((req.result as ButeaDocument) ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function putDocument(doc: ButeaDocument): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_DOCS, "readwrite");
    tx.objectStore(STORE_DOCS).put(doc);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function createDocument(init: {
  title?: string;
  markdown?: string;
  source?: DocumentSource;
  tags?: string[];
}): Promise<ButeaDocument> {
  const now = Date.now();
  const doc: ButeaDocument = {
    id: crypto.randomUUID(),
    title: init.title ?? "未命名文档",
    markdown: init.markdown ?? "",
    source: init.source ?? { kind: "local" },
    tags: init.tags ?? [],
    createdAt: now,
    updatedAt: now,
    snapshots: [],
  };
  await putDocument(doc);
  return doc;
}

export async function renameDocument(id: string, title: string): Promise<void> {
  const doc = await getDocument(id);
  if (!doc) return;
  doc.title = title.trim() || "未命名文档";
  doc.updatedAt = Date.now();
  await putDocument(doc);
}

export async function setDocumentTags(id: string, tags: string[]): Promise<void> {
  const doc = await getDocument(id);
  if (!doc) return;
  doc.tags = Array.from(new Set(tags.map((t) => t.trim()).filter(Boolean)));
  doc.updatedAt = Date.now();
  await putDocument(doc);
}

/** Append a snapshot to the doc's history. FIFO drops oldest beyond cap. */
export async function snapshotDocument(id: string): Promise<void> {
  const doc = await getDocument(id);
  if (!doc) return;
  doc.snapshots.push({ at: Date.now(), markdown: doc.markdown });
  while (doc.snapshots.length > MAX_SNAPSHOTS_PER_DOC) doc.snapshots.shift();
  doc.updatedAt = Date.now();
  await putDocument(doc);
}

// ====================================================================
// Trash
// ====================================================================

export async function moveToTrash(id: string): Promise<void> {
  const doc = await getDocument(id);
  if (!doc) return;
  const trashed: TrashedDocument = { ...doc, deletedAt: Date.now() };
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORE_DOCS, STORE_TRASH], "readwrite");
    tx.objectStore(STORE_TRASH).put(trashed);
    tx.objectStore(STORE_DOCS).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function restoreFromTrash(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORE_DOCS, STORE_TRASH], "readwrite");
    const getReq = tx.objectStore(STORE_TRASH).get(id);
    getReq.onsuccess = () => {
      const trashed = getReq.result as TrashedDocument | undefined;
      if (!trashed) return;
      const { deletedAt: _deletedAt, ...doc } = trashed;
      tx.objectStore(STORE_DOCS).put({ ...doc, updatedAt: Date.now() });
      tx.objectStore(STORE_TRASH).delete(id);
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function purgeFromTrash(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_TRASH, "readwrite");
    tx.objectStore(STORE_TRASH).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function listTrash(): Promise<TrashedDocument[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_TRASH, "readonly");
    const req = tx.objectStore(STORE_TRASH).getAll();
    req.onsuccess = () => {
      const all = (req.result as TrashedDocument[]) ?? [];
      all.sort((a, b) => b.deletedAt - a.deletedAt);
      resolve(all);
    };
    req.onerror = () => reject(req.error);
  });
}

/** Permanently drop trashed docs older than TRASH_TTL_DAYS. Safe to call
 *  on every app startup. */
export async function purgeExpiredTrash(): Promise<number> {
  const cutoff = Date.now() - TRASH_TTL_DAYS * 24 * 60 * 60 * 1000;
  const all = await listTrash();
  const expired = all.filter((t) => t.deletedAt < cutoff);
  for (const t of expired) await purgeFromTrash(t.id);
  return expired.length;
}
