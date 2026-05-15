"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ThemeId } from "@/lib/themes/themes";
import type { PlatformId } from "@/lib/adapters/types";

export const DEFAULT_MARKDOWN = `# Butea Studio 的第一朵紫矿花

![Butea Studio · 紫矿树](butea-media://butea-tree)
*Butea Studio 的全部,起点在一棵紫矿树下。*

某个春天的早晨,工作室在一棵紫矿树（**Butea monosperma**）的树荫下诞生。

橙色的花从枝头垂下来,落在草地上,像一篇刚写完的稿子掉进了不同形状的玻璃瓶——有的瓶子是公众号,有的是小红书,有的是 X,每个瓶子让这朵花呈现出不一样的样子,但**花本身,从来没变过**。

这就是 Butea 这个工具想做的事:**一份草稿,不同平台的呈现**。

> [!tip]
> 这是你的第一篇文章,也是一份"示意稿"——所有 Butea 的功能都嵌在这里,**你可以就地动手玩**。改坏了删掉重写也行,设置里有"重新载入示例"。

---

## 一、写在哪里

左边是编辑器,右边是预览。

编辑器顶上有个 \`MD / 可视\` 切换:

- **MD 模式**——你现在看到的这个,直接写 Markdown 源码,熟手写得快
- **可视模式**——所见即所得,适合图文混排和不熟 Markdown 的写作者

两种模式**共享同一份草稿**,随时切换,不掉数据,不掉格式。

工具栏从左到右:

| 区段 | 功能 |
|------|------|
| 文字格式 | **加粗** · *斜体* · ~~删除线~~ · 标题 · 引用 · 列表 · \`代码\` |
| 样式 | 颜色 · 字号 · 行高 · 对齐 |
| 媒体 | 图片(上传/URL) · 视频 · 外链卡片 · 分割线 |
| AI | 文字改写 · 图片生成 |
| 历史 | 撤销 · 重做 |

> [!info]
> **MD 和可视两套工具栏完全一致**——同样的按钮、同样的顺序、同样的图标。换个 mode 不用重新学习。

## 二、图片是一等公民

试着拖一张图片到这段文字下面——它会自动存到浏览器本地的资产库里,markdown 里只是一个 \`butea-media://xxx\` 的短引用,不会让源码变成一坨 base64。

**Hover 任意图片**,会出现:

- **顶部对齐工具栏**:靠左 / 居中 / 靠右 / 全宽 / 重置
- **四角手柄** → 等比例缩放
- **四边手柄** → 裁切像素(图本身不变形,只是把那一侧遮住)
- **左下角实时尺寸**:\`300 × 200 (从 400 × 300 裁切)\`

> [!note]
> 所有图片操作都**不动原始 blob**。Ctrl+Z 可以撤销每一次拖动,任何时候都能恢复到原图。

### 图注

给图片加 alt 文字,或者在图片下一行写斜体 \`*这是图注*\`,预览里会自动渲染成图片下方的小字——上面那张紫矿树就是用这个语法做的。

### 资产库

左侧栏的 🖼 图标进入"资产库",所有用过的图片都在里面。可以**点击插入到光标位置**,也可以**直接拖到编辑器**任意位置。每张图右上角有编辑(裁剪 + 缩放 + JPEG 质量)、复制引用、删除三个操作。

## 三、AI 副驾驶

工具栏的 \`AI ▾\` 下拉,文字和图片功能都在这里:

**文字**:

- **扩写选区**——选中一段,扩到 1.5-2 倍,加一个具体例子
- **改为更口语**——书面语改成有人味的对话感
- **改为更精炼**——压缩 30-50%,去掉所有冗余
- **加钩子**——在选中段落后追加一个故事/数据/反问
- **润色全篇**——通读、修语病、调节奏,**不改观点**

**图片**:

- **生成文中插图**——基于提示词在光标位置插一张
- **生成封面**——根据 H1 自动派生 prompt,16:9 高质量

每个弹出窗里都有**附加指令**输入框——比如"避免出现「赋能」这个词",改写时 AI 会优先遵守。

> [!warning]
> Butea 是 BYOK(自带 API key)。设置里填你自己的 OpenAI / Anthropic / DeepSeek / fal.ai key——我们不存你的内容,不替你掏钱。

## 四、一份草稿,不同平台

预览面板顶部的 \`平台 ▾\` 下拉,目前支持七个目标:

| 平台 | 形态 | 限制 |
|------|------|------|
| **公众号** | 内联样式 HTML,粘贴到后台即用 | 2000-5000 字最佳 |
| **博客** | 结构化 HTML,Substack / Medium / Ghost / WordPress 通用 | 无 |
| **小红书** | 标题 + 1-9 张图文卡片 + hashtag | 标题 ≤20 字 / 正文 ≤1000 字 |
| **X / Thread** | ≤280 字的连续推文串 | 自动分串 |
| **X / Long-form** | Premium 长文 | 25,000 字 |
| **微博** | 短文 + 话题 | 140 字 |
| **朋友圈** | 第一人称摘要 + 链接预览 | 200 字 |

预览实时反映目标平台的原生效果——比如切到小红书你看到的是 9 张图卡,切到 X Thread 你看到的是分串后的多条推文。

### 平台自适配

右上角 \`平台自适配 ▾\`:

- **适配当前平台**——只生成你正在看的那个
- **适配全部平台**——一键并行改写所有短文平台

> [!info]
> **长文平台(公众号 / 博客 / X Long-form)不需要 AI 改写**——你的原文就是最终稿,Butea 只换样式。
> **短文平台(小红书 / X Thread / 微博 / 朋友圈)才需要改写**——因为字数、结构、节奏都跟长文本质不同。这是 Butea 的"原生化"哲学:长的就让它长,短的让 AI 重塑。

## 五、文档库

左侧栏的 📁 是文档库。

- 所有本地文档存浏览器 IndexedDB,**30 天回收站**兜底,误删可恢复
- 支持从 \`.md\` / \`.txt\` / \`.html\` / \`.docx\`(Word)导入
- **当前正在编辑**的那篇会有一个绿色的"编辑中"小徽标,固定在列表顶部,不会因为 autosave 自动跳来跳去
- 切换文档时会有 toast 提示("已切换到《XXX》")

外部源(Obsidian 已通 Local REST API 接入,Notion / Google Drive 在路线图上)在同一面板的 ☁ 标签下。

## 六、主题

预览面板右上角的调色板图标——切换主题。每个主题包含完整的字体、间距、标题样式、颜色 token——同一份草稿,换个主题就换一种气质。

\`\`\`typescript
// Butea 的 adapter 模式 —— 加一个新平台只要 ~30 行代码
import { renderMarkdown } from "@/lib/md/render";
import { inlineHtmlWithTheme } from "@/lib/md/inline";

export const myPlatformAdapter: Adapter = {
  id: "my-platform",
  name: "我的平台",
  category: "longform",
  async render(draft, theme) {
    const { html, css } = await renderMarkdown(draft.markdown, theme);
    return {
      kind: "html",
      html: inlineHtmlWithTheme(html, css, theme),
    };
  },
};
\`\`\`

代码块右上角自动生成语言标签 + 复制按钮——长文章贴代码不用再担心读者复制不到。

## 七、就地试一下

把下面这几件事过一遍,主要功能就摸过一轮了:

1. **选中**这段开头的"把下面这几件事过一遍"几个字,按 ⌘B 加粗
2. **拖一张你自己的图**到这段文字下面
3. 工具栏 **🖼 → 上传本地文件** 或 **粘贴公网 URL** 插入一张图
4. Hover 那张图 → 工具栏选**居中** → 拖一个边来裁切
5. 选中一段文字 → \`AI ▾\` → **改为更口语**
6. 切到上方的**小红书** tab → 点 \`平台自适配 ▾\` → **适配当前平台** → 看长文怎么变成 9 张卡片
7. 工具栏 \`A 样式 ▾\` → 选段文字改个颜色和字号
8. 顶部右上角调色板 → 切换主题

---

## 关于紫矿(*Butea monosperma*)

南亚原生的乔木,常被叫做 **Flame of the Forest**——森林之火。早春叶子全部落光后,枝头开出火焰般的橙红色花。同一棵树同时供给世界:**橙红的花**装点林冠、**可食的果**入饭入药、**紫胶虫附生分泌的紫胶**是天然染料和封漆。

一根,多种形态。

这棵树的故事,也是 Butea Studio 的故事——**根扎在同一处灵感里,枝伸向每一个需要它的地方**。

而这篇,就是它开出的第一朵紫矿花。

![Butea Studio 的第一朵紫矿花](butea-media://butea-flower)
*愿你的灵感,也开出自己的花。*

不负每一份灵感。Live up to every inspiration.

---

*Butea · MIT 开源 · BYOK · 你的草稿、你的 API key、你的数据。*

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

  // Which platform the preview is currently rendering as.
  currentPlatform: PlatformId;
  setCurrentPlatform: (p: PlatformId) => void;

  // AI-translated drafts per platform. Empty until the user clicks "✨".
  translations: Partial<Record<PlatformId, TranslationCache>>;
  setTranslation: (p: PlatformId, c: TranslationCache) => void;
  clearTranslation: (p: PlatformId) => void;

  // Whether the user wants the preview to show the AI-translated version
  // (true) or the original canonical (false). Defaults to true once a
  // translation exists, but is independent so users can compare.
  useTranslation: Partial<Record<PlatformId, boolean>>;
  setUseTranslation: (p: PlatformId, v: boolean) => void;

  // Which platform is currently being translated (for spinner UI).
  translatingFor: PlatformId | null;
  setTranslatingFor: (p: PlatformId | null) => void;

  // Streaming progress text — purely for UI; not persisted.
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

  viewport: "desktop" | "phone";
  setViewport: (m: "desktop" | "phone") => void;

  /** Editor surface mode: raw Markdown (CodeMirror) vs WYSIWYG (TipTap). */
  editorMode: "markdown" | "visual";
  setEditorMode: (m: "markdown" | "visual") => void;

  sidebarPanel: "current" | "library" | "assets" | "publish" | null;
  setSidebarPanel: (
    p: "current" | "library" | "assets" | "publish" | null
  ) => void;

  // -- Phase A: multi-document support ----------------------------------
  /**
   * The id of the document the editor is currently bound to. Markdown /
   * translations / useTranslation above are *mirrors* of this doc; the
   * authoritative copy lives in IndexedDB.
   */
  activeDocId: string | null;
  setActiveDocId: (id: string | null) => void;

  /** UI hint for "saved / saving / dirty". Updated by the autosave effect. */
  saveStatus: "saved" | "saving" | "dirty";
  setSaveStatus: (s: "saved" | "saving" | "dirty") => void;

  /** Title of the active document. Title is stored on the doc record;
   *  this is the cached reflection for the header. */
  activeDocTitle: string;
  setActiveDocTitle: (t: string) => void;

  /** Bump to force panels (LibraryPanel etc.) to re-fetch the doc list. */
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

      viewport: "desktop",
      setViewport: (m) => set({ viewport: m }),

      editorMode: "markdown",
      setEditorMode: (m) => set({ editorMode: m }),

      sidebarPanel: null,
      setSidebarPanel: (p) => set({ sidebarPanel: p }),

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
      // v3: introduce multi-doc mode. Migration below only seeds the active
      // doc id; the actual document record is bootstrapped in <DocSync /> on
      // mount (because that requires async IndexedDB writes which can't run
      // inside a synchronous migrate function).
      version: 3,
      migrate: (persistedState: unknown, fromVersion: number) => {
        const state = (persistedState ?? {}) as { markdown?: string } & Record<
          string,
          unknown
        >;
        if (fromVersion < 2) {
          const m = state.markdown ?? "";
          const looksLikeOldWelcome =
            m.startsWith("# 欢迎来到 Butea") ||
            m.startsWith("# 欢迎使用 AI 公众号工坊");
          if (looksLikeOldWelcome) {
            state.markdown = DEFAULT_MARKDOWN;
          }
        }
        if (fromVersion < 3) {
          // No activeDocId yet — DocSync will create one from `markdown` on
          // first mount. Drop sidebarPanel since the rail labels changed
          // ("docs" / "obsidian" → "current" / "library").
          delete state.sidebarPanel;
          delete state.activeDocId;
        }
        return state as Partial<DocumentState>;
      },
      partialize: (s) => ({
        markdown: s.markdown,
        themeId: s.themeId,
        currentPlatform: s.currentPlatform,
        translations: s.translations,
        useTranslation: s.useTranslation,
        editorMode: s.editorMode,
        topic: s.topic,
        audience: s.audience,
        activeDocId: s.activeDocId,
        activeDocTitle: s.activeDocTitle,
      }),
    }
  )
);
