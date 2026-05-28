// "公众号爆文写作" skill library — each skill is a Prompt-as-Function.
// The chat panel exposes these as one-click templates; the inline action menu
// can also invoke them on selected text.

export type SkillCategory =
  | "ideation"
  | "title"
  | "outline"
  | "writing"
  | "closing"
  | "compliance";

export type Skill = {
  id: string;
  name: string;
  emoji: string;
  category: SkillCategory;
  short: string;
  // Whether this skill operates on the user's current selection / draft
  consumes: "none" | "selection" | "draft" | "topic";
  // Build the prompt sent to the LLM, given inputs from the UI.
  buildPrompt: (ctx: SkillContext) => SkillPrompt;
};

export type SkillContext = {
  topic?: string;
  audience?: string;
  selection?: string;
  draft?: string;
  extra?: string;
  /** User's customized writing-style preferences from Settings. Optional. */
  writingPreferences?: string;
};

export type SkillPrompt = {
  system: string;
  user: string;
};

/**
 * CRITICAL invisibility rule. Without this, AI tends to leak strategy
 * names ("S-情景 / C-冲突 / Q-问题") as section headings, which feels
 * extremely unnatural to readers.
 */
const STRATEGY_INVISIBILITY = `
重要的写作原则 — 策略隐形：
- PAS / SCQA / AIDA / 钩子串 / 故事+反转 等都是**写作策略**，不是给读者看的标签。
- 用具体的、有内容感的二级标题（## 自然的小节名），不要写"S-情景"、"C-冲突"、"Q-核心问题"、"Problem"、"Agitate"、"Solution"这种标签。
- 内容上**执行**策略（开场抓注意力、中段制造张力、结尾给出方案），但**外观上让读者感觉是一篇普通的好文章**。
- 错误示范：## C：冲突
- 正确示范：## 当通勤变成"第二个上班"`;

const BAOWEN_SYSTEM = `你是一位有 8 年经验的微信公众号主编，深谙"爆文"的内容设计原则：
1. 选题必须命中具体读者的具体痛点或兴趣，不写大词；
2. 标题遵循"利益、悬念、反差、数字、情绪、具体场景"六类心理钩子，且不做夸大与违规宣传；
3. 结构以 3 秒钩子开场、每 300 字一个新钩子（数据/故事/反转/金句/疑问），结尾要有明确 CTA；
4. 表达口语化、有节奏感、长短句交错，避免书面语堆砌，避免空话套话；
5. 你的回答必须可直接落地，不要写"你可以这样写"之类的元话语。

CRITICAL: 保留原文语言（中文进中文出、英文进英文出）。NEVER translate between languages.
${STRATEGY_INVISIBILITY}`;

/** Compose system prompt with user's optional writing-style preferences. */
export function withPrefs(base: string, prefs?: string): string {
  if (!prefs?.trim()) return base;
  return `${base}\n\n这位作者的个人写作偏好（必须遵守）：\n${prefs.trim()}`;
}

/** Shared invisibility rule — exported so other AI flows (outline gen,
 *  inline rewrite, nativization) can include it too. */
export { STRATEGY_INVISIBILITY };

/** Image-suggestion marker: when AI generates body content, it should emit
 *  these markers between paragraphs where a visual would help. We use the
 *  Obsidian-style `[!image]` callout — it renders as a visually distinct
 *  pink/dashed placeholder card in the editor so the user can't miss it,
 *  and the publish pipeline strips these blocks (with a warning banner if
 *  any remain unfulfilled). */
