"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ThemeId, ThemeTokens } from "@/lib/themes/themes";
import type { PlatformId } from "@/lib/adapters/types";

export type ChatMode = "agent" | "free";

/**
 * AI 写作助手 single chat message as the UI sees it. The transient
 * `imageB64` payload is intentionally NOT persisted (see partialize) to
 * keep localStorage from blowing past quota when users generate images.
 */
export type AiChatMessage = {
  id: string;
  role: "system" | "user" | "assistant";
  content: string;
  imageB64?: string;
};

export const DEFAULT_MARKDOWN = `# 享寫

> 不负每一份灵感

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

  sidebarPanel: "current" | "library" | "obsidian" | "assets" | "publish" | "ai" | null;
  setSidebarPanel: (
    p: "current" | "library" | "obsidian" | "assets" | "publish" | "ai" | null
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

  // -- AI 写作助手 chat state (per-mode so switching tabs preserves each
  //    tab's history independently; persisted across sidebar nav + reload) --
  chatHistories: Record<ChatMode, AiChatMessage[]>;
  /** Get / set the message list of the currently active mode. */
  setChatMessages: (
    next: AiChatMessage[] | ((prev: AiChatMessage[]) => AiChatMessage[])
  ) => void;

  chatMode: ChatMode;
  setChatMode: (m: ChatMode) => void;

  chatImageMode: boolean;
  setChatImageMode: (v: boolean) => void;

  chatAppliedIdsByMode: Record<ChatMode, string[]>;
  /** Get / set applied-message ids of the currently active mode. */
  setChatAppliedIds: (
    next: string[] | ((prev: string[]) => string[])
  ) => void;

  /** Clear only the currently active mode's conversation; the other mode's
   *  history is left untouched. */
  clearChat: () => void;
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

      // AI 写作助手 chat state — per-mode buckets so switching tabs keeps
      // each mode's history intact, and persisted so reload / sidebar nav
      // doesn't drop the conversation either.
      chatHistories: { agent: [], free: [] },
      setChatMessages: (next) =>
        set((s) => {
          const cur = s.chatHistories[s.chatMode];
          const updated = typeof next === "function" ? next(cur) : next;
          if (updated === cur) return {};
          return {
            chatHistories: { ...s.chatHistories, [s.chatMode]: updated },
          };
        }),

      chatMode: "agent",
      setChatMode: (m) => {
        if (get().chatMode === m) return;
        set({ chatMode: m });
      },

      chatImageMode: false,
      setChatImageMode: (v) => set({ chatImageMode: v }),

      chatAppliedIdsByMode: { agent: [], free: [] },
      setChatAppliedIds: (next) =>
        set((s) => {
          const cur = s.chatAppliedIdsByMode[s.chatMode];
          const updated = typeof next === "function" ? next(cur) : next;
          if (updated === cur) return {};
          return {
            chatAppliedIdsByMode: {
              ...s.chatAppliedIdsByMode,
              [s.chatMode]: updated,
            },
          };
        }),

      clearChat: () =>
        set((s) => ({
          chatHistories: { ...s.chatHistories, [s.chatMode]: [] },
          chatAppliedIdsByMode: { ...s.chatAppliedIdsByMode, [s.chatMode]: [] },
          chatImageMode: false,
        })),
    }),
    {
      name: "butea:workshop",
      version: 6,
      migrate: (persistedState: unknown, fromVersion: number) => {
        const state = (persistedState ?? {}) as Record<string, unknown>;
        if (fromVersion < 4) {
          // v0.5: drop dual-editor and viewport state
          delete state.editorMode;
          delete state.viewport;
          delete state.sidebarPanel;
        }
        if (fromVersion < 6) {
          // v6: split the single chat history into per-mode buckets so the
          // two tabs (agent / free) keep their own conversations. Park any
          // pre-existing chat under whichever mode was active at save time.
          const oldMessages = (state.chatMessages as unknown[]) ?? [];
          const oldApplied = (state.chatAppliedIds as string[]) ?? [];
          const mode = (state.chatMode as ChatMode) ?? "agent";
          state.chatHistories = {
            agent: mode === "agent" ? oldMessages : [],
            free: mode === "free" ? oldMessages : [],
          };
          state.chatAppliedIdsByMode = {
            agent: mode === "agent" ? oldApplied : [],
            free: mode === "free" ? oldApplied : [],
          };
          delete state.chatMessages;
          delete state.chatAppliedIds;
        }
        return state as Partial<DocumentState>;
      },
      partialize: (s) => ({
        markdown: s.markdown,
        currentPlatform: s.currentPlatform,
        translations: s.translations,
        useTranslation: s.useTranslation,
        topic: s.topic,
        audience: s.audience,
        activeDocId: s.activeDocId,
        activeDocTitle: s.activeDocTitle,
        // Strip imageB64 so generated-image base64 blobs don't push
        // localStorage past quota. Text-only chat history survives reload;
        // image previews are lost (acceptable — user can regenerate).
        chatHistories: {
          agent: s.chatHistories.agent.map(
            ({ imageB64: _imageB64, ...rest }) => rest
          ),
          free: s.chatHistories.free.map(
            ({ imageB64: _imageB64, ...rest }) => rest
          ),
        },
        chatMode: s.chatMode,
        chatImageMode: s.chatImageMode,
        chatAppliedIdsByMode: s.chatAppliedIdsByMode,
      }),
    }
  )
);
