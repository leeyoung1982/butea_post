# CLAUDE.md

给 Claude（及其他 AI 助手）阅读的项目说明。**不要重复 README/CONTRIBUTING 已说过的内容**，只记录非显而易见的约定、坑点、和工作时必须遵守的边界。

---

## 项目身份

**Butea Post** — 一个**纯前端**的沉浸式写作 + 多平台发布工具。

- 没有服务器、没有数据库、没有用户系统、没有 `.env`。
- 用户内容、API key、配置全部在浏览器（IndexedDB + localStorage）。
- BYOK（Bring Your Own Key）—— LLM/图床/Astro 凭据全部由用户自带，前端 → `/api/llm` Edge 代理 → 用户的 provider。

仓库结构：`app/`（App Router）+ `components/`（UI）+ `lib/`（业务逻辑），`@/*` 路径别名指向项目根。

---

## 不要做的事

1. **不要引入服务端存储**（数据库、KV、Blob）。这是设计原则，不是技术限制。Butea 的卖点就是"内容永远在你浏览器里"。
2. **不要恢复双栏 / 分屏 / 双模式编辑器**。当前是单一 TipTap 沉浸式编辑器（CodeMirror 已被移除，`lib/editor-ref.ts` 还留有一些 legacy CM6 shim 仅为兼容）。源码模式是一个 toggle，不是第二个 pane。
3. **不要在 `.env` 中放 API key**。所有 key 走前端设置 → localStorage。如果某个新功能"需要后端密钥"，先停下来和用户讨论方案。
4. **不要把"副驾驶"作为称呼**。统一叫 **"AI 写作助手"**（2026-05 已重命名）。
5. **不要直接在 `stable` 分支开发**。`stable` = Vercel Production，只接受从 `main` 合并。
6. **不要在导出/发布管线里偷偷调用 LLM**。AI 改写必须显式按钮触发；长文平台（公众号/博客/X long-form）的 `requiresRewrite` 是 `false`，直接渲染原稿，不许偷偷过 LLM。
7. **不要假装能测 UI**。如果改了交互但没启动 dev server 实际验证，就在汇报里明说"未在浏览器中验证"。

---

## 必须记住的约定

### 语言

- **UI 字符串用中文** —— Butea 的目标读者是中文创作者，这是产品决策不是个人偏好。
- （代码注释/汇报语言等通用偏好见 `~/.claude/CLAUDE.md`。）

### 状态与存储

| 数据 | 位置 | Key |
|------|------|-----|
| 全局 UI 状态（当前文档、主题、侧边栏） | localStorage | `butea:workshop`（zustand persist，version 4） |
| LLM/图片 provider 设置 | localStorage | `claude-wechat-llm:settings` |
| 图床配置 | localStorage | `butea:image-host` |
| Astro 博客配置 | localStorage | `butea:astro-blog` |
| 自定义主题预设 | localStorage | `butea:custom-theme-presets` |
| 文档正文 + 快照 + 回收站 | IndexedDB `butea-docs` |  |
| 图片二进制 | IndexedDB `butea-media` | URL scheme: `butea-media://<id>` |

**改动 store schema 时**，记得 bump `version` 并写 migration —— 用户的浏览器里有真实数据，破坏性变更会让他们丢稿子。

### 侧边栏面板联合类型

```ts
sidebarPanel: "current" | "library" | "obsidian" | "assets" | "publish" | "ai" | null
```

加新面板时，同时更新 `lib/store.ts` 的两处类型签名（state + setter）。Obsidian 按钮只在 `obsidianVaultConnected === true` 时显示。

### Adapter 模型

加一个新发布平台 = 在 `lib/adapters/` 加一个 ~30 行文件，实现 `Adapter` 接口，然后在 `lib/adapters/index.ts` 注册，在 `types.ts` 的 `PlatformId` union 里加 id。

