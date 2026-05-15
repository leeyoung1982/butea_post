<p align="center">
  <img src="public/butea-studio-tree.png" alt="Butea Studio" width="220" />
</p>

<h1 align="center">Butea</h1>

<p align="center">
  <em>不负每一份灵感 · Live up to every inspiration</em>
</p>

<p align="center">
  一份草稿,AI 自动适配到每个平台 —— 公众号 / 博客 / X / 小红书 / 微博 / 朋友圈。<br/>
  改结构、改语气、改排版,<strong>不动语言</strong>。开源,BYOK,你的草稿你做主。
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

## What is Butea

每个平台都有它自己的"母语"——公众号要长读,小红书要图卡,X 要 Thread,微博要钩子,朋友圈要摘要。同一篇文章贴到不同平台,要么被字数硬截,要么被算法埋掉。

Butea 是一个**开源的内容创作 OS**:你写一份 Markdown 草稿,Butea 在编辑器里实时把它**重新表达**成每个目标平台最自然的形态。

- **长文平台** (公众号 / 博客 / X Long-form) —— 用你原文,只换样式
- **短文平台** (小红书 / X Thread / 微博 / 朋友圈) —— 由 AI 重新结构化、压缩、加钩子

设计原则:
- 🌱 **Suggest, never commit** —— AI 是建议者,所有操作用户确认
- 📓 **The note is the source of truth** —— 你的笔记/草稿才是真相之源
- 🔑 **BYOK or nothing** —— 自带 API key,我们不存内容、不替你付费
- 🪶 **One platform = one file** —— 加一个新平台 ≈ 加一个 30 行的 adapter

## Features

**编辑器**

- ✍️ 两种模式 —— **Markdown** (CodeMirror 6) + **可视/WYSIWYG** (TipTap),共享同一份草稿,随时切换
- 🎨 文字样式 —— 颜色、字号、行高、对齐,长文平台保留,短文平台原生剥除
- 🖼 图片是一等公民 —— 拖角等比缩放、拖边裁切像素、4 种对齐方式 + 全宽、图注 (alt 或下一行斜体)
- 📦 本地资产库 —— 浏览器 IndexedDB,点击/拖拽插入,带 LRU 缓存
- ↪️ 撤销/重做 —— 所有图片操作都不动 blob,Ctrl+Z 任意层撤销

**AI 副驾驶 (BYOK)**

- 🤖 **文字改写** —— 扩写 / 改口语 / 改精炼 / 加钩子 / 全篇润色,带附加指令
- 🖼 **图片生成** —— 文中插图 / 16:9 封面,文图可用不同 provider
- 🎯 **写作偏好** —— 把赛道、读者、风格禁忌写进设置,所有 AI 动作自动遵守
- 🔌 支持 OpenAI / Anthropic / DeepSeek / fal.ai / 任何 OpenAI 兼容端点

**多平台原生化**

| 平台 | 形态 | 模式 |
|------|------|------|
| 📰 **公众号** | 内联样式 HTML | 长文,不改写 |
| 📝 **博客** | 结构化 HTML (Substack / Medium / Ghost / WordPress) | 长文,不改写 |
| 📕 **小红书** | 标题 + 1-9 张图卡 + 正文 + hashtag | 短文,AI 改写 |
| 🧵 **X / Thread** | 自动拆 ≤280 字推文串 | 短文,AI 改写 |
| 📜 **X / Long-form** | Premium 25k 字长文 | 长文,不改写 |
| 🟧 **微博** | 140 字短文 + 话题 | 短文,AI 改写 |
| 🟢 **朋友圈** | 200 字摘要 + 链接预览 | 短文,AI 改写 |

一键 `平台自适配` 自动生成全部短文平台,长文平台用原文。

**主题**

7 套 —— 紫矿 (默认) / 雾岚 / 墨黑 / 天青 / 林深 / 拂晓 / 终端,每套都是完整的字体/间距/标题/颜色 token。

**文档管理**

- 📁 本地文档库 + 30 天回收站,IndexedDB 存储
- 📥 导入 `.md` / `.txt` / `.html` / `.docx`(Word)
- 🔗 **Obsidian 双向同步** (通过 Local REST API 插件)
- 🏷 当前文档"编辑中"徽标,智能排序

## Quickstart

需要 **Node 20+**。

```bash
git clone https://github.com/<your-handle>/butea.git
cd butea
npm install
npm run dev
# → http://localhost:3000
```

首次打开后,左下角 ⚙️ 设置 → 填入你的 LLM API key(推荐 DeepSeek 性价比最高,也支持 OpenAI / Anthropic / fal.ai / 自定义端点)。

## Configuration

Butea 是**纯前端**应用 —— 没有服务器,没有数据库,没有用户系统。你的内容、key、草稿都在浏览器里(IndexedDB + localStorage)。

| 在哪里配 | 配什么 |
|---------|--------|
| 设置 → LLM | 文字 AI 的 provider + API key |
| 设置 → 图片 provider | 图片 AI 的 provider + API key(可独立) |
| 设置 → 写作偏好 | 你的赛道、读者画像、风格规则 |
| 设置 → 图床 | Imgur / GitHub PAT(用于发布前上传图片) |

> 💡 没有 `.env` 文件。所有配置都在浏览器,不会泄漏到 git。

## Architecture

```
┌─────────────────────────────────────────────────────┐
│              Markdown 草稿 (in-memory)              │
└────────────┬────────────────────────┬───────────────┘
             │                        │
   ┌─────────▼────────┐    ┌──────────▼─────────┐
   │  MD Editor (CM6) │◄──►│ Visual Editor (TT) │
   └─────────┬────────┘    └──────────┬─────────┘
             │                        │
             └────────┬───────────────┘
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

加一个新平台 = 在 `lib/adapters/` 加一个文件,实现 `Adapter` 接口的 30 行代码,在 `lib/adapters/index.ts` 注册。详见 [CONTRIBUTING.md](CONTRIBUTING.md)。

**技术栈**:
- Next.js 16 (App Router) + TypeScript (strict)
- CodeMirror 6 (MD 编辑器) + TipTap 3 (Visual 编辑器)
- Zustand + persist (状态)
- IndexedDB (文档 / 图片二进制)
- unified + remark + rehype + juice (markdown 渲染管线)
- Tailwind CSS v4 + Radix UI (UI)

## Roadmap

- **v0.4 (当前)** —— 编辑器 + 7 平台 adapter + AI 副驾驶 + 图片裁切对齐 + 文字样式
- **v0.5** —— 视频嵌入 v2 / 表情包库 / Notion 双向 / 知乎 / 即刻 / Threads adapter
- **v0.6** —— API 直发(公众号草稿 / X)、定时发布、数据回流
- **v1.0** —— 协作 / 自托管 Docker / 可选云托管

## Contributing

PR 欢迎,**新平台 adapter 是最容易上手的贡献**——抄一个现有的 (比如 [`lib/adapters/blog.ts`](lib/adapters/blog.ts)) 改 ~30 行就行。

详细贡献指南见 [CONTRIBUTING.md](CONTRIBUTING.md) (TBD)。

issue 标了 `good first issue` 的是新人友好的入口。

## License

[MIT](LICENSE) — 拿去用、改、卖、商用都行。署名一下就行,无需通知。

---

<p align="center">
  <sub>Made under a Butea monosperma tree. 🌳<br/>
  <em>Live up to every inspiration.</em></sub>
</p>
