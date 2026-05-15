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
  Camera,
  Check,
  Tag as TagIcon,
} from "lucide-react";
import { useWorkshop, DEFAULT_MARKDOWN } from "@/lib/store";
import { loadSettings, loadWritingPreferences } from "@/lib/llm/providers";
import { streamChat } from "@/lib/llm/client";
import { STRATEGY_INVISIBILITY, withPrefs } from "@/lib/llm/skills";
import { getEditorView } from "@/lib/editor-ref";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils";
import {
  getDocument,
  putDocument,
  renameDocument,
  setDocumentTags,
  snapshotDocument,
} from "@/lib/docs/store";

type Tab = "outline" | "inspire" | "manual";

/**
 * "本篇" panel — everything about the document currently in the editor:
 *
 *   header: title + save status + snapshot button + tag chips
 *   tabs:   outline / AI 灵感 / 手写大纲
 */
export function CurrentDocPanel() {
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
      <DocHeader onLoadSample={loadSample} />
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

// ---------- Header (title + save status + snapshot) ----------

function DocHeader({ onLoadSample }: { onLoadSample: () => void }) {
  const activeDocId = useWorkshop((s) => s.activeDocId);
  const title = useWorkshop((s) => s.activeDocTitle);
  const setTitle = useWorkshop((s) => s.setActiveDocTitle);
  const saveStatus = useWorkshop((s) => s.saveStatus);
  const bumpDocList = useWorkshop((s) => s.bumpDocList);

  const [tags, setTags] = React.useState<string[]>([]);
  const [tagInput, setTagInput] = React.useState("");
  const [snapshotFlash, setSnapshotFlash] = React.useState(false);

  // Load tags from active doc when it changes
  React.useEffect(() => {
    if (!activeDocId) return;
    getDocument(activeDocId).then((doc) => setTags(doc?.tags ?? []));
  }, [activeDocId]);

  const persistTitle = async () => {
    if (!activeDocId) return;
    await renameDocument(activeDocId, title);
    bumpDocList();
  };

  const onTitleBlur = () => {
    void persistTitle();
  };
  const onTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      (e.target as HTMLInputElement).blur();
    }
  };

  const addTag = async (t: string) => {
    if (!activeDocId) return;
    const clean = t.trim();
    if (!clean) return;
    const next = Array.from(new Set([...tags, clean]));
    setTags(next);
    await setDocumentTags(activeDocId, next);
    bumpDocList();
  };
  const removeTag = async (t: string) => {
    if (!activeDocId) return;
    const next = tags.filter((x) => x !== t);
    setTags(next);
    await setDocumentTags(activeDocId, next);
    bumpDocList();
  };

  const onTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      void addTag(tagInput);
      setTagInput("");
    } else if (e.key === "Backspace" && !tagInput && tags.length) {
      void removeTag(tags[tags.length - 1]);
    }
  };

  const onSnapshot = async () => {
    if (!activeDocId) return;
    await snapshotDocument(activeDocId);
    setSnapshotFlash(true);
    setTimeout(() => setSnapshotFlash(false), 1500);
  };

  return (
    <div className="px-4 py-3 border-b border-app-border space-y-2">
      <div className="flex items-start justify-between gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={onTitleBlur}
          onKeyDown={onTitleKeyDown}
          placeholder="未命名文档"
          className="flex-1 min-w-0 text-sm font-semibold bg-transparent border-none focus:outline-none placeholder:text-app-fg-subtle"
        />
        <button
          onClick={onLoadSample}
          title="载入完整的功能介绍 + 测试稿（覆盖当前内容）"
          className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] text-app-fg-subtle hover:text-app-fg hover:bg-app-surface-hover transition-colors shrink-0"
        >
          <FileText size={11} />
          示例
        </button>
      </div>

      {/* Tag chips + input */}
      <div className="flex flex-wrap items-center gap-1">
        <TagIcon size={11} className="text-app-fg-subtle shrink-0" />
        {tags.map((t) => (
          <button
            key={t}
            onClick={() => removeTag(t)}
            className="text-[10px] px-1.5 py-0.5 rounded bg-app-surface-hover text-app-fg-muted hover:text-red-600 transition-colors"
            title="点击移除"
          >
            #{t}
          </button>
        ))}
        <input
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={onTagKeyDown}
          placeholder="加标签 (Enter)"
          className="flex-1 min-w-[60px] h-5 px-1 text-[10px] bg-transparent text-app-fg placeholder:text-app-fg-subtle focus:outline-none"
        />
      </div>

      {/* Save status + snapshot */}
      <div className="flex items-center justify-between gap-2 text-[11px] pt-1">
        <SaveBadge status={saveStatus} />
        <button
          onClick={onSnapshot}
          className={cn(
            "flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors",
            snapshotFlash
              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
              : "text-app-fg-muted hover:text-app-fg hover:bg-app-surface-hover"
          )}
          title="为当前版本打一个快照（Phase B 加恢复 UI）"
        >
          {snapshotFlash ? (
            <>
              <Check size={11} /> 已存
            </>
          ) : (
            <>
              <Camera size={11} /> 快照
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function SaveBadge({ status }: { status: "saved" | "saving" | "dirty" }) {
  if (status === "saved") {
    return <span className="text-app-fg-subtle">✓ 已保存</span>;
  }
  if (status === "saving") {
    return (
      <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
        <Loader2 size={10} className="animate-spin" />
        保存中…
      </span>
    );
  }
  return <span className="text-app-fg-muted">未保存</span>;
}

// ---------- Shared TabBtn ----------

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
      if (m) items.push({ level: m[1].length, text: m[2], lineIndex: i });
    });
    return items;
  }, [markdownValue]);

  const jump = (lineIndex: number) => {
    const view = getEditorView();
    if (!view) return;
    const doc = view.state.doc;
    const line = doc.line(Math.min(lineIndex + 1, doc.lines));
    view.dispatch({
      selection: { anchor: line.from },
      scrollIntoView: true,
    });
    view.focus();
  };

  if (outline.length === 0) {
    return (
      <EmptyState
        icon={<ListIcon size={18} />}
        title="还没有标题"
        description="写一行 ## 标题，大纲就会自动出现在这里。"
        tip="想从零开始？切到「AI 灵感」让 AI 帮你出一份完整大纲。"
        density="compact"
      />
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
  const setAiOpen = useWorkshop((s) => s.setAiOpen);
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
      setError("请先在 AI 副驾驶里配置 LLM key");
      setAiOpen(true);
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
      const baseSystem = `你是一位资深内容主编，深谙各类内容结构（PAS / SCQA / AIDA / 钩子串 / 故事+反转 / 盘点清单）。你输出的大纲都是可直接落地的，不写废话不写解释。\n${STRATEGY_INVISIBILITY}`;
      const system = withPrefs(baseSystem, loadWritingPreferences());
      const user = `请围绕话题「${topic}」、读者「${audience || "通用读者"}」，按 ${template} 结构写一份完整大纲。

要求：
- 输出格式严格按 Markdown，使用 # 作为文章标题、## 作为大节、- 作为要点
- 每个 ## 节下至少 2-3 个具体要点
- 第一节是钩子段（包含开头的 1-2 句具体抓住读者的话）
- 最后一节是 CTA（具体引导行动）
- 大纲就是大纲，不要写正文段落
- 二级标题必须是有内容感的自然标题，**绝对不要写 "S-情景"、"C-冲突"、"P-Problem" 这种策略标签**

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
        「应用到正文」，大纲会成为编辑器的初始稿，再用 AI 副驾驶逐节扩写。
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

// Re-importing putDocument here keeps the lazy ESM module graph happy when
// CurrentDocPanel is the first thing that touches `lib/docs/store`.
void putDocument;
