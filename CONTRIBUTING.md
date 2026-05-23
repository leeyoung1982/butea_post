# Butea Post 开发手册

## 分支策略

项目使用两个长期分支：

```
main（开发）──确认稳定──► stable（生产）
```

| 分支 | 用途 | Vercel 部署 |
|------|------|-------------|
| `stable` | 生产分支，Vercel Production | butea-post.vercel.app |
| `main` | 开发主线，Vercel Preview | 自动生成 preview URL |

### 规则

- **日常开发在 `main`**（或从 main 拉功能分支）
- **`stable` 只接受从 `main` 的合并**，不直接在 stable 上开发
- **`main` 的 push 不影响生产环境**，可以放心提交未完成的功能

---

## 日常开发流程

### 1. 小改动（bugfix、文案调整）

直接在 main 上开发：

```bash
# 确保在 main 分支
git checkout main
git pull origin main

# 修改代码...

# 提交
git add <files>
git commit -m "fix: 修复xxx问题"
git push origin main
```

### 2. 大功能（新特性、重构）

从 main 拉功能分支：

```bash
# 创建功能分支
git checkout main
git pull origin main
git checkout -b feat/my-feature

# 开发 + 提交...
git add <files>
git commit -m "feat: 新增xxx功能"
git push origin feat/my-feature

# 功能完成后合并回 main
git checkout main
git merge feat/my-feature
git push origin main

# 删除功能分支
git branch -d feat/my-feature
git push origin --delete feat/my-feature
```

### 3. 发布到生产

在 localhost 测试确认没问题后：

```bash
git checkout stable
git merge main
git push origin stable
# Vercel 自动部署到 butea-post.vercel.app

# 切回 main 继续开发
git checkout main
```

### 4. 生产环境紧急修复

如果生产环境发现紧急 bug：

```bash
# 从 stable 拉 hotfix 分支
git checkout stable
git checkout -b hotfix/urgent-fix

# 修复...
git commit -m "fix: 紧急修复xxx"

# 合并到 stable 并部署
git checkout stable
git merge hotfix/urgent-fix
git push origin stable

# 同步回 main
git checkout main
git merge hotfix/urgent-fix
git push origin main

# 清理
git branch -d hotfix/urgent-fix
```

---

## 本地开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev
# → http://localhost:3000

# 类型检查
npx tsc --noEmit

# 构建生产版本（本地验证）
npm run build
```

---

## 项目结构

```
├── app/                    # Next.js App Router
├── components/
│   ├── editor/             # TipTap 编辑器 + 工具栏
│   ├── publish/            # 发布面板 + 导出
│   ├── sidebar/            # 侧边栏面板（文档库/本篇/资产）
│   ├── themes/             # 主题选择器
│   ├── ai/                 # AI 写作助手
│   ├── settings/           # 设置对话框
│   └── ui/                 # 基础 UI 组件
├── lib/
│   ├── adapters/           # 平台适配器（每平台一个文件）
│   ├── docs/               # 文档存储 + 同步（IndexedDB）
│   ├── media/              # 媒体资产管理
│   ├── themes/             # 主题定义 + tokens
│   ├── md/                 # Markdown 渲染管线
│   ├── llm/                # AI 调用封装
│   ├── starter/            # 预置文档
│   ├── store.ts            # Zustand 全局状态
│   ├── editor-highlight.ts # 荧光笔标注扩展
│   ├── editor-admonition.ts# Admonition 卡片扩展
│   └── editor-codeblock.ts # 代码块增强扩展
└── public/                 # 静态资源
```

---

## 添加新平台适配器

这是最容易的贡献方式。

1. 复制 `lib/adapters/blog.ts` 为模板
2. 实现 `Adapter` 接口（通常 ~30 行）
3. 在 `lib/adapters/index.ts` 注册
4. 在 `lib/adapters/types.ts` 添加 PlatformId

```typescript
// lib/adapters/my-platform.ts
import type { Adapter, AdapterInput, AdapterOutput } from "./types";

export const myPlatformAdapter: Adapter = {
  id: "my-platform",
  name: "我的平台",
  description: "平台描述",
  async render(input: AdapterInput, theme): Promise<AdapterOutput> {
    // 实现渲染逻辑
  },
};
```

---

## 数据存储

| 数据 | 存储位置 | key |
|------|----------|-----|
| 文档 | IndexedDB | `butea` 数据库 |
| 媒体文件 | IndexedDB | `butea` 数据库 |
| 全局状态 | localStorage | `butea:workshop` |
| 图床配置 | localStorage | `butea:image-host` |
| Astro 配置 | localStorage | `butea:astro-blog` |
| 自定义主题预设 | localStorage | `butea:custom-theme-presets` |

> 所有数据在浏览器本地，不同域名（localhost vs vercel）的数据完全隔离。

---

## Commit 规范

使用 [Conventional Commits](https://www.conventionalcommits.org/)：

- `feat:` 新功能
- `fix:` 修复 bug
- `docs:` 文档
- `refactor:` 重构（不改功能）
- `style:` 样式调整
- `chore:` 构建/工具链
