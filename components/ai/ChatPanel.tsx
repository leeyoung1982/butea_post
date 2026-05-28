"use client";

import * as React from "react";
import {
  Send,
  Square,
  Sparkles,
  RefreshCw,
  Plus,
  ImageIcon,
  X,
  Check,
  Feather,
  ArrowLeft,
  FileEdit,
  ClipboardCopy,
  Wand2,
  PenTool,
  MessageCircle,
} from "lucide-react";
import { SkillLibrary } from "./SkillLibrary";
import { SettingsForm } from "./SettingsForm";
import { useWorkshop, DEFAULT_MARKDOWN } from "@/lib/store";
import {
  loadSettings,
  loadWritingPreferences,
  saveSettings,
  type LLMSettings,
} from "@/lib/llm/providers";
import { streamChat, type ChatMessage } from "@/lib/llm/client";
import { withPrefs, type Skill } from "@/lib/llm/skills";
import {
  WRITING_AGENT_SYSTEM,
  detectContentType,
  type AgentContentType,
} from "@/lib/llm/agent";
import {
  generateImage,
  imageMarkdown,
  MissingImageKeyError,
} from "@/lib/llm/image";
import { insertAtCursor, insertBlockBelow } from "@/lib/editor-ref";
import { cn } from "@/lib/utils";

type ChatMode = "agent" | "free";

type DisplayMessage = ChatMessage & {
  id: string;
  imageB64?: string;
};