export const IMAGE_SUGGESTION_RULE = `
配图建议（必须严格按此格式，编辑器只认这一种语法）：

在每个有强烈视觉感的位置后，插入一条配图建议占位。**类型标签必须写 \`配图\`（中文）**，不要用 \`note\`、\`tip\`、\`warning\` 等其他 callout 类型 —— 编辑器专门为配图占位定义了"配图"这个 callout 类型。

✅ 正确格式（单行 blockquote，类型 = 配图）：
> [!配图] 一双跑鞋放在办公桌旁的特写，背景是模糊的工位灯光
> [!配图] 俯视镜头：城市夜跑路线在地图上画出心形轨迹

❌ 错误示例 1（类型用了 note，系统会当成普通笔记，颜色和图标都不对）：
> [!note] 一双跑鞋放在...

❌ 错误示例 2（散文形式不是 callout，会被当成正文）：
📸 配图建议：一双跑鞋...

❌ 错误示例 3（HTML 注释肉眼完全不可见）：
<!-- 配图建议：一双跑鞋... -->

要点：
- 类型标签写 \`配图\` 两个中文字符
- 描述跟在 \`[!配图]\` 后面、同一行写完
- 描述要具体（镜头视角、构图、情绪、色调），不要写"插一张相关的图"这种空话
- 整篇 3-5 处为佳，只在真正能增强阅读的位置加`;

