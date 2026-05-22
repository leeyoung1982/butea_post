<p align="center">
  <img src="public/butea-post-logo.png" alt="Butea Post" width="180" />
</p>

<h1 align="center">Butea Post</h1>

<p align="center">
  <em>不负每一份灵感 · Live up to every inspiration</em>
</p>

<p align="center">
  一份草稿，AI 自动适配到每个平台 —— 公众号 / 博客 / X / 小红书 / 微博 / 朋友圈。<br/>
  改结构、改语气、改排版，<strong>不动原稿</strong>。开源，BYOK，你的草稿你做主。
</p>

<p align="center">
  <a href="https://butea-post.vercel.app">
    <img src="https://img.shields.io/badge/▶︎_Try_the_live_demo-EA580C?style=for-the-badge&labelColor=0A0A0A" alt="Try the live demo" />
  </a>
</p>

<p align="center">
  <a href="https://butea-post.vercel.app">在线试用</a> ·
  <a href="#quickstart">本地运行</a> ·
  <a href="#features">功能</a> ·
  <a href="#architecture">架构</a> ·
  <a href="#roadmap">路线图</a> ·
  <a href="CONTRIBUTING.md">贡献</a>
</p>

---

## What is Butea Post

每个平台都有它自己的"母语"——公众号要长读，小红书要图卡，X 要 Thread，微博要钩子，朋友圈要摘要。同一篇文章贴到不同平台，要么被字数硬截，要么被算法埋掉。

Butea Post 是一个**开源的沉浸式写作 + 多平台发布工具**：你在一个全屏所见即所得编辑器里完成写作和排版，Butea 帮你把它**重新表达**成每个目标平台最自然的形态。

- **长文平台** (公众号 / 博客 / X Long-form) —— 用你原文，只换样式
- **短文平台** (小红书 / X Thread / 微博 / 朋友圈) —— 由 AI 重新结构化、压缩、加钩子

设计原则：
- 🌱 **Suggest, never commit** —— AI 是建议者，所有操作用户确认
- 📓 **The note is the source of truth** —— 你的笔记/草稿才是真相之源
- 🔑 **BYOK or nothing** —— 自带 API key，我们不存内容、不替你付费
- 🪶 **One platform = one file** —— 加一个新平台 ≈ 加一个 30 行的 adapter

## Features

**沉浸式编辑器**

- ✍️ TipTap 3 所见即所得编辑器，Markdown 快捷键即写即转换
- 🎨 排版主题 —— 7 种配色 + 10 种风格（GitHub / Medium / Notion / 知乎 / 少数派等）+ 自定义主题编辑器
- 🖍 荧光笔标注 —— 半高度彩色底纹，7 种颜色
- 📦 Admonition 卡片 —— 6 种类型（Note / Info / Tip / Warning / Danger / Quote），兼容 Obsidian Callout 语法
- 💻 代码块 —— 14 种语言选择，编辑器内语言标签 + 一键复制
- 🖼 图片 —— 拖拽插入、等比缩放、4 种对齐 + 全宽、图注
- 📐 文字样式 —— 颜色、字号、行高、对齐、标题层级（H1-H4）
- 📝 源码模式 —— 一键查看 Markdown 原始代码

**AI 副驾驶 (BYOK)**

- 🤖 文字改写 —— 扩写 / 缩写 / 润色 / 翻译 / 续写，支持附加指令
- 💡 AI 灵感 —— 头脑风暴 / 拆解选题 / PAS·SCQA·AIDA 大纲 / 标题生成
- 🖼 图片生成 —— 文中插图 / 封面，文图可用不同 provider
- 🎯 写作偏好 —— 赛道、读者、风格禁忌写进设置，所有 AI 动作自动遵守
- 🔌 支持 OpenAI / Anthropic / DeepSeek / Gemini / fal.ai / 任何 OpenAI 兼容端点

**多平台发布**

| 平台 | 形态 | 模式 |
|------|------|------|
| 📰 **公众号** | 内联样式 HTML，复制富文本粘贴 | 长文，不改写 |
| 📝 **博客** | 结构化 HTML | 长文，不改写 |
| 📕 **小红书** | 标题 + 图卡 + 正文 + hashtag | 短文，AI 改写 |
| 🧵 **X / Thread** | 自动拆 ≤280 字推文串 | 短文，AI 改写 |
| 📜 **X / Long-form** | Premium 25k 字长文 | 长文，不改写 |
| 🟧 **微博** | 140 字短文 + 话题 | 短文，AI 改写 |
| 🟢 **朋友圈** | 200 字摘要 + 链接预览 | 短文，AI 改写 |
| 🚀 **Astro 博客** | 直接推送到 Astro 站点 | 长文，不改写 |

