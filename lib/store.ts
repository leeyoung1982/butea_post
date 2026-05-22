"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ThemeId, ThemeTokens } from "@/lib/themes/themes";
import type { PlatformId } from "@/lib/adapters/types";

export const DEFAULT_MARKDOWN = `# Butea Studio

> 不负每一份灵感 · Live up to every inspiration

开始写作吧。
`;

/**
 * Per-platform AI translation cache. `sourceHash` lets us detect when the
 * user's underlying draft has changed and the translation is stale.
 */
export type TranslationCache = {
  markdown: string;
  sourceHash: string;
  createdAt: number;
};

export type DocumentState = {
  markdown: string;
  setMarkdown: (md: string) => void;

  themeId: ThemeId;
  setThemeId: (id: ThemeId) => void;

  customThemeTokens: ThemeTokens | null;
  setCustomThemeTokens: (tokens: ThemeTokens) => void;

  // Which platform the publish center targets.
  currentPlatform: PlatformId;
  setCurrentPlatform: (p: PlatformId) => void;

  // AI-translated drafts per platform.
  translations: Partial<Record<PlatformId, TranslationCache>>;
  setTranslation: (p: PlatformId, c: TranslationCache) => void;
  clearTranslation: (p: PlatformId) => void;

  useTranslation: Partial<Record<PlatformId, boolean>>;
  setUseTranslation: (p: PlatformId, v: boolean) => void;

  translatingFor: PlatformId | null;
  setTranslatingFor: (p: PlatformId | null) => void;

  translationProgress: string;
  setTranslationProgress: (s: string) => void;

  topic: string;
  setTopic: (t: string) => void;

  audience: string;
  setAudience: (a: string) => void;

  selection: string;
  setSelection: (s: string) => void;

  aiOpen: boolean;
  setAiOpen: (open: boolean) => void;

  sidebarPanel: "current" | "library" | "obsidian" | "assets" | "publish" | null;
  setSidebarPanel: (
    p: "current" | "library" | "obsidian" | "assets" | "publish" | null
  ) => void;

  /** True once user has connected a vault via File System Access API */
  obsidianVaultConnected: boolean;
  setObsidianVaultConnected: (v: boolean) => void;

  // -- Multi-document support --
  activeDocId: string | null;
  setActiveDocId: (id: string | null) => void;

  saveStatus: "saved" | "saving" | "dirty";
  setSaveStatus: (s: "saved" | "saving" | "dirty") => void;

  activeDocTitle: string;
  setActiveDocTitle: (t: string) => void;

  docListNonce: number;
  bumpDocList: () => void;
};

export const useWorkshop = create<DocumentState>()(
  persist(
    (set, get) => ({
      markdown: DEFAULT_MARKDOWN,
      setMarkdown: (md) => {
        if (get().markdown === md) return;
        set({ markdown: md });
      },

      themeId: "butea",
      setThemeId: (id) => {
        if (get().themeId === id) return;
        set({ themeId: id });
      },

      customThemeTokens: null,
      setCustomThemeTokens: (tokens) => set({ customThemeTokens: tokens }),

      currentPlatform: "wechat",
      setCurrentPlatform: (p) => {
        if (get().currentPlatform === p) return;
        set({ currentPlatform: p });
      },

      translations: {},
      setTranslation: (p, c) =>
        set((s) => ({
          translations: { ...s.translations, [p]: c },
          useTranslation: { ...s.useTranslation, [p]: true },
        })),
      clearTranslation: (p) =>
        set((s) => {
          const t = { ...s.translations };
          delete t[p];
          const u = { ...s.useTranslation };
          delete u[p];
          return { translations: t, useTranslation: u };
        }),

      useTranslation: {},
      setUseTranslation: (p, v) =>
        set((s) => ({ useTranslation: { ...s.useTranslation, [p]: v } })),

      translatingFor: null,
      setTranslatingFor: (p) => set({ translatingFor: p }),

      translationProgress: "",
      setTranslationProgress: (value) => {
        if (get().translationProgress === value) return;
        set({ translationProgress: value });
      },

      topic: "",
      setTopic: (t) => {
        if (get().topic === t) return;
        set({ topic: t });
      },

      audience: "",
      setAudience: (a) => {
        if (get().audience === a) return;
        set({ audience: a });
      },

      selection: "",
      setSelection: (value) => {
        if (get().selection === value) return;
        set({ selection: value });
      },

      aiOpen: false,
      setAiOpen: (open) => set({ aiOpen: open }),

      sidebarPanel: null,
      setSidebarPanel: (p) => set({ sidebarPanel: p }),

      obsidianVaultConnected: false,
      setObsidianVaultConnected: (v) => set({ obsidianVaultConnected: v }),

      activeDocId: null,
      setActiveDocId: (id) => {
        if (get().activeDocId === id) return;
        set({ activeDocId: id });
      },

      saveStatus: "saved",
      setSaveStatus: (s) => {
        if (get().saveStatus === s) return;
        set({ saveStatus: s });
      },

      activeDocTitle: "",
      setActiveDocTitle: (t) => {
        if (get().activeDocTitle === t) return;
        set({ activeDocTitle: t });
      },

      docListNonce: 0,
      bumpDocList: () => set((s) => ({ docListNonce: s.docListNonce + 1 })),
    }),
    {
      name: "butea:workshop",
      version: 4,
      migrate: (persistedState: unknown, fromVersion: number) => {
        const state = (persistedState ?? {}) as Record<string, unknown>;
        if (fromVersion < 4) {
          // v0.5: drop dual-editor and viewport state
          delete state.editorMode;
          delete state.viewport;
          delete state.sidebarPanel;
        }
        return state as Partial<DocumentState>;
      },
      partialize: (s) => ({
        markdown: s.markdown,
        themeId: s.themeId,
        customThemeTokens: s.customThemeTokens,
        currentPlatform: s.currentPlatform,
        translations: s.translations,
        useTranslation: s.useTranslation,
        topic: s.topic,
        audience: s.audience,
        activeDocId: s.activeDocId,
        activeDocTitle: s.activeDocTitle,
      }),
    }
  )
);
