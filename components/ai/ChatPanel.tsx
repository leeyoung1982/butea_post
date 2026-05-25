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
} from "lucide-react";
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
import {
  generateImage,
  imageMarkdown,
  MissingImageKeyError,
} from "@/lib/llm/image";
import { insertAtCursor } from "@/lib/editor-ref";
import { cn } from "@/lib/utils";

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

  const [settings, setSettings] = React.useState<LLMSettings | null>(null);
  const [showSettings, setShowSettings] = React.useState(false);
  const [messages, setMessages] = React.useState<DisplayMessage[]>([]);
  const [input, setInput] = React.useState("");
  const [streaming, setStreaming] = React.useState(false);
  const [showSkills, setShowSkills] = React.useState(false);
  const [imageMode, setImageMode] = React.useState(false);
  const [inserting, setInserting] = React.useState<string | null>(null);
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

  // Auto-resize textarea
  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 140) + "px";
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
        next.map(({ role, content }) => ({ role, content })),
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
      { id: assistantId, role: "assistant" as const, content: "正在生成图片..." },
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
                content: img.revisedPrompt ? `Prompt: ${img.revisedPrompt}` : "",
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
    // Reset textarea height
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
  };

  // ---- Settings full-page overlay inside the sidebar ----
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
          <span className="text-sm font-semibold text-app-fg">
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

  // ---- Main chat view ----
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-app-border flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-app-fg">
          <Sparkles size={13} /> AI 写作助手
        </div>
        <div className="flex items-center gap-1">
          {selection && (
            <div className="text-[10px] text-app-fg-muted bg-app-bg px-2 py-1 rounded border border-app-border max-w-[120px] truncate mr-1">
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

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-auto px-4 py-3 space-y-3">
        {messages.length === 0 ? (
          <div className="text-xs text-app-fg-muted leading-relaxed mt-8 text-center">
            <div className="text-app-fg-subtle mb-2">
              点击输入框中 <Plus size={10} className="inline -mt-0.5" /> 选择 Skill，或直接输入对话
            </div>
            <div className="text-[11px]">
              选中编辑器文本后使用「扩写 / 改写」类 Skill 效果更佳
            </div>
          </div>
        ) : (
          messages
            .filter((m) => m.role !== "system")
            .map((m) => (
              <div key={m.id} className="animate-fade-in">
                {m.role === "user" ? (
                  <div className="flex justify-end">
                    <div className="max-w-[85%] bg-blue-50 dark:bg-blue-950/30 text-app-fg rounded-2xl rounded-tr-sm px-3.5 py-2 text-sm leading-relaxed">
                      <div className="whitespace-pre-wrap break-words">
                        {m.content}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="max-w-[95%]">
                    {m.imageB64 && (
                      <div className="mb-2 rounded-lg overflow-hidden border border-app-border relative group">
                        <img
                          src={`data:image/png;base64,${m.imageB64}`}
                          alt="AI generated"
                          className="w-full h-auto"
                        />
                        <button
                          onClick={() => insertImage(m.imageB64!)}
                          disabled={inserting === m.imageB64}
                          className="absolute bottom-2 right-2 bg-white/90 dark:bg-black/70 text-black dark:text-white px-2.5 py-1.5 rounded-md text-xs flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-white dark:hover:bg-black/90"
                        >
                          {inserting === m.imageB64 ? (
                            <><Check size={12} /> 已添加</>
                          ) : (
                            <><Plus size={12} /> 插入正文 & 存入资产</>
                          )}
                        </button>
                      </div>
                    )}
                    {m.content && (
                      <div className="text-sm leading-relaxed text-app-fg whitespace-pre-wrap break-words">
                        {m.content}
                      </div>
                    )}
                    {!m.content && !m.imageB64 && streaming && (
                      <div className="text-sm text-app-fg-muted">▍</div>
                    )}
                  </div>
                )}
              </div>
            ))
        )}
      </div>

      {/* Composer — ChatGPT-style input box */}
      <div className="px-3 pb-3 pt-1 relative">
        {/* Image mode indicator */}
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

        {/* Skill picker popover */}
        {showSkills && (
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

        {/* The input container */}
        <div className="border border-app-border rounded-xl bg-app-bg focus-within:border-app-fg-muted transition-colors">
          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              autoResize();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
            placeholder={
              imageMode
                ? "描述你想要的图片..."
                : "今天想写点什么？"
            }
            rows={1}
            className="w-full resize-none bg-transparent px-3.5 pt-3 pb-1 text-sm placeholder:text-app-fg-subtle focus:outline-none min-h-[40px]"
          />

          {/* Bottom toolbar row inside the input box */}
          <div className="flex items-center justify-between px-2 pb-2">
            <div className="flex items-center gap-0.5">
              {/* "+" Skill picker */}
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

              {/* Image mode toggle */}
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

            {/* Send / Stop */}
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