export const SKILLS: Skill[] = [
  // ---------- 选题 ----------
  {
    id: "brainstorm_topics",
    name: "选题脑暴",
    emoji: "💡",
    category: "ideation",
    short: "给定赛道与读者画像，输出 10 个差异化选题",
    consumes: "topic",
    buildPrompt: ({ topic, audience }) => ({
      system: BAOWEN_SYSTEM,
      user: `请围绕赛道「${topic || "（用户未填，请你先反问一句确认赛道）"}」、目标读者「${
        audience || "通用读者"
      }」，输出 10 个差异化的公众号选题。要求：

每条用以下格式输出：
- 选题：……
  - 一句话钩子：……
  - 候选标题（2 条，类型不同）：……
  - 适合的结构（PAS / AIDA / SCQA / 故事+反转 / 盘点 中选一种）：……
  - 预估的点击诱因（在"利益/悬念/反差/数字/情绪/场景"中标注 1-2 项）：……

第 10 条请故意做一个"反共识 / 唱反调"的角度。不要重复，不要废话。`,
    }),
  },
  {
    id: "analyze_competitor",
    name: "拆解爆款",
    emoji: "🔍",
    category: "ideation",
    short: "粘贴一篇文章，拆解它为何爆",
    consumes: "selection",
    buildPrompt: ({ selection, extra }) => ({
      system: BAOWEN_SYSTEM,
      user: `下面是一篇公众号文章，请你以主编视角拆解它为什么能爆：

---
${selection || "（请选中或粘贴对方文章正文）"}
---

请按下列结构作答：
1. 选题的"小切口"是什么？为什么击中读者？
2. 标题用了哪种心理钩子？为什么有效？
3. 开头 3 秒抓注意力的具体动作（一句话指出来）
4. 文章用了什么结构（PAS / AIDA / SCQA / 故事 / 反转 / 盘点）？
5. 钩子位置（在哪几段又抛一个新钩子）
6. 收尾 CTA 是什么？转化逻辑是什么？
7. 我们可以借鉴的 3 个具体动作（不要泛泛而谈）

${extra ? `额外补充：${extra}` : ""}`,
    }),
  },

  // ---------- 标题 ----------
  {
    id: "title_variants",
    name: "标题魔咒",
    emoji: "🎯",
    category: "title",
    short: "围绕草稿内容生成 10 个不同类型的标题",
    consumes: "draft",
    buildPrompt: ({ draft, topic }) => ({
      system: BAOWEN_SYSTEM,
      user: `下面是文章的核心内容${topic ? `（核心议题：${topic}）` : ""}：

---
${draft?.slice(0, 2000) || "（请先在编辑器写点内容）"}
---

请输出 10 个候选标题，每条标题前用方括号标注它的"类型"，覆盖以下 10 种类型各一条：
[数字型]、[反差型]、[悬念型]、[利益型]、[情绪型]、[场景型]、[盘点型]、[警告型]、[反共识型]、[对比型]

每个标题不超过 25 个字。最后给我一个"推荐使用 + 理由"。不要使用违禁词（详见微信广告规范），如绝对化用语、医疗承诺等。`,
    }),
  },

  // ---------- 大纲 ----------
  {
    id: "outline_pas",
    name: "PAS 大纲",
    emoji: "🧭",
    category: "outline",
    short: "痛点-加剧-方案：转化型文章首选",
    consumes: "topic",
    buildPrompt: ({ topic, audience, extra }) => ({
      system: BAOWEN_SYSTEM,
      user: `围绕主题「${topic}」、读者「${audience || "通用读者"}」，写一份 PAS 结构大纲：

# 痛点（Problem）
- 用 1-2 句话刻画读者此刻的真实困境（要具体场景，不要抽象）
- 抓 3 秒注意力的开场金句（可备 2 条）

# 加剧（Agitate）
- 把"不解决会怎样"放大，2-3 个具体后果
- 此处放一个"钩子"（故事 / 数据 / 反转 任选一种）

# 方案（Solution）
- 给出 3-5 步可执行方案
- 每一步给一个"读者一看就能做"的小动作

# 收尾 CTA
- 一句金句收束 + 一个明确的下一步行动

${extra ? `补充约束：${extra}` : ""}

请直接给出大纲，不要解释 PAS 是什么。`,
    }),
  },
  {
    id: "outline_scqa",
    name: "SCQA 大纲",
    emoji: "🪜",
    category: "outline",
    short: "情境-冲突-问题-答案：观点型/分析型首选",
    consumes: "topic",
    buildPrompt: ({ topic, audience, extra }) => ({
      system: BAOWEN_SYSTEM,
      user: `围绕主题「${topic}」、读者「${audience || "通用读者"}」，写一份 SCQA 结构大纲：

# Situation 情境
…
# Complication 冲突
…
# Question 核心问题
…
# Answer 答案（拆 3-5 个分论点，每个论点配 1 个故事/数据/案例）
…

最后附上：开头钩子 2 个候选、收尾金句 1 句、CTA 1 个。
${extra ? `补充约束：${extra}` : ""}`,
    }),
  },

  // ---------- 写作 ----------
  {
    id: "expand_paragraph",
    name: "段落扩写",
    emoji: "✍️",
    category: "writing",
    short: "选中段落，让 LLM 自然扩写并补充例子",
    consumes: "selection",
    buildPrompt: ({ selection }) => ({
      system: BAOWEN_SYSTEM,
      user: `请把下面这段扩写到 1.5-2 倍长度，要求：
- 保留原意，不改变立场
- 加入 1 个具体的例子或数据
- 增加节奏感（长短句交错）
- 不要使用书面语和空话套话

原文：
"""
${selection || "（请先在编辑器选中要扩写的段落）"}
"""

直接输出扩写后的版本，不要解释。`,
    }),
  },
  {
    id: "rewrite_tone",
    name: "切换文风",
    emoji: "🎭",
    category: "writing",
    short: "把选中的段落改成不同语气（口语/犀利/专业等）",
    consumes: "selection",
    buildPrompt: ({ selection, extra }) => ({
      system: BAOWEN_SYSTEM,
      user: `请把下面这段改写成「${extra || "更口语、更有人味"}」的风格：

"""
${selection || "（请先选中要改写的段落）"}
"""

只输出改写后的版本，不要解释。`,
    }),
  },
  {
    id: "add_hook",
    name: "加钩子",
    emoji: "🪝",
    category: "writing",
    short: "在选中位置补一个钩子（故事/数据/反转/疑问）",
    consumes: "selection",
    buildPrompt: ({ selection }) => ({
      system: BAOWEN_SYSTEM,
      user: `下面是文章中间某段，读者在这里很可能划走。请在它后面补一个"钩子"，类型自选（一个具体故事 / 一个具体数据 / 一个反转 / 一个反问），让读者愿意继续往下读：

"""
${selection || "（请先选中需要加钩子的段落）"}
"""

输出格式：保留原段落，然后另起一段输出钩子内容。不超过 200 字。`,
    }),
  },

  // ---------- 收尾 ----------
  {
    id: "cta_options",
    name: "结尾 CTA",
    emoji: "🎁",
    category: "closing",
    short: "生成 5 种类型的结尾 CTA",
    consumes: "draft",
    buildPrompt: ({ draft, extra }) => ({
      system: BAOWEN_SYSTEM,
      user: `基于这篇草稿（节选）：

"""
${draft?.slice(-1500) || "（请先写完正文再生成 CTA）"}
"""

请输出 5 种结尾 CTA，分别对应：关注引导、转发引导、在看引导、留言引导、福利引导（${
        extra ? "结合补充：" + extra : "可虚构一个合理福利"
      }）。每条都用一段话写完整，不超过 80 字，避免命令口吻。`,
    }),
  },

  // ---------- 大纲 → 正文 ----------
  {
    id: "outline_to_body",
    name: "大纲扩写为正文",
    emoji: "📝",
    category: "writing",
    short: "把当前编辑器里的大纲扩展成完整正文，自动加配图建议",
    consumes: "draft",
    buildPrompt: ({ draft, topic, audience }) => ({
      system: `${BAOWEN_SYSTEM}\n${IMAGE_SUGGESTION_RULE}`,
      user: `下面是这篇文章的大纲（含结构提示）。请把它扩展为一篇完整的公众号长读。

${topic ? `话题：${topic}` : ""}
${audience ? `目标读者：${audience}` : ""}

大纲：
"""
${draft || "（请先写或生成大纲）"}
"""

要求：
1. 保留大纲的整体结构和小节顺序，但**重写所有二级标题**为有内容感的自然标题（不要留"S/C/Q/PAS"等策略标签）
2. 每一节扩展到 200-500 字，符合主编系统提示里的节奏规则
3. 在合适的地方插入「配图建议」注释（详见系统提示的配图规则）
4. 开头第一段必须是 3 秒钩子（具体场景 / 反差 / 数字 / 提问）
5. 结尾给出明确 CTA（关注 / 转发 / 留言 / 福利）

输出完整的 Markdown 正文，不要外层包装、不要解释做了什么。`,
    }),
  },

  // ---------- 合规 ----------
  {
    id: "compliance_check",
    name: "合规预检",
    emoji: "🛡️",
    category: "compliance",
    short: "扫描全文，找出违规用语和风险点",
    consumes: "draft",
    buildPrompt: ({ draft }) => ({
      system: `你是一位熟悉《微信公众平台运营规范》和《广告法》的合规审核员。`,
      user: `请审核下面这篇公众号草稿，标出所有合规风险点（包括但不限于：绝对化用语如"最/第一/唯一"、医疗效果承诺、金融收益承诺、违规话题、虚假宣传嫌疑等），并给出修改建议：

"""
${draft || "（请先写正文）"}
"""

请用以下格式输出：
| 风险等级 | 原文片段 | 风险类型 | 建议改法 |
|---|---|---|---|
高 / 中 / 低 各分一栏。若全文无风险，直接说"未发现明显风险"。`,
    }),
  },
];

export const SKILL_CATEGORIES: { id: SkillCategory; label: string }[] = [
  { id: "ideation", label: "选题" },
  { id: "title", label: "标题" },
  { id: "outline", label: "大纲" },
  { id: "writing", label: "写作" },
  { id: "closing", label: "收尾" },
  { id: "compliance", label: "合规" },
];

export function getSkillsByCategory(cat: SkillCategory): Skill[] {
  return SKILLS.filter((s) => s.category === cat);
}

export function getSkill(id: string): Skill | undefined {
  return SKILLS.find((s) => s.id === id);
}
