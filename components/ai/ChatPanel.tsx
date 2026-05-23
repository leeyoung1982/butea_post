"use client";

import * as React from "react";
import {
  Send,
  Square,
  Settings,
  Sparkles,
  RefreshCw,
  ChevronDown,
  PenLine,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SkillLibrary } from "./SkillLibrary";
import { SettingsForm } from "./SettingsForm";
import { useWorkshop } from "@/lib/store";
import {
  loadSettings,
  loadWritingPreferences,
  saveSettings,
  type LLMSettings,
} from "@/lib/llm/providers";
import { streamChat, type ChatMessage } from "@/lib/llm/client";
import { withPrefs, type Skill } from "@/lib/llm/skills";
import { cn } from "@/lib/utils";

type DisplayMessage = ChatMessage & { id: string };

export function ChatPanel() {
  const topic = useWorkshop((s) => s.topic);
  const setTopic = useWorkshop((s) => s.setTopic);
  const audience = useWorkshop((s) => s.audience);
  const setAudience = useWorkshop((s) => s.setAudience);
  const selection = useWorkshop((s) => s.selection);
  const draft = useWorkshop((s) => s.markdown);

  const [settings, setSettings] = React.useState<LLMSettings | null>(null);
  const [showSettings, setShowSettings] = React.useState(false);
  const [messages, setMessages] = React.useState<DisplayMessage[]>([]);
  const [input, setInput] = React.useState("");
  const [streaming, setStreaming] = React.useState(false);
  const abortRef = React.useRef<AbortController | null>(null);
  const scrollRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const s = loadSettings();
    setSettings(s);
    if (!s) setShowSettings(true);
  }, []);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streaming]);

  const runChat = async (next: DisplayMessage[]) => {
    if (!settings?.apiKey) {
      setShowSettings(true);
      return;
    }
    setStreaming(true);
    const controller = new AbortController();
    abortRef.current = controller;
    const assistantId = crypto.randomUUID();
    setMessages([...next, { id: assistantId, role: "assistant", content: "" }]);

    try {
      const stream = streamChat(
        settings,
        next.map(({ role, content }) => ({ role, content })),
        controller.signal
      );
      let acc = "";
      for await (const chunk of stream) {
        acc += chunk;
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: acc } : m))
        );
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        // user stopped
      } else {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: `⚠️ 出错：${(err as Error).message}` }
              : m
          )
        );
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  };

  const onSend = () => {
    if (!input.trim() || streaming) return;
    const next: DisplayMessage[] = [
      ...messages,
      { id: crypto.randomUUID(), role: "user", content: input },
    ];
    setMessages(next);
    setInput("");
    runChat(next);
  };

  const onPickSkill = (skill: Skill) => {
    const prefs = loadWritingPreferences();
    const prompt = skill.buildPrompt({
      topic,
      audience,
      selection,
      draft,
    });
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

  const stopStream = () => abortRef.current?.abort();
  const resetChat = () => setMessages([]);

  return (
    <div className="flex flex-col h-full">
      {/* Panel header */}
      <div className="px-4 py-3 border-b border-app-border">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-app-fg mb-2">
          <Sparkles size={13} /> AI 写作助手
        </div>
        <div className="grid grid-cols-2 gap-2">
          <LabeledInput
            label="话题"
            value={topic}
            onChange={setTopic}
            placeholder="如：周末独处、跑步入门"
          />
          <LabeledInput
            label="目标读者"
            value={audience}
            onChange={setAudience}
            placeholder="如：大学生、新手爸妈"
          />
        </div>
        {selection && (
          <div className="mt-2 text-[11px] text-app-fg-muted bg-app-bg px-2 py-1.5 rounded border border-app-border">
            <span className="text-app-fg-subtle">已选中：</span>
            <span className="line-clamp-1">{selection.slice(0, 80)}</span>
          </div>
        )}
      </div>

      {/* Skill library — always expanded */}
      <div className="border-b border-app-border px-4 py-3">
        <div className="text-xs uppercase tracking-wider text-app-fg-subtle mb-2 flex items-center gap-1.5">
          <Sparkles size={11} /> Skill 库
        </div>
        <SkillLibrary onPick={onPickSkill} />
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-auto px-4 py-3 space-y-3">
        {messages.length === 0 ? (
          <div className="text-xs text-app-fg-muted leading-relaxed">
            从上面点一个 Skill 开始，或直接输入对话。
            <div className="mt-3 text-[11px] text-app-fg-subtle">
              提示：在编辑器选中段落，再点 <span className="text-app-fg">「段落扩写 / 切换文风 / 加钩子」</span> 类 Skill 会对选中文本起作用。
            </div>
          </div>
        ) : (
          messages
            .filter((m) => m.role !== "system")
            .map((m) => (
              <div
                key={m.id}
                className={cn(
                  "text-sm leading-relaxed animate-fade-in",
                  m.role === "user"
                    ? "bg-app-fg text-app-bg ml-6 rounded-lg px-3 py-2"
                    : "text-app-fg pr-2"
                )}
              >
                <div className="whitespace-pre-wrap break-words">
                  {m.content || (streaming ? "▍" : "")}
                </div>
              </div>
            ))
        )}
      </div>

      {/* Collapsible settings drawer */}
      <div className="border-t border-app-border">
        <button
          onClick={() => setShowSettings((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-2 text-xs text-app-fg-subtle hover:text-app-fg hover:bg-app-surface-hover transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <Settings size={11} />
            写作偏好 & LLM 配置
          </span>
          <ChevronDown
            size={12}
            className={cn(
              "transition-transform",
              showSettings && "rotate-180"
            )}
          />
        </button>
        {showSettings && (
          <div className="px-4 pb-3 max-h-[50vh] overflow-auto">
            <SettingsForm
              initial={settings}
              onSave={(s) => {
                saveSettings(s);
                setSettings(s);
                setShowSettings(false);
              }}
            />
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-app-border px-3 py-2.5 bg-app-surface">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                onSend();
              }
            }}
            placeholder="问点什么... (Cmd/Ctrl + Enter 发送)"
            rows={2}
            className="flex-1 resize-none bg-app-bg border border-app-border rounded-md px-2.5 py-2 text-sm placeholder:text-app-fg-subtle focus:outline-none focus:border-app-fg-muted"
          />
          <div className="flex flex-col gap-1">
            {streaming ? (
              <Button
                size="iconSm"
                variant="secondary"
                onClick={stopStream}
                title="停止"
              >
                <Square size={13} />
              </Button>
            ) : (
              <Button
                size="iconSm"
                onClick={onSend}
                disabled={!input.trim()}
                title="发送"
              >
                <Send size={13} />
              </Button>
            )}
            <Button
              size="iconSm"
              variant="ghost"
              onClick={resetChat}
              title="清空对话"
            >
              <RefreshCw size={13} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-wider text-app-fg-subtle">
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-0.5 w-full h-7 px-2 rounded border border-app-border bg-app-bg text-xs text-app-fg placeholder:text-app-fg-subtle focus:outline-none focus:border-app-fg-muted"
      />
    </label>
  );
}
