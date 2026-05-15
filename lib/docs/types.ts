import type { PlatformId } from "@/lib/adapters/types";
import type { TranslationCache } from "@/lib/store";

/**
 * Where a document originated. Local docs live in Butea's IndexedDB.
 * Externally-sourced docs hold a reference back so we can write changes
 * to the source on save.
 */
export type DocumentSource =
  | { kind: "local" }
  | { kind: "obsidian"; path: string }
  | { kind: "notion"; pageId: string };

export type DocumentSnapshot = {
  at: number;
  markdown: string;
};

export type ButeaDocument = {
  id: string;
  title: string;
  markdown: string;
  source: DocumentSource;
  folder?: string[];
  tags: string[];
  createdAt: number;
  updatedAt: number;
  /** Manual snapshots created via the snapshot button. Auto-save does not
   *  push here — only explicit "make snapshot" actions do. */
  snapshots: DocumentSnapshot[];
  /** Per-doc AI nativization cache. Travels with the doc so switching docs
   *  doesn't show another doc's translations. */
  translations?: Partial<Record<PlatformId, TranslationCache>>;
  useTranslation?: Partial<Record<PlatformId, boolean>>;
};

export type TrashedDocument = ButeaDocument & {
  deletedAt: number;
};

/** Number of days a trashed doc lingers before being permanently purged. */
export const TRASH_TTL_DAYS = 30;

/** Cap on manual snapshots kept per doc. Older ones drop FIFO. */
export const MAX_SNAPSHOTS_PER_DOC = 20;