判断 `requiresRewrite` 的标准：**这个平台的形态约束会不会从根本上改变内容结构？**
- 改变 → `true`（小红书/X thread/微博/朋友圈：要拆段、压缩、加钩子）
- 不改 → `false`（公众号/博客/X long-form：只换样式）

### AI 写作助手

- **双模式**：`写作引导`（agent，走 `lib/llm/agent.ts` 的 system prompt 引导用户从选题→大纲→正文）；`自由对话`（用户主动调用 skill 库）
- Agent 系统提示词在 `lib/llm/agent.ts`，包含 `STRATEGY_INVISIBILITY` + `IMAGE_SUGGESTION_RULE`（来自 `lib/llm/skills.ts`）
- 用户写作偏好（`writingPreferences`）会注入所有 AI 文本调用，改提示词时务必拼上

---

## 工作流程

### 提交前自检（小改动也要做）

```bash
npx tsc --noEmit         # 类型必须过
npm run dev              # UI 改动必须在浏览器实际跑过
```

`strict: true` 已开，别用 `any` 偷懒，也别 `@ts-ignore` 当解药。

### 分支同步（main → stable 发布）

```bash
git checkout stable && git merge main && git push origin stable && git checkout main
```

只有在 localhost 测过、用户明确要发布时才合 stable。**不要主动建议合并到 stable**，等用户说。

---

## 常见坑

- **TipTap 是单实例**。所有"获取当前编辑器"应通过 `lib/editor-ref.ts`，不要重复 `useEditor()`。
- **IME（输入法）回车要拦截**。`compositionend` 之前的 Enter 不能触发发送 —— 这个 bug 刚修过（commit `7213495`）。新加输入框时复用 `ChatPanel` 已有的处理逻辑。
- **`postinstall` 脚本会在 macOS 上 `xattr -dr com.apple.quarantine node_modules`**。这是有意为之，不是错误。
- **`runtime = "edge"`** 用于 `/api/llm` 和 `/api/image` —— 流式转发用户的 key 到上游。改这两个路由前先确认你需要的 API 在 edge runtime 可用。
- **不要给 LLM provider 列表加 Gemini**。README 提了，但代码里没接 —— 真要接的话走 OpenAI 兼容端点（`providerId: "custom"`）。
- **`memory/` 目录是 Claude Code 的自动记忆，不属于代码库**。`.gitignore` 已排除 `.claude/`，但请勿主动 commit 任何形如 `HANDOFF.md` / `PLAN.md` / `NOTES.md` 的文件 —— 这些是 .gitignore 黑名单。

---

## 关键文件速查

| 文件 | 作用 |
|------|------|
| `components/Workspace.tsx` | 顶层布局：header + 图标 rail + 侧边面板 + 编辑器 |
| `components/editor/VisualEditor.tsx` | 唯一的 TipTap 编辑器 |
| `components/ai/ChatPanel.tsx` | AI 助手主面板（双模式） |
| `components/ai/SkillLibrary.tsx` | 技能库（选题/扩写/改写/翻译） |
| `components/publish/PublishCenter.tsx` | 平台切换 + 预览 + 复制/下载 + 图床 + Astro 推送 |
| `lib/store.ts` | Zustand 全局状态（持久化） |
| `lib/llm/agent.ts` | 写作 agent 系统提示词 + 内容类型检测 |
| `lib/llm/skills.ts` | AI 技能库的提示词常量 |
| `lib/llm/providers.ts` | LLM/图片 provider 配置 + key 解析 |
| `lib/adapters/index.ts` | 适配器注册表（新平台加一行） |
| `lib/themes/themes.ts` | 排版主题 tokens |
| `app/api/llm/route.ts` | LLM 流式代理（edge runtime） |
| `app/api/image/route.ts` | 图片生成代理 |

---

## 当不确定时

读 `README.md`（产品定位）、`CONTRIBUTING.md`（开发流程）、`memory/MEMORY.md` 索引（项目状态）。还是不确定就问用户。
