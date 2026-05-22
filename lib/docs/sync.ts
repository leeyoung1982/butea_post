"use client";

import * as React from "react";
import { useWorkshop, DEFAULT_MARKDOWN } from "@/lib/store";
import {
  createDocument,
  getDocument,
  listDocuments,
  putDocument,
  purgeExpiredTrash,
} from "./store";
import { seedStarterAsset, deleteMedia } from "@/lib/media/store";
import { STARTER_DOCS } from "@/lib/starter";
import type { ButeaDocument } from "./types";

// Starter media ids — the welcome doc references these as
// `butea-media://<id>`, so they must match exactly.
const STARTER_TREE_ID = "butea-tree";
const STARTER_FLOWER_ID = "butea-flower";

// Stale media ids from earlier versions. The current welcome doc no longer
// references them; if any user doc still does, we rewrite it on bootstrap.
const STALE_IMAGE_IDS: Record<string, string> = {
  // v0.4 → v0.5 rename: previously a single starter asset with the wrong
  // content (flower) was seeded under "butea-studio-tree"; split into the
  // correct tree + flower assets with new ids
  "butea-studio-tree": STARTER_TREE_ID,
};

/** One-time migration of in-IDB docs that reference renamed/stale image
 *  ids. Rewrites markdown in-place and deletes the orphaned asset. */
async function migrateStaleImageRefs(): Promise<void> {
  const docs = await listDocuments().catch(() => [] as ButeaDocument[]);
  for (const doc of docs) {
    let md = doc.markdown;
    let changed = false;
    for (const [oldId, newId] of Object.entries(STALE_IMAGE_IDS)) {
      const re = new RegExp(`butea-media:\\/\\/${oldId}\\b`, "g");
      if (re.test(md)) {
        md = md.replace(re, `butea-media://${newId}`);
        changed = true;
      }
    }
    if (changed) {
      doc.markdown = md;
      doc.updatedAt = Date.now();
      await putDocument(doc).catch(() => {});
    }
  }
  // Best-effort cleanup of the orphaned old assets.
  for (const oldId of Object.keys(STALE_IMAGE_IDS)) {
    await deleteMedia(oldId).catch(() => {});
  }
}

/**
 * Mount once near the app root. Three responsibilities:
 *
 *   1. **Bootstrap** — on first ever load, create a "本地文档 #1" from the
 *      existing in-memory markdown so the user's draft becomes a proper
 *      ButeaDocument record in IndexedDB.
 *   2. **Load on activeDocId change** — when the user picks a different doc
 *      from the library, fetch its full state from IDB and hydrate the
 *      store's mirror fields (markdown / translations / useTranslation /
 *      title).
 *   3. **Autosave** — debounced write of the active doc's mirror fields
 *      back to IDB whenever they change.
 */