**文档管理**

- 📁 本地文档库 + 30 天回收站，IndexedDB 存储
- 📥 导入 `.md` / `.txt` / `.html` / `.docx`（Word）
- 🔗 Obsidian 双向同步（通过 Local REST API 插件）
- 📸 手动快照，随时回溯
- 🖼 资产库 —— 浏览器本地媒体管理，拖拽插入

**图床**

- ☁️ Cloudflare R2 / Imgur / GitHub，发布前一键上传

## Quickstart

需要 **Node 20+**。

```bash
git clone https://github.com/leeyoung1982/butea_post.git
cd butea_post
npm install
npm run dev
# → http://localhost:3000
```

首次打开后，左下角 ⚙️ 设置 → 填入你的 LLM API key（推荐 DeepSeek 性价比最高，也支持 OpenAI / Anthropic / Gemini / 自定义端点）。

## Configuration

Butea Post 是**纯前端**应用 —— 没有服务器，没有数据库，没有用户系统。你的内容、key、草稿都在浏览器里（IndexedDB + localStorage）。

| 在哪里配 | 配什么 |
|---------|--------|
| 设置 → LLM | 文字 AI 的 provider + API key |
| 设置 → 图片 provider | 图片 AI 的 provider + API key（可独立） |
| 设置 → 写作偏好 | 你的赛道、读者画像、风格规则 |
| 设置 → 图床 | Cloudflare R2 / Imgur / GitHub PAT |
| 设置 → Astro 博客 | 博客地址 + API 配置 |

> 💡 没有 `.env` 文件。所有配置都在浏览器，不会泄漏到 git。

## Architecture

```
┌──────────────────────────────────────────────────────┐
│               Markdown 草稿 (in-memory)               │
└───────────────────────┬──────────────────────────────┘
                        │
              ┌─────────▼──────────┐
              │  TipTap 3 Editor   │  ← 沉浸式所见即所得
              │  (WYSIWYG + MD)    │
              └─────────┬──────────┘
                        │
              ┌─────────▼──────────┐
              │  Platform Adapter  │  ← lib/adapters/<id>.ts
              │  (one file/platform)│
              └─────────┬──────────┘
                        │
                ┌───────▼────────┐
                │ AdapterOutput  │  ← html | thread | cards | summary
                └────────────────┘
```

加一个新平台 = 在 `lib/adapters/` 加一个文件，实现 `Adapter` 接口的 30 行代码，在 `lib/adapters/index.ts` 注册。详见 [CONTRIBUTING.md](CONTRIBUTING.md)。

**技术栈**：
- Next.js 16 (App Router) + TypeScript (strict)
- TipTap 3 + tiptap-markdown（编辑器 + Markdown 双向转换）
- Zustand + persist（状态）
- IndexedDB（文档 / 图片二进制 / 每文档独立主题）
- unified + remark + rehype + highlight.js + juice（渲染管线）
- Tailwind CSS v4 + Radix UI（UI）

## Roadmap

- **v0.5 (当前)** —— 沉浸式编辑器 / 17+ 排版主题 / Admonition 卡片 / 荧光笔 / 代码块增强 / R2 图床 / Astro 推送 / Obsidian 同步 / 每文档独立主题
- **v0.6** —— API 直发（公众号草稿 / X）、定时发布、数据回流
- **v1.0** —— 协作 / 自托管 Docker / 可选云托管

## Contributing

PR 欢迎，**新平台 adapter 是最容易上手的贡献**——抄一个现有的（比如 [`lib/adapters/blog.ts`](lib/adapters/blog.ts)）改 ~30 行就行。

详细贡献指南见 [CONTRIBUTING.md](CONTRIBUTING.md) (TBD)。

issue 标了 `good first issue` 的是新人友好的入口。

## License

[MIT](LICENSE) — 拿去用、改、卖、商用都行。署名一下就行，无需通知。

---

<p align="center">
  <sub>Made under a Butea monosperma tree. 🌳<br/>
  <em>Live up to every inspiration.</em></sub>
</p>
