"use client";

import * as React from "react";
import {
  List as ListIcon,
  Sparkles,
  Loader2,
  FileText,
  Camera,
  Check,
  Tag as TagIcon,
  ClipboardCopy,
  PlusSquare,
  FileEdit,
  RotateCcw,
  Square,
  X,
  Pencil,
  ArrowUp,
  ArrowDown,
  Trash2,
  Plus,
} from "lucide-react";
import { useWorkshop, DEFAULT_MARKDOWN } from "@/lib/store";
import { loadSettings, loadWritingPreferences } from "@/lib/llm/providers";
import { streamChat } from "@/lib/llm/client";
import { withPrefs, type Skill } from "@/lib/llm/skills";
import { getTipTapEditor, insertAtCursor } from "@/lib/editor-ref";
import { SkillLibrary } from "@/components/ai/SkillLibrary";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils";
import {
  getDocument,
  putDocument,
  renameDocument,
  setDocumentTags,
  snapshotDocument,
} from "@/lib/docs/store";

type Tab = "outline" | "tools";

/**
 * "本篇" panel — everything that operates on the document currently in the
 * editor. Split into:
 *   - 大纲：read-only nav of the doc's headings
 *   - AI 工具：whole-doc skills (titles / CTA / compliance) that look at the
 *     full draft and produce structured suggestions. Inline / per-selection
 *     rewrites live in the editor's AIInlineMenu instead. From-scratch
 *     ideation / outline generation lives in the AI 写作助手 panel.
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
        <TabBtn active={tab === "tools"} onClick={() => setTab("tools")}>
          <Sparkles size={12} /> AI 工具
        </TabBtn>
      </div>
      <div className="flex-1 overflow-auto">
        {tab === "outline" && <OutlineView />}
        {tab === "tools" && <ToolsView />}
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
          className="flex-1 min-w-0 text-[13px] font-semibold bg-transparent border-none focus:outline-none placeholder:text-app-fg-subtle"
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

/**
 * Outline items mirror the doc's H1/H2/H3 lines. We compute them once from
 * the canonical `markdown` string in the store (the editor itself is just
 * derived state) and feed every outline mutation back through `setMarkdown`
 * so the editor re-renders without us having to talk to ProseMirror.
 *
 * Section boundary rule for delete / move:
 *   A section spans from its heading to the next heading of the SAME OR
 *   higher importance (lower number). Sub-headings stay with their parent.
 *   "Move up/down" only swaps with same-level siblings within the same
 *   parent — moving across parents is too surprising for a simple UI.
 */
type OutlineItem = { level: number; text: string; line: number };