export function DocSync() {
  const activeDocId = useWorkshop((s) => s.activeDocId);
  const setActiveDocId = useWorkshop((s) => s.setActiveDocId);
  const setActiveDocTitle = useWorkshop((s) => s.setActiveDocTitle);
  const activeDocTitle = useWorkshop((s) => s.activeDocTitle);
  const markdown = useWorkshop((s) => s.markdown);
  const setMarkdown = useWorkshop((s) => s.setMarkdown);
  const translations = useWorkshop((s) => s.translations);
  const useTranslation = useWorkshop((s) => s.useTranslation);
  const themeId = useWorkshop((s) => s.themeId);
  const customThemeTokens = useWorkshop((s) => s.customThemeTokens);
  const setSaveStatus = useWorkshop((s) => s.setSaveStatus);
  const bumpDocList = useWorkshop((s) => s.bumpDocList);

  // Bootstrap: create the first document if none exists yet.
  // Suppresses the autosave's first-render write by waiting until the
  // active doc id is in place before unlocking saves.
  const bootstrapped = React.useRef(false);
  const saveLock = React.useRef(true);
  // Tracks the version of the active document we last applied to the store,
  // so the autosave doesn't echo back what the doc-loader just wrote.
  const lastLoadedRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    (async () => {
      // Best-effort housekeeping
      purgeExpiredTrash().catch(() => {});

      // Seed starter assets before any doc-load path so the welcome doc's
      // `butea-media://<id>` references resolve on first paint.
      await Promise.all([
        seedStarterAsset({
          id: STARTER_TREE_ID,
          publicUrl: "/butea-studio-tree.png",
          name: "Butea Studio · 紫矿树.png",
        }),
        seedStarterAsset({
          id: STARTER_FLOWER_ID,
          publicUrl: "/butea-studio-flower.png",
          name: "Butea Studio · 紫矿花.png",
        }),
      ]).catch(() => {});

      // Migrate any existing docs whose markdown still references stale
      // image ids from earlier versions. Runs after seeding so the rewrite
      // targets are guaranteed to exist in IDB.
      await migrateStaleImageRefs().catch(() => {});

      if (activeDocId) {
        // Just load it
        const doc = await getDocument(activeDocId);
        if (doc) {
          applyDocToStore(doc, {
            setMarkdown,
            setActiveDocTitle,
            useWorkshop,
          });
          lastLoadedRef.current = activeDocId;
          saveLock.current = false;
          return;
        }
        // activeDocId points to a deleted/missing doc — clear stale refs
        // so the seed path below can run cleanly.
        setActiveDocId(null);
        setMarkdown(DEFAULT_MARKDOWN);
      }

      // No active doc yet. Either first run, or post-v3 migration. Try to
      // adopt an existing doc; otherwise seed one from the current
      // in-memory markdown.
      const existing = await listDocuments();
      if (existing.length > 0) {
        const doc = existing[0];
        setActiveDocId(doc.id);
        applyDocToStore(doc, {
          setMarkdown,
          setActiveDocTitle,
          useWorkshop,
        });
        lastLoadedRef.current = doc.id;
      } else if (markdown && markdown.trim() && markdown !== DEFAULT_MARKDOWN) {
        // User had pre-v3 in-memory markdown (legacy migration). Adopt it
        // as a single document.
        const seedTitle = extractTitle(markdown) || "未命名文档";
        const doc = await createDocument({
          title: seedTitle,
          markdown,
          source: { kind: "local" },
        });
        setActiveDocId(doc.id);
        applyDocToStore(doc, {
          setMarkdown,
          setActiveDocTitle,
          useWorkshop,
        });
        lastLoadedRef.current = doc.id;
        bumpDocList();
      } else {
        // First-time install — seed starter docs. Order them so
        // doc #1 sits at the top (newest updatedAt).
        const baseTime = Date.now();
        const total = STARTER_DOCS.length;
        let firstId: string | null = null;
        for (let i = 0; i < total; i++) {
          const entry = STARTER_DOCS[i];
          // Stagger createdAt so updatedAt-desc places #1 at the top
          const offset = (total - i) * 10;
          const doc = await createDocument({
            title: entry.title,
            markdown: entry.markdown,
            source: { kind: "local" },
          });
          doc.themeId = entry.themeId ?? "butea";
          doc.customThemeTokens = entry.customThemeTokens ?? null;
          // Backdate older entries so the first one stays freshest
          doc.createdAt = baseTime + offset;
          doc.updatedAt = baseTime + offset;
          await putDocument(doc);
          if (i === 0) firstId = doc.id;
        }
        if (firstId) {
          const doc = await getDocument(firstId);
          if (doc) {
            setActiveDocId(doc.id);
            applyDocToStore(doc, {
              setMarkdown,
              setActiveDocTitle,
              useWorkshop,
            });
            lastLoadedRef.current = doc.id;
          }
        }
        bumpDocList();
      }
      saveLock.current = false;
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When user picks a different doc from the library, activeDocId changes.
  // Load the new doc's contents and pause autosave during the swap.
  React.useEffect(() => {
    if (!bootstrapped.current) return;
    if (!activeDocId) return;
    if (lastLoadedRef.current === activeDocId) return;
    saveLock.current = true;
    (async () => {
      const doc = await getDocument(activeDocId);
      if (doc) {
        applyDocToStore(doc, {
          setMarkdown,
          setActiveDocTitle,
          useWorkshop,
        });
        lastLoadedRef.current = activeDocId;
      }
      saveLock.current = false;
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDocId]);

  // Autosave: debounced write of markdown / title / translations to IDB.
  // Skipped while saveLock is held (during initial bootstrap or doc swap).
  const saveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyMark = useWorkshop((s) => s.saveStatus);
  React.useEffect(() => {
    if (saveLock.current) return;
    if (!activeDocId) return;
    setSaveStatus("dirty");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const doc = await getDocument(activeDocId);
      if (!doc) return;
      doc.markdown = markdown;
      doc.title = activeDocTitle || extractTitle(markdown) || "未命名文档";
      doc.translations = translations;
      doc.useTranslation = useTranslation;
      doc.themeId = themeId;
      doc.customThemeTokens = customThemeTokens;
      doc.updatedAt = Date.now();
      setSaveStatus("saving");
      await putDocument(doc);
      setSaveStatus("saved");
      bumpDocList();
    }, 600);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markdown, activeDocTitle, translations, useTranslation, themeId, customThemeTokens, activeDocId]);

  // Silence "dirtyMark" unused-warning while keeping it subscribed so the
  // component re-renders whenever saveStatus changes (lets you read save
  // status from anywhere by subscribing to the store).
  void dirtyMark;
  return null;
}

/** Apply a fetched ButeaDocument to the in-memory Zustand mirror fields. */
function applyDocToStore(
  doc: ButeaDocument,
  ctx: {
    setMarkdown: (md: string) => void;
    setActiveDocTitle: (t: string) => void;
    useWorkshop: typeof useWorkshop;
  }
) {
  // Bypass store-level equality guard by reading/writing directly when needed.
  ctx.setMarkdown(doc.markdown);
  ctx.setActiveDocTitle(doc.title);
  // Per-doc state: translations, theme, etc.
  ctx.useWorkshop.setState({
    translations: doc.translations ?? {},
    useTranslation: doc.useTranslation ?? {},
    themeId: doc.themeId ?? "butea",
    customThemeTokens: doc.customThemeTokens ?? null,
    saveStatus: "saved",
  });
}

export function extractTitle(md: string): string {
  const m = /^#\s+(.+)$/m.exec(md);
  return m ? m[1].trim() : "";
}
