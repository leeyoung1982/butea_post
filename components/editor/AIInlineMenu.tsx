"use client";

import * as React from "react";
import {
  Sparkles,
  ChevronDown,
  Loader2,
  Wand2,
  Anchor,
  FileText,
  Smile,
  Scissors,
  Check,
  Image as ImageIcon,
  Newspaper,
} from "lucide-react";
import * as Popover from "@radix-ui/react-popover";
import { useWorkshop } from "@/lib/store";
import { AppDialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { loadSettings, loadWritingPreferences } from "@/lib/llm/providers";
import { withPrefs } from "@/lib/llm/skills";
import { streamChat } from "@/lib/llm/client";
import {
  insertAtCursor,
  readActiveSelection,
  replaceRange,
} from "@/lib/editor-ref";
import { toast } from "@/components/ui/toast";
import { AIImageDialog } from "./dialogs/AIImageDialog";

/**
 * Buffer-style inline AI button next to the formatting toolbar. The user
 * picks a quick action (expand selection, change tone, add hook, ...);
 * the chosen action streams AI output into a dialog where the user can
 * accept (replace selection / insert below) or cancel.
 *
 * Why a dialog (not a floating popover)? Inline streaming popovers are
 * fiddly to position and easy to lose; a modal keeps focus, supports long
 * AI outputs, and reuses our existing AppDialog component. The latency
 * cost is tiny (one click to dismiss).
 */

type ActionId = "expand" | "casual" | "concise" | "hook" | "polish";

type Action = {
  id: ActionId;
  label: string;
  description: string;
  icon: React.ReactNode;
  /** True if the action requires a non-empty selection. */
  needsSelection: boolean;
  /** Build the prompt body given context. */
  buildSystem: () => string;
  buildUser: (ctx: { selection: string; draft: string }) => string;
};

const BAOWEN_SYSTEM = `你是一位有经验的内容主编，深谙长文写作的节奏与表达。你的回答必须可直接落地，不要写「以下是…」之类的元话语。CRITICAL: 保留原文语言，不要翻译成其他语言。`;

const ACTIONS: Action[] = [
  {
    id: "expand",
    label: "扩写选区",
    description: "把这一段扩到 1.5-2 倍，补一个具体例子",
    icon: <Wand2 size={13} />,
    needsSelection: true,
    buildSystem: () => BAOWEN_SYSTEM,
    buildUser: ({ selection }) =>
      `请把下面这段扩写到 1.5-2 倍长度，要求：保留原意；加入 1 个具体例子或数据；长短句交错；避免书面语和空话套话。直接输出扩写后的版本：\n\n"""\n${selection}\n"""`,
  },
  {
    id: "casual",
    label: "改为更口语",
    description: "更轻松、更有人味的口吻",
    icon: <Smile size={13} />,
    needsSelection: true,
    buildSystem: () => BAOWEN_SYSTEM,
    buildUser: ({ selection }) =>
      `请把下面这段改写成更口语、更有人味的风格，像跟朋友聊天。保留事实和观点。只输出改写后的版本：\n\n"""\n${selection}\n"""`,
  },
  {
    id: "concise",
    label: "改为更精炼",
    description: "压缩 30-50%，去掉所有冗余",
    icon: <Scissors size={13} />,
    needsSelection: true,
    buildSystem: () => BAOWEN_SYSTEM,
    buildUser: ({ selection }) =>
      `请把下面这段精炼到原长度的 50-70%，去掉所有冗余、重复、套话，保留核心信息。只输出精炼后的版本：\n\n"""\n${selection}\n"""`,
  },
  {
    id: "hook",
    label: "加钩子",
    description: "在选中段落后补一个钩子（故事/数据/反问）",
    icon: <Anchor size={13} />,
    needsSelection: true,
    buildSystem: () => BAOWEN_SYSTEM,
    buildUser: ({ selection }) =>
      `下面是文章中间某段，读者可能在这里划走。请在它后面追加一段 "钩子"（具体故事 / 具体数据 / 反转 / 反问 任选一种，不要解释类型），让读者愿意继续往下读。\n\n输出格式：先把原段落原样输出，然后另起一段输出钩子内容，总长度不超过 250 字。\n\n"""\n${selection}\n"""`,
  },
  {
    id: "polish",
    label: "润色全篇",
    description: "整篇通读、修语病、调节奏（不改观点）",
    icon: <FileText size={13} />,
    needsSelection: false,
    buildSystem: () => BAOWEN_SYSTEM,
    buildUser: ({ draft }) =>
      `请通读下面这篇 Markdown 草稿并做轻度润色：修语病、删冗余、调节奏、增可读性，不改变观点、结构、Markdown 标记。只输出润色后的完整 Markdown：\n\n"""\n${draft}\n"""`,
  },
];

export function AIInlineMenu() {
  const [open, setOpen] = React.useState<ActionId | null>(null);
  const [imageMode, setImageMode] = React.useState<"inline" | "cover" | null>(
    null
  );

  return (
    <>
      <Popover.Root>
        <Popover.Trigger asChild>
          <button
            type="button"
            className="flex items-center gap-1 px-1.5 py-1 rounded text-xs text-app-fg-muted hover:text-app-fg hover:bg-app-surface-hover transition-colors whitespace-nowrap"
            title="AI 改写文字 / 生成图片"
          >
            <Sparkles size={12} />
            <span className="hidden sm:inline">AI</span>
            <ChevronDown size={10} />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            align="end"
            sideOffset={6}
            className="z-50 w-[280px] bg-app-surface border border-app-border rounded-lg shadow-xl py-1 animate-fade-in"
          >
            <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-app-fg-subtle">
              文字
            </div>
            {ACTIONS.map((a) => (
              <Popover.Close key={a.id} asChild>
                <button
                  onClick={() => setOpen(a.id)}
                  className="w-full flex items-start gap-2.5 px-3 py-2 text-left hover:bg-app-surface-hover transition-colors"
                >
                  <span className="mt-0.5 text-app-fg-muted">{a.icon}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-app-fg">
                      {a.label}
                    </span>
                    <span className="block text-[11px] text-app-fg-muted leading-snug mt-0.5">
                      {a.description}
                      {a.needsSelection && (
                        <span className="text-app-fg-subtle"> · 需选中文字</span>
                      )}
                    </span>
                  </span>
                </button>
              </Popover.Close>
            ))}
            <div className="border-t border-app-border my-1" />
            <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-app-fg-subtle">
              图片
            </div>
            <Popover.Close asChild>
              <button
                onClick={() => setImageMode("inline")}
                className="w-full flex items-start gap-2.5 px-3 py-2 text-left hover:bg-app-surface-hover transition-colors"
              >
                <ImageIcon size={13} className="mt-0.5 text-app-fg-muted" />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium text-app-fg">
                    生成文中插图
                  </span>
                  <span className="block text-[11px] text-app-fg-muted leading-snug mt-0.5">
                    用提示词生成一张图，插入到光标位置
                  </span>
                </span>
              </button>
            </Popover.Close>
            <Popover.Close asChild>
              <button
                onClick={() => setImageMode("cover")}
                className="w-full flex items-start gap-2.5 px-3 py-2 text-left hover:bg-app-surface-hover transition-colors"
              >
                <Newspaper size={13} className="mt-0.5 text-app-fg-muted" />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium text-app-fg">
                    生成封面
                  </span>
                  <span className="block text-[11px] text-app-fg-muted leading-snug mt-0.5">
                    根据 H1 自动派生 prompt，16:9 高质量，插到正文最上
                  </span>
                </span>
              </button>
            </Popover.Close>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      {open && (
        <AIInlineDialog
          actionId={open}
          onOpenChange={(v) => !v && setOpen(null)}
        />
      )}
      {imageMode && (
        <AIImageDialog
          open={true}
          onOpenChange={(v) => !v && setImageMode(null)}
          mode={imageMode}
        />
      )}
    </>
  );
}

// ====================================================================
// Dialog: stream the AI output, let user accept / insert / copy
// ====================================================================

function AIInlineDialog({
  actionId,
  onOpenChange,
}: {
  actionId: ActionId;
  onOpenChange: (open: boolean) => void;
}) {
  const action = ACTIONS.find((a) => a.id === actionId)!;
  const setSidebarPanel = useWorkshop((s) => s.setSidebarPanel);
  const draft = useWorkshop((s) => s.markdown);

  // Snapshot the editor's selection at mount time. The user may click around
  // the dialog later — we still want to operate on the originally-selected
  // range.
  const initial = React.useMemo(() => readSelection(), []);
  const [output, setOutput] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [instruction, setInstruction] = React.useState("");
  const abortRef = React.useRef<AbortController | null>(null);

  // Validate selection on mount but do NOT auto-fire. User reviews the
  // canned prompt, optionally adds an extra instruction, then clicks 改写.
  React.useEffect(() => {
    if (action.needsSelection && !initial.text.trim()) {
      setError("请先在编辑器里选中文字再调用此动作");
    }
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = async () => {
    setError(null);
    setOutput("");
    const settings = loadSettings();
    if (!settings?.apiKey) {
      setError("请先在设置或 AI 写作助手里配置 LLM key");
      setSidebarPanel("ai");
      return;
    }
    setBusy(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const baseUser = action.buildUser({ selection: initial.text, draft });
      const userContent = instruction.trim()
        ? `${baseUser}\n\n附加指令（请优先遵守）：${instruction.trim()}`
        : baseUser;
      const stream = streamChat(
        settings,
        [
          { role: "system", content: withPrefs(action.buildSystem(), loadWritingPreferences()) },
          { role: "user", content: userContent },
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

  const replace = () => {
    if (action.id === "polish") {
      // Polish replaces the whole document via the shared store — works
      // for either editor mode since both read from the same markdown.
      useWorkshop.getState().setMarkdown(stripFence(output));
    } else {
      const cleaned = stripFence(output);
      // Works in both CM and TipTap via the editor-agnostic shim
      replaceRange(initial.from, initial.to, cleaned);
    }
    toast.success("已应用");
    onOpenChange(false);
  };

  const insertBelow = () => {
    const cleaned = stripFence(output);
    insertAtCursor("\n\n" + cleaned + "\n\n");
    toast.success("已插入到光标后");
    onOpenChange(false);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(stripFence(output));
      toast.success("已复制");
    } catch (e) {
      toast.error("复制失败", (e as Error).message);
    }
  };

  const cancel = () => abortRef.current?.abort();

  return (
    <AppDialog
      open={true}
      onOpenChange={onOpenChange}
      title={
        <span className="flex items-center gap-2">
          <span className="text-orange-600">{action.icon}</span>
          <span>{action.label}</span>
        </span>
      }
      description={action.description}
    >
      <div className="p-5 space-y-3">
        {action.needsSelection && initial.text && (
          <Section title="原文">
            <div className="bg-app-bg border border-app-border rounded p-3 text-[12px] leading-relaxed whitespace-pre-wrap max-h-[120px] overflow-auto text-app-fg-muted">
              {initial.text}
            </div>
          </Section>
        )}

        <Section title="附加指令（可选）">
          <textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="比如：加一个具体数据 / 改成提问式开头 / 避免出现 XX 这个词…"
            disabled={busy}
            rows={2}
            className="w-full bg-app-bg border border-app-border rounded p-2.5 text-[12px] leading-relaxed text-app-fg placeholder:text-app-fg-subtle focus:outline-none focus:border-app-fg/40 resize-none disabled:opacity-50"
          />
        </Section>

        {(busy || output || error) && (
          <Section title={busy ? "生成中（流式）" : "AI 输出"}>
            {error && (
              <div className="text-[12px] text-red-700 dark:text-red-400 mb-2 flex items-start gap-1.5">
                <span>⚠</span>
                <span>{error}</span>
              </div>
            )}
            {(busy || output) && (
              <div className="bg-app-bg border border-app-border rounded p-3 text-[12px] leading-relaxed whitespace-pre-wrap min-h-[120px] max-h-[300px] overflow-auto">
                {stripFence(output) || (
                  <span className="inline-flex items-center gap-2 text-app-fg-subtle">
                    <Loader2 size={12} className="animate-spin" />
                    AI 正在思考…
                  </span>
                )}
              </div>
            )}
          </Section>
        )}

        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="flex gap-2 items-center">
            {!busy && !output && !error && (
              <span className="text-[11px] text-app-fg-subtle">
                确认指令后点「改写」开始
              </span>
            )}
          </div>
          <div className="flex gap-2">
            {busy ? (
              <Button variant="secondary" size="sm" onClick={cancel}>
                <Loader2 size={11} className="animate-spin" /> 停止
              </Button>
            ) : !output ? (
              <Button
                size="sm"
                onClick={run}
                disabled={action.needsSelection && !initial.text.trim()}
              >
                <Sparkles size={11} />
                {error ? "重试" : "改写"}
              </Button>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={run}>
                  重新生成
                </Button>
                <Button variant="secondary" size="sm" onClick={copy}>
                  复制
                </Button>
                {action.id !== "polish" && (
                  <Button variant="secondary" size="sm" onClick={insertBelow}>
                    插入光标后
                  </Button>
                )}
                <Button size="sm" onClick={replace}>
                  <Check size={11} />
                  {action.id === "polish" ? "替换全篇" : "替换选区"}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </AppDialog>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-app-fg-subtle mb-1.5">
        {title}
      </div>
      {children}
    </div>
  );
}

function readSelection(): { from: number; to: number; text: string } {
  // Editor-agnostic — works in both CM (md) and TipTap (visual) modes
  return readActiveSelection();
}

/** Strip leading/trailing markdown code fence wrappers that some models add. */
function stripFence(s: string): string {
  return s
    .replace(/^\s*```(?:markdown|md)?\n/i, "")
    .replace(/\n```\s*$/i, "")
    .trim();
}
