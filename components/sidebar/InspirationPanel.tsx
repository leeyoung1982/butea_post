"use client";

import * as React from "react";
import {
  Lightbulb,
  Pencil,
  List as ListIcon,
  Sparkles,
  Loader2,
  ChevronDown,
  FileText,
} from "lucide-react";
import { useWorkshop, DEFAULT_MARKDOWN } from "@/lib/store";
import { loadSettings } from "@/lib/llm/providers";
import { streamChat } from "@/lib/llm/client";
import { getTipTapEditor } from "@/lib/editor-ref";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

type Tab = "outline" | "inspire" | "manual";

/**
 * Left-rail "Inspiration & Outline" panel — three tabs:
 *   1. Outline: live H1/H2/H3 reader of the current draft, click to jump.
 *   2. Inspire: enter a topic/audience, AI brainstorms outline candidates.
 *   3. Manual: free-form outline editor; "用此大纲生成正文" injects into MD.
 */
export function InspirationPanel() {
  const [tab, setTab] = React.useState<Tab>("outline");
  const setMarkdown = useWorkshop((s) => s.setMarkdown);

  const loadSample = () => {
    if (
      confirm(
        "载入示例文档将覆盖当前编辑器内容（其它设置不变）。确定？"
      )
    ) {
      setMarkdown(DEFAULT_MARKDOWN);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-app-border flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-medium">大纲 · 灵感</div>
          <div className="text-[11px] text-app-fg-muted mt-0.5">
            从结构开始写，比从空白页开始写容易十倍
          </div>
        </div>
        <button
          onClick={loadSample}
          title="载入完整的功能介绍 + 测试稿到编辑器（覆盖当前内容）"
          className="flex items-center gap-1 px-2 py-1 rounded text-[11px] text-app-fg-muted hover:text-app-fg hover:bg-app-surface-hover transition-colors shrink-0"
        >
          <FileText size={11} />
          载入示例
        </button>
      </div>
      <div className="flex border-b border-app-border bg-app-surface text-xs">
        <TabBtn active={tab === "outline"} onClick={() => setTab("outline")}>
          <ListIcon size={12} /> 大纲
        </TabBtn>
        <TabBtn active={tab === "inspire"} onClick={() => setTab("inspire")}>
          <Lightbulb size={12} /> AI 灵感
        </TabBtn>
        <TabBtn active={tab === "manual"} onClick={() => setTab("manual")}>
          <Pencil size={12} /> 手写大纲
        </TabBtn>
      </div>
      <div className="flex-1 overflow-auto">
        {tab === "outline" && <OutlineView />}
        {tab === "inspire" && <InspireView />}
        {tab === "manual" && <ManualView />}
      </div>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-1 flex items-center justify-center gap-1 px-2 py-2 transition-colors",
        active
          ? "text-app-fg border-b-2 border-app-fg -mb-px"
          : "text-app-fg-muted hover:text-app-fg"
      )}
    >
      {children}
    </button>
  );
}

// ---------- Outline tab ----------