function indexHeadings(md: string): OutlineItem[] {
  const lines = md.split("\n");
  const items: OutlineItem[] = [];
  let inCode = false;
  lines.forEach((line, i) => {
    if (line.startsWith("```")) inCode = !inCode;
    if (inCode) return;
    const m = /^(#{1,3})\s+(.+)/.exec(line);
    if (m) {
      const plain = m[2].replace(/<[^>]+>/g, "").trim();
      if (plain) items.push({ level: m[1].length, text: plain, line: i });
    }
  });
  return items;
}

/** Last line (exclusive) of the section starting at headings[idx]. */
function sectionEnd(headings: OutlineItem[], idx: number, totalLines: number): number {
  const cur = headings[idx];
  if (!cur) return totalLines;
  const next = headings.find((h, i) => i > idx && h.level <= cur.level);
  return next ? next.line : totalLines;
}

function renameHeadingInMarkdown(md: string, idx: number, newText: string): string {
  const headings = indexHeadings(md);
  const h = headings[idx];
  if (!h) return md;
  // Strip leading `#` characters from user input so they can't sneak in
  // extra heading marks that would shift the level.
  const clean = newText.replace(/^#+\s*/, "").trim();
  if (!clean) return md;
  const lines = md.split("\n");
  lines[h.line] = `${"#".repeat(h.level)} ${clean}`;
  return lines.join("\n");
}

function deleteSectionInMarkdown(md: string, idx: number): string {
  const lines = md.split("\n");
  const headings = indexHeadings(md);
  const h = headings[idx];
  if (!h) return md;
  const end = sectionEnd(headings, idx, lines.length);
  return [...lines.slice(0, h.line), ...lines.slice(end)].join("\n");
}

function moveSectionInMarkdown(
  md: string,
  idx: number,
  dir: -1 | 1
): string | null {
  const lines = md.split("\n");
  const headings = indexHeadings(md);
  const cur = headings[idx];
  if (!cur) return null;

  // Find sibling at same level, stopping at any parent (lower number = higher
  // importance) so we never silently jump into another branch.
  let sibIdx = -1;
  if (dir === 1) {
    for (let i = idx + 1; i < headings.length; i++) {
      if (headings[i].level < cur.level) break;
      if (headings[i].level === cur.level) {
        sibIdx = i;
        break;
      }
    }
  } else {
    for (let i = idx - 1; i >= 0; i--) {
      if (headings[i].level < cur.level) break;
      if (headings[i].level === cur.level) {
        sibIdx = i;
        break;
      }
    }
  }
  if (sibIdx === -1) return null;

  const curEnd = sectionEnd(headings, idx, lines.length);
  const sib = headings[sibIdx];
  const sibEnd = sectionEnd(headings, sibIdx, lines.length);

  if (dir === 1) {
    return [
      ...lines.slice(0, cur.line),
      ...lines.slice(sib.line, sibEnd),
      ...lines.slice(cur.line, curEnd),
      ...lines.slice(sibEnd),
    ].join("\n");
  } else {
    return [
      ...lines.slice(0, sib.line),
      ...lines.slice(cur.line, curEnd),
      ...lines.slice(sib.line, cur.line),
      ...lines.slice(curEnd),
    ].join("\n");
  }
}

/** Append a new H2 heading at end. Default heading level chosen to match
 *  the most common one in the doc, falling back to H2. */
function appendNewSection(md: string, text = "新小节"): string {
  const headings = indexHeadings(md);
  const levelCounts = new Map<number, number>();
  headings.forEach((h) =>
    levelCounts.set(h.level, (levelCounts.get(h.level) ?? 0) + 1)
  );
  const level =
    [...levelCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 2;
  const sep = md.endsWith("\n\n") ? "" : md.endsWith("\n") ? "\n" : "\n\n";
  return md + sep + "#".repeat(level) + " " + text + "\n";
}

function OutlineView() {
  const markdownValue = useWorkshop((s) => s.markdown);
  const setMarkdown = useWorkshop((s) => s.setMarkdown);
  const setSidebarPanel = useWorkshop((s) => s.setSidebarPanel);

  const [editingIdx, setEditingIdx] = React.useState<number | null>(null);
  const [draft, setDraft] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const outline = React.useMemo(
    () => indexHeadings(markdownValue),
    [markdownValue]
  );

  React.useEffect(() => {
    if (editingIdx == null) return;
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    el.select();
  }, [editingIdx]);

  // Walk the doc once and jump to the Nth heading. Matching by index, not
  // by text, so headings with identical names still navigate correctly.
  const jump = (idx: number) => {
    const editor = getTipTapEditor();
    if (!editor) return;
    let n = 0;
    let targetPos = -1;
    editor.state.doc.descendants((node, pos) => {
      if (targetPos !== -1) return false;
      if (node.type.name === "heading") {
        if (n === idx) {
          targetPos = pos;
          return false;
        }
        n++;
      }
      return true;
    });
    if (targetPos === -1) return;
    editor.chain().focus().setTextSelection(targetPos).scrollIntoView().run();
  };

  const startRename = (idx: number) => {
    setEditingIdx(idx);
    setDraft(outline[idx]?.text ?? "");
  };
  const cancelRename = () => setEditingIdx(null);
  const commitRename = () => {
    if (editingIdx == null) return;
    const target = outline[editingIdx];
    if (!target) {
      setEditingIdx(null);
      return;
    }
    const trimmed = draft.trim();
    if (trimmed && trimmed !== target.text) {
      setMarkdown(renameHeadingInMarkdown(markdownValue, editingIdx, trimmed));
    }
    setEditingIdx(null);
  };

  const move = (idx: number, dir: -1 | 1) => {
    const next = moveSectionInMarkdown(markdownValue, idx, dir);
    if (next != null) setMarkdown(next);
  };
  const remove = (idx: number) => {
    const h = outline[idx];
    if (!h) return;
    if (!confirm(`删除小节「${h.text}」及其下所有内容？`)) return;
    setMarkdown(deleteSectionInMarkdown(markdownValue, idx));
  };
  const addNew = () => {
    const nextMd = appendNewSection(markdownValue);
    setMarkdown(nextMd);
    const nextOutline = indexHeadings(nextMd);
    const newIdx = nextOutline.length - 1;
    setEditingIdx(newIdx);
    setDraft(nextOutline[newIdx]?.text ?? "");
  };

  // Cache sibling-existence per row to grey out move buttons that won't fire,
  // saving the user a click that does nothing.
  const canMove = React.useMemo(() => {
    return outline.map((cur, idx) => {
      let up = false;
      let down = false;
      for (let i = idx - 1; i >= 0; i--) {
        if (outline[i].level < cur.level) break;
        if (outline[i].level === cur.level) {
          up = true;
          break;
        }
      }
      for (let i = idx + 1; i < outline.length; i++) {
        if (outline[i].level < cur.level) break;
        if (outline[i].level === cur.level) {
          down = true;
          break;
        }
      }
      return { up, down };
    });
  }, [outline]);

  if (outline.length === 0) {
    return (
      <EmptyState
        icon={<ListIcon size={18} />}
        title="还没有小节"
        description="把段落改成「H1 / H2 / H3」（用编辑器顶部工具栏左侧的「正文 ▼」下拉），这里会列出每个小节，点击可以直接跳到正文对应位置。"
        tip={
          <button
            onClick={() => setSidebarPanel("ai")}
            className="underline underline-offset-2 hover:text-app-fg"
          >
            全新文档？去 AI 写作助手让它带你从选题写到大纲。
          </button>
        }
        density="compact"
      />
    );
  }

  return (
    <div className="py-1">
      <ul>
        {outline.map((h, i) => (
          <li key={i} className="group relative">
            {editingIdx === i ? (
              <div
                className="flex items-center"
                style={{ paddingLeft: 12 + (h.level - 1) * 14, paddingRight: 8 }}
              >
                <input
                  ref={inputRef}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.nativeEvent.isComposing) return;
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commitRename();
                    } else if (e.key === "Escape") {
                      e.preventDefault();
                      cancelRename();
                    }
                  }}
                  onBlur={commitRename}
                  className="flex-1 min-w-0 h-6 px-1.5 text-xs text-app-fg bg-app-bg border border-app-fg/40 rounded focus:outline-none"
                />
              </div>
            ) : (
              <div className="flex items-center">
                <button
                  onClick={() => jump(i)}
                  onDoubleClick={() => startRename(i)}
                  className="flex-1 min-w-0 text-left px-3 py-1.5 rounded text-xs text-app-fg hover:bg-app-surface-hover truncate"
                  style={{ paddingLeft: 12 + (h.level - 1) * 14 }}
                  title={`${h.text} · 双击改名`}
                >
                  {h.text}
                </button>
                <div className="flex items-center gap-0.5 pr-1.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                  <RowIconBtn
                    onClick={() => startRename(i)}
                    title="重命名"
                  >
                    <Pencil size={10} />
                  </RowIconBtn>
                  <RowIconBtn
                    onClick={() => move(i, -1)}
                    title="上移整节"
                    disabled={!canMove[i].up}
                  >
                    <ArrowUp size={10} />
                  </RowIconBtn>
                  <RowIconBtn
                    onClick={() => move(i, 1)}
                    title="下移整节"
                    disabled={!canMove[i].down}
                  >
                    <ArrowDown size={10} />
                  </RowIconBtn>
                  <RowIconBtn
                    onClick={() => remove(i)}
                    title="删除整节"
                    danger
                  >
                    <Trash2 size={10} />
                  </RowIconBtn>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
      <button
        onClick={addNew}
        className="mt-1 mx-2 px-2 py-1 rounded text-[11px] text-app-fg-muted hover:text-app-fg hover:bg-app-surface-hover transition-colors flex items-center gap-1"
      >
        <Plus size={11} /> 添加小节
      </button>
    </div>
  );
}

function RowIconBtn({
  children,
  onClick,
  title,
  disabled,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "w-5 h-5 rounded flex items-center justify-center transition-colors",
        disabled
          ? "text-app-fg-subtle/40 cursor-not-allowed"
          : danger
            ? "text-app-fg-muted hover:text-red-600 hover:bg-red-500/10"
            : "text-app-fg-muted hover:text-app-fg hover:bg-app-surface-hover"
      )}
    >
      {children}
    </button>
  );
}

// ---------- AI 工具 tab ----------

/**
 * Per-skill apply behavior. The skill registry doesn't know about UI
 * actions, so we map skill id → what the result panel should let the
 * user do with the streamed output.
 *
 *   info              copy only (suggestions / analysis)
 *   append            append output to the end of the document
 *   replace-doc       replace the entire document (with confirm if non-empty)
 *   replace-selection insert at cursor (we can't reliably replace the
 *                     original range from outside the editor, but
 *                     insertAtCursor lets the user place it next to the
 *                     selection they just made)
 */
type ApplyKind = "info" | "append" | "replace-doc" | "replace-selection";

const APPLY_KIND: Record<string, ApplyKind> = {
  brainstorm_topics: "info",
  analyze_competitor: "info",
  title_variants: "info",
  outline_pas: "replace-doc",
  outline_scqa: "replace-doc",
  expand_paragraph: "replace-selection",
  rewrite_tone: "replace-selection",
  add_hook: "replace-selection",
  outline_to_body: "replace-doc",
  cta_options: "append",
  compliance_check: "info",
};

function ToolsView() {
  const draft = useWorkshop((s) => s.markdown);
  const topic = useWorkshop((s) => s.topic);
  const setTopic = useWorkshop((s) => s.setTopic);
  const audience = useWorkshop((s) => s.audience);
  const setAudience = useWorkshop((s) => s.setAudience);
  const selection = useWorkshop((s) => s.selection);
  const setMarkdown = useWorkshop((s) => s.setMarkdown);
  const setSidebarPanel = useWorkshop((s) => s.setSidebarPanel);

  const [activeSkill, setActiveSkill] = React.useState<Skill | null>(null);
  const [output, setOutput] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  React.useEffect(() => () => abortRef.current?.abort(), []);

  // Tell the user *up-front* what's missing instead of letting them spend
  // tokens on a prompt the AI will refuse anyway.
  const validatePrereq = (skill: Skill): string | null => {
    if (skill.consumes === "draft") {
      const trimmed = draft.trim();
      if (!trimmed || trimmed === DEFAULT_MARKDOWN.trim()) {
        return "这个 skill 需要先有正文内容";
      }
    }
    if (skill.consumes === "selection" && !selection?.trim()) {
      return "这个 skill 需要先在编辑器里选中一段文字";
    }
    if (skill.consumes === "topic" && !topic?.trim()) {
      return "上面填一下「话题」再试";
    }
    return null;
  };

  const run = async (skill: Skill) => {
    setActiveSkill(skill);
    const settings = loadSettings();
    if (!settings?.apiKey) {
      setOutput("");
      setError("请先在 AI 写作助手里配置 LLM key");
      setSidebarPanel("ai");
      return;
    }
    const prereqError = validatePrereq(skill);
    if (prereqError) {
      setOutput("");
      setError(prereqError);
      return;
    }

    setOutput("");
    setError(null);
    setBusy(true);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const prompt = skill.buildPrompt({ draft, topic, audience, selection });
      const stream = streamChat(
        settings,
        [
          {
            role: "system",
            content: withPrefs(prompt.system, loadWritingPreferences()),
          },
          { role: "user", content: prompt.user },
        ],
        controller.signal
      );
      let acc = "";
      for await (const chunk of stream) {
        acc += chunk;
        setOutput(acc);
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message);
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  };

  const stop = () => abortRef.current?.abort();

  const copy = async () => {
    if (output) await navigator.clipboard.writeText(output);
  };

  const append = () => {
    if (!output) return;
    const sep = draft.endsWith("\n") ? "\n" : "\n\n";
    setMarkdown(draft + sep + output.trim() + "\n");
  };

  const replaceDoc = () => {
    if (!output) return;
    const trimmed = draft.trim();
    const hasContent = trimmed && trimmed !== DEFAULT_MARKDOWN.trim();
    if (hasContent && !confirm("会替换编辑器全部内容，确定？")) return;
    setMarkdown(output.trim());
  };

  const insertAtCursorAction = () => {
    if (!output) return;
    insertAtCursor("\n\n" + output.trim() + "\n\n");
  };

  const reset = () => {
    setActiveSkill(null);
    setOutput("");
    setError(null);
  };

  const applyKind: ApplyKind = activeSkill
    ? (APPLY_KIND[activeSkill.id] ?? "info")
    : "info";

  return (
    <div className="p-3 space-y-3">
      <SkillLibrary
        onPick={run}
        topicValue={topic}
        onTopicChange={setTopic}
        audienceValue={audience}
        onAudienceChange={setAudience}
      />

      {activeSkill && (busy || output || error) && (
        <div className="border border-app-border rounded-md bg-app-bg">
          <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 border-b border-app-border">
            <span className="text-[11px] font-medium text-app-fg flex items-center gap-1.5 min-w-0">
              <span>{activeSkill.emoji}</span>
              <span className="truncate">{activeSkill.name}</span>
              {busy && (
                <span className="text-app-fg-muted text-[10px] shrink-0">
                  生成中…
                </span>
              )}
            </span>
            <div className="flex items-center gap-0.5 shrink-0">
              {busy ? (
                <IconBtn onClick={stop} title="停止">
                  <Square size={11} />
                </IconBtn>
              ) : output ? (
                <>
                  <IconBtn onClick={() => run(activeSkill)} title="重新生成">
                    <RotateCcw size={11} />
                  </IconBtn>
                  <IconBtn onClick={copy} title="复制">
                    <ClipboardCopy size={11} />
                  </IconBtn>
                  {applyKind === "append" && (
                    <IconBtn onClick={append} title="追加到正文末尾">
                      <PlusSquare size={11} />
                    </IconBtn>
                  )}
                  {applyKind === "replace-doc" && (
                    <IconBtn onClick={replaceDoc} title="替换正文">
                      <FileEdit size={11} />
                    </IconBtn>
                  )}
                  {applyKind === "replace-selection" && (
                    <IconBtn
                      onClick={insertAtCursorAction}
                      title="插入到光标处"
                    >
                      <PlusSquare size={11} />
                    </IconBtn>
                  )}
                  <IconBtn onClick={reset} title="关闭">
                    <X size={11} />
                  </IconBtn>
                </>
              ) : (
                <IconBtn onClick={reset} title="关闭">
                  <X size={11} />
                </IconBtn>
              )}
            </div>
          </div>

          {error ? (
            <div className="px-2.5 py-2 text-[11px] text-red-700 dark:text-red-400">
              ⚠ {error}
            </div>
          ) : (
            <div className="px-2.5 py-2 max-h-[320px] overflow-auto text-xs leading-relaxed text-app-fg whitespace-pre-wrap">
              {output || (
                <span className="inline-flex items-center gap-1.5 text-app-fg-subtle">
                  <Loader2 size={11} className="animate-spin" /> 思考中…
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="w-6 h-6 rounded flex items-center justify-center text-app-fg-muted hover:text-app-fg hover:bg-app-surface-hover transition-colors"
    >
      {children}
    </button>
  );
}

// Re-importing putDocument here keeps the lazy ESM module graph happy when
// CurrentDocPanel is the first thing that touches `lib/docs/store`.
void putDocument;