export function ChatPanel() {
  const topic = useWorkshop((s) => s.topic);
  const setTopic = useWorkshop((s) => s.setTopic);
  const audience = useWorkshop((s) => s.audience);
  const setAudience = useWorkshop((s) => s.setAudience);
  const selection = useWorkshop((s) => s.selection);
  const draft = useWorkshop((s) => s.markdown);
  const setMarkdown = useWorkshop((s) => s.setMarkdown);

  const [settings, setSettings] = React.useState<LLMSettings | null>(null);
  const [showSettings, setShowSettings] = React.useState(false);
  const [chatMode, setChatMode] = React.useState<ChatMode>("agent");
  const [messages, setMessages] = React.useState<DisplayMessage[]>([]);
  const [input, setInput] = React.useState("");
  const [streaming, setStreaming] = React.useState(false);
  const [showSkills, setShowSkills] = React.useState(false);
  const [imageMode, setImageMode] = React.useState(false);
  const [inserting, setInserting] = React.useState<string | null>(null);
  const [appliedIds, setAppliedIds] = React.useState<Set<string>>(new Set());
  // When user clicks apply but editor has content: show "replace / insert" choice
  // on that specific message instead of immediately overwriting their work.
  const [pendingApplyId, setPendingApplyId] = React.useState<string | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const skillsRef = React.useRef<HTMLDivElement | null>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);

  React.useEffect(() => {
    const s = loadSettings();
    setSettings(s);
    if (!s) setShowSettings(true);
  }, []);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, streaming]);

  // Close skill picker on outside click
  React.useEffect(() => {
    if (!showSkills) return;
    const handler = (e: MouseEvent) => {
      if (skillsRef.current && !skillsRef.current.contains(e.target as Node)) {
        setShowSkills(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showSkills]);

  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 140) + "px";
  };

  // Build message list for API call, injecting system prompt for agent mode
  const buildApiMessages = (
    msgs: DisplayMessage[]
  ): { role: string; content: string }[] => {
    const apiMsgs = msgs.map(({ role, content }) => ({ role, content }));

    if (chatMode === "agent") {
      // Inject agent system prompt if not already present
      const hasSystem = apiMsgs.some((m) => m.role === "system");
      if (!hasSystem) {
        const prefs = loadWritingPreferences();
        const sys = withPrefs(WRITING_AGENT_SYSTEM, prefs);
        apiMsgs.unshift({ role: "system", content: sys });
      }
    }
    return apiMsgs;
  };

  const runChat = async (next: DisplayMessage[]) => {
    if (!settings?.apiKey) {
      setShowSettings(true);
      return;
    }
    setStreaming(true);
    const controller = new AbortController();
    abortRef.current = controller;
    const assistantId = crypto.randomUUID();
    setMessages([
      ...next,
      { id: assistantId, role: "assistant", content: "" },
    ]);

    try {
      const stream = streamChat(
        settings,
        buildApiMessages(next) as ChatMessage[],
        controller.signal
      );
      let acc = "";
      for await (const chunk of stream) {
        acc += chunk;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: acc } : m
          )
        );
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        // user stopped
      } else {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: `⚠️ ${(err as Error).message}` }
              : m
          )
        );
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  };

  const runImageGen = async (prompt: string) => {
    if (!prompt.trim()) return;
    const userMsg: DisplayMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: prompt,
    };
    const assistantId = crypto.randomUUID();
    const next = [
      ...messages,
      userMsg,
      {
        id: assistantId,
        role: "assistant" as const,
        content: "正在生成图片...",
      },
    ];
    setMessages(next);
    setStreaming(true);

    try {
      const imgs = await generateImage({ prompt, size: "1024x1024", n: 1 });
      const img = imgs[0];
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                content: img.revisedPrompt
                  ? `Prompt: ${img.revisedPrompt}`
                  : "",
                imageB64: img.b64,
              }
            : m
        )
      );
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: `⚠️ ${(err as Error).message}` }
            : m
        )
      );
    } finally {
      setStreaming(false);
    }
  };

  const onSend = () => {
    if (!input.trim() || streaming) return;
    const text = input;
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    if (imageMode) {
      runImageGen(text);
    } else {
      const next: DisplayMessage[] = [
        ...messages,
        { id: crypto.randomUUID(), role: "user", content: text },
      ];
      setMessages(next);
      runChat(next);
    }
  };

  // Send a follow-up message (for action buttons like "开始扩写")
  const sendFollowUp = (text: string) => {
    const next: DisplayMessage[] = [
      ...messages,
      { id: crypto.randomUUID(), role: "user", content: text },
    ];
    setMessages(next);
    runChat(next);
  };

  const onPickSkill = (skill: Skill) => {
    setShowSkills(false);
    const prefs = loadWritingPreferences();
    const prompt = skill.buildPrompt({ topic, audience, selection, draft });
    const next: DisplayMessage[] = [
      ...messages,
      {
        id: crypto.randomUUID(),
        role: "system",
        content: withPrefs(prompt.system, prefs),
      },
      {
        id: crypto.randomUUID(),
        role: "user",
        content: `[${skill.emoji} ${skill.name}]\n\n${prompt.user}`,
      },
    ];
    setMessages(next);
    runChat(next);
  };

  // Keywords that signal a trailing "meta" paragraph (agent's follow-up
  // pleasantries like "草稿已完成。你可以点击应用到编辑器..."). When we apply
  // to the editor, we want the document clean — strip these.
  const META_KEYWORDS = [
    "应用到编辑器",
    "点击",
    "可以告诉",
    "继续打磨",
    "继续完善",
    "调整哪里",
    "如有",
    "你可以",
    "可以直接",
    "草稿已完成",
    "大纲已完成",
    "全文已完成",
    "全文已写完",
    "希望对你",
  ];

  // Strip any conversational preamble (before the first heading) AND any
  // trailing meta paragraphs (agent's UI-action prompts after the content).
  const extractMarkdown = (content: string): string => {
    const lines = content.split("\n");
    const firstHeadingIdx = lines.findIndex((l) => /^#{1,3} /.test(l));
    const mdContent =
      firstHeadingIdx >= 0 ? lines.slice(firstHeadingIdx).join("\n") : content;

    // Walk paragraphs from the end, dropping any that look like meta-comments.
    // Stop at the first real content paragraph (heading, bullet, or prose
    // without UI keywords).
    const paragraphs = mdContent.trim().split(/\n\s*\n/);
    while (paragraphs.length > 1) {
      const last = paragraphs[paragraphs.length - 1].trim();
      if (/^#{1,6} /.test(last)) break;
      if (/^[-*] /.test(last)) break;
      if (last.startsWith("<!--")) break; // keep image-suggestion comments
      const looksLikeMeta = META_KEYWORDS.some((k) => last.includes(k));
      if (!looksLikeMeta) break;
      paragraphs.pop();
    }
    return paragraphs.join("\n\n").trim();
  };

  // Treat starter content as "empty" so first-time users get a zero-friction
  // apply. Anything else triggers the replace/insert choice to protect the
  // user's own writing.
  const isEditorEmpty = (md: string): boolean => {
    const trimmed = md.trim();
    if (!trimmed) return true;
    if (trimmed === DEFAULT_MARKDOWN.trim()) return true;
    return false;
  };

  const requestApply = (msgId: string, content: string) => {
    if (isEditorEmpty(draft)) {
      setMarkdown(extractMarkdown(content));
      setAppliedIds((prev) => new Set(prev).add(msgId));
    } else {
      setPendingApplyId(msgId);
    }
  };

  const confirmReplace = (msgId: string, content: string) => {
    setMarkdown(extractMarkdown(content));
    setAppliedIds((prev) => new Set(prev).add(msgId));
    setPendingApplyId(null);
  };

  const confirmInsert = (msgId: string, content: string) => {
    insertBlockBelow(extractMarkdown(content));
    setAppliedIds((prev) => new Set(prev).add(msgId));
    setPendingApplyId(null);
  };

  const cancelApply = () => setPendingApplyId(null);

  const copyContent = (content: string) => {
    navigator.clipboard.writeText(content);
  };

  const insertImage = async (b64: string) => {
    setInserting(b64);
    try {
      const md = await imageMarkdown(b64, "AI generated image");
      insertAtCursor(md);
    } finally {
      setTimeout(() => setInserting(null), 1500);
    }
  };

  const stopStream = () => abortRef.current?.abort();
  const resetChat = () => {
    setMessages([]);
    setImageMode(false);
    setAppliedIds(new Set());
    setPendingApplyId(null);
  };

  const switchMode = (mode: ChatMode) => {
    if (mode === chatMode) return;
    if (messages.length > 0) {
      if (!confirm("切换模式会清空当前对话，确定？")) return;
    }
    setChatMode(mode);
    setMessages([]);
    setImageMode(false);
    setAppliedIds(new Set());
    setPendingApplyId(null);
  };

  // ---- Settings overlay ----
  if (showSettings) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-4 py-3 border-b border-app-border flex items-center gap-2">
          <button
            onClick={() => setShowSettings(false)}
            className="text-app-fg-muted hover:text-app-fg transition-colors"
          >
            <ArrowLeft size={16} />
          </button>
          <span className="text-xs font-medium text-app-fg">
            写作偏好 & LLM 配置
          </span>
        </div>
        <div className="flex-1 overflow-auto px-4 py-3">
          <SettingsForm
            initial={settings}
            onSave={(s) => {
              saveSettings(s);
              setSettings(s);
              setShowSettings(false);
            }}
          />
        </div>
      </div>
    );
  }

  // ---- Main view ----
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-app-border">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-app-fg">
            <Sparkles size={13} /> AI 写作助手
          </div>
          <div className="flex items-center gap-1">
            {selection && (
              <div className="text-[10px] text-app-fg-muted bg-app-bg px-2 py-0.5 rounded border border-app-border max-w-[100px] truncate mr-0.5">
                已选中
              </div>
            )}
            <button
              onClick={resetChat}
              title="清空对话"
              className="w-7 h-7 rounded-md flex items-center justify-center text-app-fg-muted hover:text-app-fg hover:bg-app-surface-hover transition-colors"
            >
              <RefreshCw size={13} />
            </button>
            <button
              onClick={() => setShowSettings(true)}
              title="写作偏好 & LLM 配置"
              className="w-7 h-7 rounded-md flex items-center justify-center text-app-fg-muted hover:text-app-fg hover:bg-app-surface-hover transition-colors"
            >
              <Feather size={14} />
            </button>
          </div>
        </div>

        {/* Mode tabs */}
        <div className="flex gap-1 bg-app-bg rounded-lg p-0.5">
          <button
            onClick={() => switchMode("agent")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs transition-colors",
              chatMode === "agent"
                ? "bg-app-surface shadow-sm text-app-fg font-medium"
                : "text-app-fg-muted hover:text-app-fg"
            )}
          >
            <PenTool size={12} />
            写作引导
          </button>
          <button
            onClick={() => switchMode("free")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs transition-colors",
              chatMode === "free"
                ? "bg-app-surface shadow-sm text-app-fg font-medium"
                : "text-app-fg-muted hover:text-app-fg"
            )}
          >
            <MessageCircle size={12} />
            自由对话
          </button>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-auto px-4 py-3 space-y-2.5"
      >
        {messages.length === 0 ? (
          <EmptyState
            mode={chatMode}
            onQuickStart={(text) => {
              const next: DisplayMessage[] = [
                { id: crypto.randomUUID(), role: "user", content: text },
              ];
              setMessages(next);
              runChat(next);
            }}
          />
        ) : (
          messages
            .filter((m) => m.role !== "system")
            .map((m, _i, arr) => {
              const lastAssistantId = arr
                .filter((x) => x.role === "assistant")
                .at(-1)?.id;
              // Only the message currently being streamed should be flagged
              // — every prior assistant message is "done" and should show its
              // own action buttons (Issue 3: per-step apply).
              const isCurrentlyStreaming =
                streaming && m.role === "assistant" && m.id === lastAssistantId;
              return (
                <div key={m.id} className="animate-fade-in">
                  {m.role === "user" ? (
                    <UserBubble content={m.content} />
                  ) : (
                    <AssistantMessage
                      msg={m}
                      isStreaming={isCurrentlyStreaming}
                      applied={appliedIds.has(m.id)}
                      pendingChoice={pendingApplyId === m.id}
                      inserting={inserting}
                      onRequestApply={(content) => requestApply(m.id, content)}
                      onConfirmReplace={(content) =>
                        confirmReplace(m.id, content)
                      }
                      onConfirmInsert={(content) =>
                        confirmInsert(m.id, content)
                      }
                      onCancelApply={cancelApply}
                      onCopy={copyContent}
                      onGenerateDraft={() =>
                        sendFollowUp(
                          "请直接生成草稿，一次性输出完整 Markdown 正文，不要分节暂停。"
                        )
                      }
                      onInsertImage={insertImage}
                    />
                  )}
                </div>
              );
            })
        )}
      </div>

      {/* Composer */}
      <div className="px-3 pb-3 pt-1 relative">
        {imageMode && (
          <div className="flex items-center gap-1.5 mb-1.5 px-1 text-xs text-blue-600 dark:text-blue-400">
            <ImageIcon size={12} />
            <span>文生图模式</span>
            <button
              onClick={() => setImageMode(false)}
              className="ml-auto text-app-fg-muted hover:text-app-fg"
            >
              <X size={12} />
            </button>
          </div>
        )}

        {/* Skill picker popover — only in free mode */}
        {showSkills && chatMode === "free" && (
          <div
            ref={skillsRef}
            className="absolute bottom-full left-0 right-0 mb-1 mx-3 bg-app-surface border border-app-border rounded-lg shadow-lg max-h-[60vh] overflow-auto z-20"
          >
            <div className="px-3 py-2.5 border-b border-app-border flex items-center justify-between">
              <span className="text-xs font-medium text-app-fg">Skill 库</span>
              <button
                onClick={() => setShowSkills(false)}
                className="text-app-fg-muted hover:text-app-fg"
              >
                <X size={14} />
              </button>
            </div>
            <div className="p-3">
              <SkillLibrary
                onPick={onPickSkill}
                topicValue={topic}
                onTopicChange={setTopic}
                audienceValue={audience}
                onAudienceChange={setAudience}
              />
            </div>
          </div>
        )}

        <div className="border border-app-border rounded-xl bg-app-bg focus-within:border-app-fg-muted transition-colors">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              autoResize();
            }}
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                !e.nativeEvent.isComposing &&
                !e.metaKey &&
                !e.ctrlKey &&
                !e.shiftKey
              ) {
                e.preventDefault();
                onSend();
              }
            }}
            placeholder={
              imageMode
                ? "描述你想要的图片..."
                : chatMode === "agent"
                  ? "告诉我你想写什么..."
                  : "今天想写点什么？"
            }
            rows={1}
            className="w-full resize-none bg-transparent px-3 pt-2.5 pb-1 text-[12.5px] placeholder:text-app-fg-subtle focus:outline-none min-h-[36px]"
          />

          <div className="flex items-center justify-between px-2 pb-2">
            <div className="flex items-center gap-0.5">
              {chatMode === "free" && (
                <button
                  onClick={() => setShowSkills((v) => !v)}
                  title="Skill 库"
                  className={cn(
                    "w-7 h-7 rounded-lg flex items-center justify-center transition-colors",
                    showSkills
                      ? "bg-app-fg text-app-bg"
                      : "text-app-fg-muted hover:text-app-fg hover:bg-app-surface-hover"
                  )}
                >
                  <Plus size={15} />
                </button>
              )}
              <button
                onClick={() => setImageMode((v) => !v)}
                title="文生图"
                className={cn(
                  "w-7 h-7 rounded-lg flex items-center justify-center transition-colors",
                  imageMode
                    ? "bg-blue-500 text-white"
                    : "text-app-fg-muted hover:text-app-fg hover:bg-app-surface-hover"
                )}
              >
                <ImageIcon size={14} />
              </button>
            </div>

            {streaming ? (
              <button
                onClick={stopStream}
                title="停止"
                className="w-7 h-7 rounded-lg flex items-center justify-center bg-red-500 text-white hover:bg-red-600 transition-colors"
              >
                <Square size={12} />
              </button>
            ) : (
              <button
                onClick={onSend}
                disabled={!input.trim()}
                title="发送"
                className={cn(
                  "w-7 h-7 rounded-lg flex items-center justify-center transition-colors",
                  input.trim()
                    ? "bg-app-fg text-app-bg hover:opacity-80"
                    : "text-app-fg-subtle cursor-not-allowed"
                )}
              >
                <Send size={13} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function EmptyState({
  mode,
  onQuickStart,
}: {
  mode: ChatMode;
  onQuickStart?: (text: string) => void;
}) {
  if (mode === "agent") {
    return (
      <div className="text-center mt-8 space-y-2.5">
        <div className="w-9 h-9 rounded-full bg-app-surface-hover flex items-center justify-center mx-auto">
          <PenTool size={16} className="text-app-fg-muted" />
        </div>
        <div className="text-[12.5px] text-app-fg font-medium">从零开始写一篇文章</div>
        <div className="text-[11px] text-app-fg-muted leading-relaxed max-w-[220px] mx-auto">
          告诉我你想写什么，我会引导你完成选题、大纲、到草稿的整个过程
        </div>
        <div className="flex flex-wrap justify-center gap-1 pt-1">
          {[
            "写一篇关于独居生活的文章",
            "帮我写个跑步入门指南",
            "我想聊聊读书的方法",
          ].map((s) => (
            <button
              key={s}
              onClick={() => onQuickStart?.(s)}
              className="text-[10.5px] px-2 py-1 rounded-full border border-app-border text-app-fg-muted hover:text-app-fg hover:border-app-fg-muted transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="text-[11px] text-app-fg-muted leading-relaxed mt-8 text-center">
      <div className="text-app-fg-subtle mb-2">
        点击输入框中{" "}
        <Plus size={10} className="inline -mt-0.5" /> 选择 Skill，或直接输入对话
      </div>
      <div className="text-[10.5px]">
        选中编辑器文本后使用「扩写 / 改写」类 Skill 效果更佳
      </div>
    </div>
  );
}

function UserBubble({ content }: { content: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] bg-app-surface-hover text-app-fg rounded-xl rounded-tr-sm px-2.5 py-1.5 text-[12.5px] leading-[1.55]">
        <div className="whitespace-pre-wrap break-words">{content}</div>
      </div>
    </div>
  );
}

type PillStyle = { label: string; emoji: string };

const STEP_PILL: Record<AgentContentType, PillStyle | null> = {
  "topic-options": { label: "选题方向", emoji: "📝" },
  outline: { label: "大纲", emoji: "📋" },
  article: { label: "草稿", emoji: "✍️" },
  none: null,
};

function AssistantMessage({
  msg,
  isStreaming,
  applied,
  pendingChoice,
  inserting,
  onRequestApply,
  onConfirmReplace,
  onConfirmInsert,
  onCancelApply,
  onCopy,
  onGenerateDraft,
  onInsertImage,
}: {
  msg: DisplayMessage;
  isStreaming: boolean;
  applied: boolean;
  pendingChoice: boolean;
  inserting: string | null;
  onRequestApply: (content: string) => void;
  onConfirmReplace: (content: string) => void;
  onConfirmInsert: (content: string) => void;
  onCancelApply: () => void;
  onCopy: (content: string) => void;
  onGenerateDraft: () => void;
  onInsertImage: (b64: string) => void;
}) {
  // Don't classify a message that's still being written — wait for it to settle.
  const contentType: AgentContentType = React.useMemo(
    () => (isStreaming ? "none" : detectContentType(msg.content)),
    [msg.content, isStreaming]
  );
  const pill = STEP_PILL[contentType];
  // topic-options is a meta-decision (which angle to take), not document
  // content — don't let users push it into the editor.
  const isApplicable =
    contentType === "outline" || contentType === "article";
  const showActions = !isStreaming && contentType !== "none";

  return (
    <div className="max-w-[95%]">
      {/* Step pill — neutral chip + horizontal separator. Step is signalled
          by the emoji+label, not by color tinting. */}
      {pill && (
        <div className="mb-1.5 flex items-center gap-2">
          <div className="inline-flex items-center gap-1 px-2 py-[2px] rounded border border-app-border bg-app-surface-hover text-app-fg text-[10.5px] font-semibold">
            <span className="text-[10px]">{pill.emoji}</span>
            <span>{pill.label}</span>
          </div>
          <div className="flex-1 border-t border-app-border/40" />
        </div>
      )}

      {/* Image */}
      {msg.imageB64 && (
        <div className="mb-2 rounded-lg overflow-hidden border border-app-border relative group">
          <img
            src={`data:image/png;base64,${msg.imageB64}`}
            alt="AI generated"
            className="w-full h-auto"
          />
          <button
            onClick={() => onInsertImage(msg.imageB64!)}
            disabled={inserting === msg.imageB64}
            className="absolute bottom-2 right-2 bg-white/90 dark:bg-black/70 text-black dark:text-white px-2.5 py-1.5 rounded-md text-xs flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
          >
            {inserting === msg.imageB64 ? (
              <>
                <Check size={12} /> 已添加
              </>
            ) : (
              <>
                <Plus size={12} /> 插入正文 & 存入资产
              </>
            )}
          </button>
        </div>
      )}

      {/* Text content */}
      {msg.content && (
        <div className="text-[12.5px] leading-[1.65] text-app-fg whitespace-pre-wrap break-words">
          {msg.content}
        </div>
      )}

      {/* Streaming cursor */}
      {!msg.content && !msg.imageB64 && isStreaming && (
        <div className="text-[12.5px] text-app-fg-muted">▍</div>
      )}

      {/* Action buttons */}
      {showActions && (
        <div className="flex flex-wrap gap-1 mt-2 pt-1.5 border-t border-app-border/50">
          {isApplicable && !pendingChoice && (
            <ActionButton
              icon={applied ? <Check size={12} /> : <FileEdit size={12} />}
              label={applied ? "已应用" : "应用到编辑器"}
              onClick={() => onRequestApply(msg.content)}
              active={applied}
            />
          )}
          {isApplicable && pendingChoice && (
            <>
              <ActionButton
                icon={<FileEdit size={12} />}
                label="替换全部"
                onClick={() => onConfirmReplace(msg.content)}
              />
              <ActionButton
                icon={<Plus size={12} />}
                label="插入到光标处"
                onClick={() => onConfirmInsert(msg.content)}
              />
              <ActionButton
                icon={<X size={12} />}
                label="取消"
                onClick={onCancelApply}
              />
            </>
          )}
          {contentType === "outline" && !pendingChoice && (
            <ActionButton
              icon={<Wand2 size={12} />}
              label="生成草稿"
              onClick={onGenerateDraft}
            />
          )}
          <ActionButton
            icon={<ClipboardCopy size={12} />}
            label="复制"
            onClick={() => onCopy(msg.content)}
          />
        </div>
      )}
    </div>
  );
}

function ActionButton({
  icon,
  label,
  onClick,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={active}
      className={cn(
        "flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10.5px] transition-colors border",
        active
          ? "bg-app-surface text-app-fg-subtle border-app-border/40 cursor-default"
          : "bg-app-surface-hover text-app-fg-muted hover:text-app-fg border-app-border/50"
      )}
    >
      {icon}
      {label}
    </button>
  );
}
