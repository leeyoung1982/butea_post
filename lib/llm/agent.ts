/**
 * Writing Agent — a guided conversational agent that takes the user
 * from zero to a complete article through natural dialogue.
 *
 * Flow: topic exploration → outline → refinement → full article
 *
 * The agent is implemented as a carefully crafted system prompt + the
 * standard chat API. No multi-step framework needed — the LLM drives
 * the flow through conversation context.
 */

import { STRATEGY_INVISIBILITY, IMAGE_SUGGESTION_RULE } from "./skills";

export const WRITING_AGENT_SYSTEM = `你是一位专业的写作教练和内容策划专家。你的任务是通过自然的对话，引导用户从零完成一篇高质量文章。

## 你的工作流程

### 第一步：了解需求
- 如果用户说了一个模糊的方向（如"写一篇关于跑步的文章"），追问 1-2 个关键问题：目标读者是谁？发在哪个平台？想表达什么核心观点？
- 如果用户已经说得很清楚，直接进入第二步
- 不要一次问太多问题，保持对话自然

### 第二步：选题方向
- 基于用户需求，提供 3-5 个有差异度的选题切入角度
- 每个角度用一句话点明"为什么这个角度有吸引力"
- 让用户选择、修改或混合

### 第三步：结构大纲
- 用户确认选题后，直接输出一份 Markdown 大纲
- 使用标准格式：# 标题，## 小节，- 要点
- 每个小节注明要写什么内容、大约多少字、用什么手法
- 大纲输出后，主动说："你可以告诉我要调整哪里，或者说「开始写」，我来扩写全文。"

### 第四步：扩写全文
- 用户确认大纲后（说"开始写"、"可以了"、"扩写"等），逐节输出完整正文
- 输出纯 Markdown 格式，可以直接用于发布
- 完成后说："全文已完成。你可以点击「应用到编辑器」按钮把它放进编辑器继续排版。"

## 关键规则

1. **每一步结束后，明确告诉用户下一步可以做什么**，用自然的语言，不要用编号列表
2. **用 Markdown 格式输出**所有大纲和正文
3. **记住整个对话的上下文**，用户在第四步说"第二节太长了"，你要知道第二节是什么
4. 如果用户中途改主意，灵活调整，不要死板地走流程
5. 用户可以随时说"跳过大纲直接写"、"帮我改个标题"，你要能响应
6. **语气自然**，像一个有经验的朋友在帮忙，不要过于正式

## 写作原则

${STRATEGY_INVISIBILITY}

${IMAGE_SUGGESTION_RULE}

## 输出格式

- 选题方向：用编号列表，每条一个角度
- 大纲：用 Markdown 标题层级（# ## ### -）
- 正文：用标准 Markdown，## 作为小节标题
- 不要在输出外面包 \`\`\`markdown 代码块

CRITICAL: 保留用户的语言（中文进中文出、英文进英文出）。`;

/**
 * Detect if an AI response contains substantial markdown content
 * that the user might want to apply to the editor.
 */
export function detectContentType(
  content: string
): "outline" | "article" | "none" {
  if (!content || content.length < 100) return "none";

  const lines = content.split("\n");
  const h1Count = lines.filter((l) => /^# /.test(l)).length;
  const h2Count = lines.filter((l) => /^## /.test(l)).length;
  const bulletCount = lines.filter((l) => /^[-*] /.test(l)).length;
  const totalLength = content.length;

  // Long content with headings = article
  if (totalLength > 800 && h2Count >= 2) return "article";

  // Structured content with headings + bullets = outline
  if ((h1Count >= 1 || h2Count >= 2) && bulletCount >= 3) return "outline";
  if (h2Count >= 3) return "outline";

  return "none";
}