function OutlineView() {
  const markdownValue = useWorkshop((s) => s.markdown);

  const outline = React.useMemo(() => {
    const lines = markdownValue.split("\n");
    const items: { level: number; text: string; lineIndex: number }[] = [];
    let inCode = false;
    lines.forEach((line, i) => {
      if (line.startsWith("```")) inCode = !inCode;
      if (inCode) return;
      const m = /^(#{1,3})\s+(.+)/.exec(line);
      if (m) {
        const plain = m[2].replace(/<[^>]+>/g, "").trim();
        if (plain) items.push({ level: m[1].length, text: plain, lineIndex: i });
      }
    });
    return items;
  }, [markdownValue]);

  const jump = (lineIndex: number) => {
    const editor = getTipTapEditor();
    if (!editor) return;
    const target = outline.find((h) => h.lineIndex === lineIndex);
    if (!target) return;
    let targetPos = 0;
    let found = false;
    editor.state.doc.descendants((node, pos) => {
      if (found) return false;
      if (node.type.name === "heading" && node.textContent.trim() === target.text) {
        targetPos = pos;
        found = true;
        return false;
      }
      return true;
    });
    editor.chain().focus().setTextSelection(targetPos).scrollIntoView().run();
  };

  if (outline.length === 0) {
    return (
      <div className="px-4 py-10 text-center text-xs text-app-fg-muted">
        还没有标题。写一行 <code className="text-app-fg">## 标题</code> 试试，或切到「AI 灵感」让 AI 帮你出大纲。
      </div>
    );
  }

  return (
    <ul className="py-2">
      {outline.map((h, i) => (
        <li key={i}>
          <button
            onClick={() => jump(h.lineIndex)}
            className="w-full text-left px-3 py-1.5 rounded text-xs text-app-fg hover:bg-app-surface-hover truncate"
            style={{ paddingLeft: 12 + (h.level - 1) * 14 }}
            title={h.text}
          >
            {h.text}
          </button>
        </li>
      ))}
    </ul>
  );
}

// ---------- Inspire tab ----------

const OUTLINE_TEMPLATES = [
  { id: "pas", label: "PAS · 痛点-加剧-方案", value: "PAS" },
  { id: "scqa", label: "SCQA · 情境-冲突-问题-答案", value: "SCQA" },
  { id: "aida", label: "AIDA · 注意-兴趣-欲望-行动", value: "AIDA" },
  { id: "hook", label: "钩子串结构", value: "钩子串（每段一个新钩子）" },
  { id: "story", label: "故事+反转", value: "故事+反转" },
  { id: "list", label: "盘点 / 清单", value: "盘点清单（5-10 条）" },
];

function InspireView() {
  const topic = useWorkshop((s) => s.topic);
  const setTopic = useWorkshop((s) => s.setTopic);
  const audience = useWorkshop((s) => s.audience);
  const setAudience = useWorkshop((s) => s.setAudience);
  const setMarkdown = useWorkshop((s) => s.setMarkdown);
  const setSidebarPanel = useWorkshop((s) => s.setSidebarPanel);
  const [template, setTemplate] = React.useState("PAS");
  const [extra, setExtra] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  const generate = async () => {
    setError(null);
    setResult("");
    const settings = loadSettings();
    if (!settings?.apiKey) {
      setError("请先在 AI 写作助手里配置 LLM key");
      setSidebarPanel("ai");
      return;
    }
    if (!topic.trim()) {
      setError("先填一个赛道 / 话题");
      return;
    }
    setBusy(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const system = `你是一位资深内容主编，深谙各类内容结构（PAS / SCQA / AIDA / 钩子串 / 故事+反转 / 盘点清单）。你输出的大纲都是可直接落地的，不写废话不写解释。`;
      const user = `请围绕话题「${topic}」、读者「${audience || "通用读者"}」，按 ${template} 结构写一份完整大纲。

要求：
- 输出格式严格按 Markdown，使用 # 作为文章标题、## 作为大节、- 作为要点
- 每个 ## 节下至少 2-3 个具体要点
- 第一节是钩子段（包含开头的 1-2 句具体抓住读者的话）
- 最后一节是 CTA（具体引导行动）
- 大纲就是大纲，不要写正文段落

${extra ? `额外约束：${extra}` : ""}

直接输出，不要包装、不要解释。`;
      const stream = streamChat(
        settings,
        [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        controller.signal
      );
      let acc = "";
      for await (const chunk of stream) {
        acc += chunk;
        setResult(acc);
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setError((e as Error).message);
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  };

  const cancel = () => {
    abortRef.current?.abort();
    setResult("");
  };

  const apply = () => {
    if (!result) return;
    // Strip any leading ```markdown / ``` wrappers
    const cleaned = result
      .replace(/^```(?:markdown|md)?\s*\n/, "")
      .replace(/\n```\s*$/, "")
      .trim();
    setMarkdown(cleaned);
  };

  return (
    <div className="p-3 space-y-3 text-xs">
      <Field label="赛道 / 话题">
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="如：副业焦虑"
          className="w-full h-7 px-2 rounded border border-app-border bg-app-bg text-xs text-app-fg placeholder:text-app-fg-subtle focus:outline-none focus:border-app-fg-muted"
        />
      </Field>
      <Field label="目标读者">
        <input
          value={audience}
          onChange={(e) => setAudience(e.target.value)}
          placeholder="25-35 岁白领"
          className="w-full h-7 px-2 rounded border border-app-border bg-app-bg text-xs text-app-fg placeholder:text-app-fg-subtle focus:outline-none focus:border-app-fg-muted"
        />
      </Field>
      <Field label="结构模板">
        <div className="relative">
          <select
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            className="w-full h-7 px-2 pr-7 rounded border border-app-border bg-app-bg text-xs text-app-fg appearance-none"
          >
            {OUTLINE_TEMPLATES.map((t) => (
              <option key={t.id} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <ChevronDown
            size={12}
            className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-app-fg-subtle"
          />
        </div>
      </Field>
      <Field label="额外约束（可选）">
        <textarea
          value={extra}
          onChange={(e) => setExtra(e.target.value)}
          rows={2}
          placeholder="如：希望开头用一个故事钩子；尽量避开陈词滥调"
          className="w-full px-2 py-1 rounded border border-app-border bg-app-bg text-xs text-app-fg placeholder:text-app-fg-subtle resize-none focus:outline-none focus:border-app-fg-muted"
        />
      </Field>

      {error && (
        <div className="text-[11px] text-red-700 dark:text-red-400">⚠ {error}</div>
      )}

      <div className="flex gap-2">
        {busy ? (
          <Button onClick={cancel} variant="secondary" className="flex-1" size="sm">
            <Loader2 size={12} className="animate-spin" />
            生成中... 停止
          </Button>
        ) : (
          <Button onClick={generate} className="flex-1" size="sm">
            <Sparkles size={12} />
            生成大纲
          </Button>
        )}
      </div>

      {result && (
        <div className="space-y-2">
          <div className="text-[10px] uppercase tracking-wider text-app-fg-subtle">
            结果
          </div>
          <div className="bg-app-bg border border-app-border rounded p-2.5 text-[11px] leading-relaxed whitespace-pre-wrap max-h-[260px] overflow-auto">
            {result}
          </div>
          <Button
            onClick={apply}
            variant="default"
            className="w-full"
            size="sm"
            disabled={busy}
          >
            应用到正文（会替换当前编辑器内容）
          </Button>
        </div>
      )}
    </div>
  );
}

// ---------- Manual tab ----------

const DEFAULT_OUTLINE = `# 标题
## 第一节
- 要点 1
- 要点 2
## 第二节
- ...
## CTA
- ...`;

function ManualView() {
  const setMarkdown = useWorkshop((s) => s.setMarkdown);
  const [text, setText] = React.useState(DEFAULT_OUTLINE);

  const apply = () => {
    if (!text.trim()) return;
    setMarkdown(text);
  };

  return (
    <div className="p-3 space-y-2 text-xs">
      <div className="text-[11px] text-app-fg-muted leading-relaxed">
        在下方用 Markdown 写大纲（#=标题、##=小节、-=要点）。写好点
        「应用到正文」，大纲会成为编辑器的初始稿，再用 AI 写作助手逐节扩写。
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={14}
        className="w-full px-2.5 py-2 rounded border border-app-border bg-app-bg text-xs text-app-fg font-mono leading-relaxed resize-none focus:outline-none focus:border-app-fg-muted"
      />
      <Button onClick={apply} className="w-full" size="sm">
        应用到正文（会替换当前编辑器内容）
      </Button>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-wider text-app-fg-subtle">
        {label}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
