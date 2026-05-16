export const TITLE = "设置 · BYOK + 主题 + 写作偏好";

export const MARKDOWN = `# 设置 · BYOK + 主题 + 写作偏好

> Butea 的可调旋钮在这里。5-10 分钟全配完,之后所有的"个性化"都自动生效。

> 📷 *配图建议位:设置 dialog 全貌截图,展示左侧 tab 导航(LLM / 图片 / 偏好 / 图床 / 主题 / 关于)和右侧详细面板*

---

## 进设置

左下角 ⚙ 设置图标(或快捷键 \`⌘,\`)。

设置分 6 个 tab,依次讲。

---

## 1. LLM 配置(文字 AI)

### Provider 选择

| Provider | API 端点 | 特点 | 推荐度 |
|----------|---------|------|--------|
| **OpenAI** | api.openai.com | GPT-4 / GPT-4o | ⭐⭐⭐⭐ |
| **Anthropic** | api.anthropic.com | Claude Sonnet / Opus | ⭐⭐⭐⭐⭐(质量最好) |
| **DeepSeek** | api.deepseek.com | 中文质量好,价格 1/10 GPT-4 | ⭐⭐⭐⭐⭐(性价比) |
| **自定义 OpenAI 兼容** | 你填 | Together / Groq / 本地 Ollama / Azure / 任何兼容端点 | 进阶 |

### Model 选择

每个 provider 会列出推荐 model。**实测建议**:

- 写作类(扩写 / 改口语 / 加钩子)→ **claude-sonnet-4** 或 **deepseek-chat**
- 大纲 / 选题脑暴 → 任意 LLM 都行,**deepseek-chat** 省钱
- 润色全篇 → **claude-opus-4** 或 **gpt-4o**(更细)
- 长稿(>2000 字)处理 → 长 context 的 model

### API Key

把你自己的 key 填进去。**存在浏览器 localStorage,不上服务器**。

> 📷 *配图建议位:LLM 设置面板截图,展示 provider 单选 + model 下拉 + API key 输入框 + 测试按钮*

### 测试

填完点 **测试连接**。Butea 发一个简短的"你好"给 provider,验证 key 有效。

> [!tip]
> **DeepSeek 注册赠送 ~5 元额度**,够你用 Butea 完成一篇 5000 字文章的所有 AI 调用。https://platform.deepseek.com 注册即得。

---

## 2. 图片 provider(独立配置)

文字和图片**可以用不同 provider**——比如文字 DeepSeek 省钱、图片 fal.ai 跑 GPT image-1 质量好。

| Provider | 模型 | 适合 |
|----------|------|------|
| **fal.ai** | FLUX / GPT-image-1 / SD3 | ⭐⭐⭐⭐⭐ 推荐。一个 key 玩多个模型 |
| **OpenAI** | DALL-E 3 | 简单稳定 |
| **自定义 OpenAI 兼容** | Stability / Replicate / 本地 | 进阶 |

fal.ai 注册 https://fal.ai → 创建 API key → 粘到 Butea。

> 📷 *配图建议位:图片 provider 设置面板*

---

## 3. 写作偏好(最被低估的设置)

详细已经在 [#3 灵感与起笔](#3) 讲过,这里只放速查:

### 三个字段

| 字段 | 示例(独立开发者赛道) |
|------|---------------------|
| **赛道** | "我主要写独立开发者出海、SaaS 创业、AI 工具评测" |
| **读者画像** | "25-35 岁独立开发者 / 想做副业的工程师,讨厌'赋能'和'链路'" |
| **风格禁忌** | "不用宏观叙事开头、不用排比堆砌、引用数据要给来源、最多一个 emoji" |

### 作用域

**所有 AI 文本动作**都自动遵守:

- 副驾驶的 chat 回答
- 副驾驶的所有 skill
- 编辑器工具栏 ✨ AI ▾ 的 5 个动作
- 平台自适配生成的所有版本(短文平台改写)

写一次,**永久受益**。

---

## 4. 图床(发布前批量上传)

写文章时图片存在浏览器(\`butea-media://\`),发布前要换成公网 URL。Butea 内嵌两个图床:

### Imgur(推荐新手)

- 免费匿名,每天 ~1250 张
- 不需要注册
- **缺点**:Imgur 偶尔会删图(违反 ToS 的)、加载速度因地区而异

填一个 Client ID(在 imgur.com/account → Applications 注册 OAuth 2,只要 Client ID,不需要 secret)。

### GitHub(适合技术用户)

- 用 Personal Access Token + public repo
- **无上限**(只要 repo 是 public)
- GitHub CDN 速度全球都好
- **缺点**:repo 必须 public(图片公开访问),不适合敏感内容

填 PAT + repo 全名(\`owner/repo\`)+ 分支名(默认 \`main\`)。

### 工作流

1. 在编辑器写文章,图片用 \`butea-media://\`
2. 准备发布时,**右上角导出** → 复制 富文本 / HTML
3. Butea 弹出图床选择(Imgur / GitHub / 跳过)
4. 选了之后,**所有 \`butea-media://\` 自动上传 → 换成图床 URL**
5. 复制结果到剪贴板,粘到目标平台

> 📷 *配图建议位:导出对话框截图,展示图床选择 + 上传进度条 + 复制完成提示*

---

## 5. 主题

**7 套主题**,每套是完整的字体 / 间距 / 标题 / 颜色 token。

预览面板右上角调色板图标切换。

> 📷 *配图建议位:7 套主题的预览缩略图并排,每套展示同一段 markdown 的渲染对比*

| 主题 | 风格 | 适合 |
|------|------|------|
| **紫矿**(默认) | 暖橙 × 深紫,品牌主题 | 大多数场景 |
| **雾岚** | 极简性冷淡 | 工具 / 设计 / 科技博文 |
| **墨黑** | 印刷感衬线 | 文化 / 文学 / 思想长文 |
| **天青** | 清爽蓝 | 商业 / 财经 |
| **林深** | 自然绿 | 健康 / 生活 / 旅行 |
| **拂晓** | 温柔粉 | 美妆 / 情感 / 个人成长 |
| **终端** | 暗色 Geek | 技术 / 开发者 |

每个主题包含:

- 字体栈(中文 + 英文 + 代码)
- 字号系统(H1-H6 / 正文 / 引用 / 代码)
- 颜色 token(背景 / 文字 / 标题色 / 链接色 / 引用 bar / 代码块底色 / 表格)
- 间距(段落间距 / 标题前后 / 行高)
- H1 / H2 装饰(下划线 / 左边竖线 / 居中花纹 / 编号 / ribbon 等)

**切主题不影响内容**——同一份 markdown 换皮,适合不同心情或目标平台。

---

## 6. 关于(开源信息)

- **版本**:Butea v0.4
- **License**:MIT
- **代码**:https://github.com/leeyoung1982/butea_post
- **Demo**:https://butea-post.vercel.app
- **作者**:Butea Studio

### 怎么贡献

PR 欢迎。**新平台 adapter** 是最容易上手的贡献——抄一个现有的(比如 \`lib/adapters/blog.ts\`)改 30 行就行。

待办清单(欢迎认领):

- **新平台**:知乎 / 即刻 / Threads / 飞书文档 / 语雀 / 简书 / V2EX
- **新主题**:你的设计,跟现有 7 套不冲突就行
- **新功能**:Notion 双向 / 定时发布 API / 多人协作

---

## 自托管(进阶)

不想用 Butea 官方 demo(担心 Vercel 日志)?**完全可以自托管**:

\`\`\`bash
git clone https://github.com/leeyoung1982/butea_post.git
cd butea_post
npm install
npm run build
npm start
\`\`\`

然后:

- 浏览器打开 \`http://localhost:3000\`
- 你的所有数据都在你机器
- 唯一外部依赖:你配的 LLM provider 和图片 provider(你自己跟他们的关系)

部署到自己的 Vercel:

\`\`\`bash
npm i -g vercel
vercel deploy --prod
\`\`\`

或者部署到 Cloudflare Pages / Netlify / 自己的服务器(Next.js 标准产出)。

---

## 数据备份

浏览器 IndexedDB 不会自动备份。建议:

### Obsidian 中转(推荐)

把重要文档**写出来到 Obsidian Vault**,Obsidian 通过 iCloud / Syncthing / Obsidian Sync 同步多设备。

### 手动导出 IndexedDB

DevTools → Application → IndexedDB → 选 \`butea-docs\` 数据库 → 右键 Export(Chrome / Edge 支持)。

这一招也适合**搬家**:Mac 上 export,Windows 上 import。

---

## 你已经看完了 8 篇示例

恭喜——你现在掌握了 Butea 的全部能力。

> 📷 *配图建议位:简单的"完成"插画,可以是紫矿花完全盛开的图,或者一棵小树苗的简化版*

接下来:

1. **删掉这 8 篇示例**(文档库一篇一篇删,或者一键清空 IndexedDB 重新开始)
2. **新建第一篇属于你自己的文章**
3. **开始你的多平台创作生涯**

如果你喜欢 Butea,可以:

- ⭐ 给 GitHub repo 加 star —— https://github.com/leeyoung1982/butea_post
- 🐛 提 issue 报 bug 或建议功能
- 🤝 提 PR 贡献代码(新平台 adapter 最容易上手)
- 📢 推荐给身边的多平台创作者

---

*不负每一份灵感。Live up to every inspiration.*

*Butea · MIT 开源 · BYOK · 你的草稿、你的 API key、你的数据。*
`;
