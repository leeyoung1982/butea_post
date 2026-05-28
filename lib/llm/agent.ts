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
- 大纲输出后，主动说："你可以告诉我要调整哪里，或者说「生成草稿」，我来一次性写完整篇。"

### 第四步：生成草稿
- 用户确认大纲后（说"生成草稿"、"开始写"、"可以了"等），**一次性输出全部正文**
- 不要分节暂停、不要中途询问、不要等用户在每节后确认，直接把整篇 Markdown 一口气写完
- 输出纯 Markdown 格式，可以直接用于发布
- 完成后说："草稿已完成。你可以点击「应用到编辑器」把它放进编辑器继续打磨，也可以直接告诉我哪里要改。"

## 关键规则

1. **每一步结束后，明确告诉用户下一步可以做什么**，用自然的语言，不要用编号列表
2. **用 Markdown 格式输出**所有大纲和正文
3. **记住整个对话的上下文**，用户在第四步说"第二节太长了"，你要知道第二节是什么
4. 如果用户中途改主意，灵活调整，不要死板地走流程
5. 用户可以随时说"跳过大纲直接生成草稿"、"帮我改个标题"，你要能响应
6. **语气自然**，像一个有经验的朋友在帮忙，不要过于正式
7. **生成草稿时必须一次性写完整篇**，不允许只写一节就停下来等确认 —— 用户要看到完整草稿才能判断

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
 * Detect what kind of structured content an AI message contains, so the
 * UI can decide which action buttons / step label to show.
 *
 * - "article"        full draft (long, multi-section) → applicable
 * - "outline"        article skeleton (headings + bullets) → applicable
 * - "topic-options"  numbered list of topic angles (meta-decision) → NOT applicable
 * - "none"           short conversational reply → no actions
 */
export type AgentContentType = "outline" | "article" | "topic-options" | "none";

export function detectContentType(content: string): AgentContentType {
  if (!content || content.length < 80) return "none";

  const lines = content.split("\n");
  const h1Count = lines.filter((l) => /^# /.test(l)).length;
  const h2Count = lines.filter((l) => /^## /.test(l)).length;
  const bulletCount = lines.filter((l) => /^[-*] /.test(l)).length;
  const numberedCount = lines.filter((l) => /^\d+\.\s/.test(l)).length;

  // Prose char count = lines that are neither heading nor bullet/numbered.
  // This is the real discriminator between outline (mostly bullets, little
  // prose) and article (mostly paragraphs, occasional bullets).
  const proseChars = lines
    .filter((l) => {
      const t = l.trim();
      if (!t) return false;
      if (/^#{1,6} /.test(t)) return false;
      if (/^[-*] /.test(t)) return false;
      if (/^\d+\.\s/.test(t)) return false;
      if (t.startsWith("<!--")) return false;
      return true;
    })
    .reduce((sum, l) => sum + l.length, 0);

  // Topic options: a numbered list of angles. We tolerate a fair bit of
  // prose (agent explains why each angle is interesting) and short
  // intro/outro paragraphs — what disqualifies this branch is the presence
  // of a multi-section heading structure (which means it's an outline /
  // article, not a topic-picker).
  if (numberedCount >= 3 && h2Count <= 1 && bulletCount <= 2) {
    return "topic-options";
  }

  // Article: substantial prose with at least one section. Check BEFORE
  // outline so drafts containing incidental bullet lists ("好处：- A - B")
  // aren't misclassified as outlines.
  if (proseChars >= 400 && h2Count >= 1) {
    return "article";
  }

  // Outline: bullets dominate, prose minimal.
  if (
    bulletCount >= 3 &&
    (h1Count >= 1 || h2Count >= 2) &&
    proseChars < 400
  ) {
    return "outline";
  }

  return "none";
}
