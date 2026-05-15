"use client";

import * as React from "react";
import {
  Sparkles,
  Loader2,
  RotateCcw,
  AlertCircle,
  ChevronDown,
  Check,
  Wand2,
} from "lucide-react";
import * as Popover from "@radix-ui/react-popover";
import { ADAPTERS, type PlatformId } from "@/lib/adapters";
import { useWorkshop } from "@/lib/store";
import {
  translateForPlatform,
  hashMarkdown,
  MissingLLMKeyError,
} from "@/lib/llm/translate";
import { getTranslationPrompt } from "@/lib/llm/translations";
import { cn } from "@/lib/utils";

/**
 * Top strip of the preview pane.
 *
 * Layout (left → right):
 *   [● Platform ▼]                   [使用 原稿/译稿 ⇋]  [原生化此篇]  [全部原生化]
 *
 *   - Platform picker is a single dropdown (no tab strip)
 *   - Color dot indicates each platform's accent
 *   - Active platform with an existing translation gets a ✨ badge
 *   - AI buttons live on the right, primary = "全部原生化" (gradient)
 */
export function PlatformTabs() {
  const currentPlatform = useWorkshop((s) => s.currentPlatform);
  const setCurrentPlatform = useWorkshop((s) => s.setCurrentPlatform);
  const markdown = useWorkshop((s) => s.markdown);
  const translations = useWorkshop((s) => s.translations);
  const useTranslation = useWorkshop((s) => s.useTranslation);
  const setUseTranslation = useWorkshop((s) => s.setUseTranslation);
  const translatingFor = useWorkshop((s) => s.translatingFor);
  const setTranslatingFor = useWorkshop((s) => s.setTranslatingFor);
  const setTranslation = useWorkshop((s) => s.setTranslation);
  const setTranslationProgress = useWorkshop((s) => s.setTranslationProgress);
  const clearTranslation = useWorkshop((s) => s.clearTranslation);
  const topic = useWorkshop((s) => s.topic);
  const audience = useWorkshop((s) => s.audience);
  const setAiOpen = useWorkshop((s) => s.setAiOpen);

  const [error, setError] = React.useState<string | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);
  const batchAbortRef = React.useRef<AbortController | null>(null);
  const clearProgressTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [batchMode, setBatchMode] = React.useState(false);
  type ProgressState = "running" | "done" | "error";
  const [batchProgress, setBatchProgress] = React.useState<
    Partial<Record<PlatformId, ProgressState>>
  >({});

  React.useEffect(() => {
    return () => {
      if (clearProgressTimerRef.current)
        clearTimeout(clearProgressTimerRef.current);
    };
  }, []);

  const sourceHash = React.useMemo(() => hashMarkdown(markdown), [markdown]);

  const currentAdapter = ADAPTERS.find((a) => a.id === currentPlatform) ?? ADAPTERS[0];
  const currentTranslation = translations[currentPlatform];
  const isStale =
    currentTranslation && currentTranslation.sourceHash !== sourceHash;
  const isUsing = useTranslation[currentPlatform] === true;
  const isBusy = translatingFor === currentPlatform;
  const prompt = getTranslationPrompt(currentPlatform);

  const runTranslate = async () => {
    if (translatingFor) return;
    // Long-form platforms (公众号 / X Long) don't need an LLM rewrite — they
    // render the source markdown directly. Skip the call entirely.
    if (!currentAdapter.requiresRewrite) {
      return;
    }
    setError(null);
    setTranslatingFor(currentPlatform);
    setTranslationProgress("");
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const md = await translateForPlatform(
        currentPlatform,
        { markdown, topic, audience },
        (_chunk, accumulated) => setTranslationProgress(accumulated),
        controller.signal
      );
      setTranslation(currentPlatform, {
        markdown: md,
        sourceHash,
        createdAt: Date.now(),
      });
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      if (e instanceof MissingLLMKeyError) {
        setError(e.message);
        setAiOpen(true);
        return;
      }
      setError((e as Error).message);
    } finally {
      setTranslatingFor(null);
      setTranslationProgress("");
      abortRef.current = null;
    }
  };

  const cancel = () => abortRef.current?.abort();

  const runBatch = async () => {
    setError(null);
    setBatchMode(true);
    const controller = new AbortController();
    batchAbortRef.current = controller;
    const initial: Partial<Record<PlatformId, ProgressState>> = {};
    // Only short-form platforms need rewriting; long-form use the source
    // markdown directly and don't appear in progress.
    const targets = ADAPTERS.filter((a) => a.requiresRewrite);
    targets.forEach((a) => (initial[a.id] = "running"));
    setBatchProgress(initial);

    try {
      await Promise.all(
        targets.map(async (adapter) => {
          try {
            const md = await translateForPlatform(
              adapter.id,
              { markdown, topic, audience },
              undefined,
              controller.signal
            );
            if (controller.signal.aborted) return;
            setTranslation(adapter.id, {
              markdown: md,
              sourceHash,
              createdAt: Date.now(),
            });
            setBatchProgress((p) => ({ ...p, [adapter.id]: "done" }));
          } catch (e) {
            if (e instanceof MissingLLMKeyError) {
              setError(e.message);
              setAiOpen(true);
              controller.abort();
              throw e;
            }
            if (
              (e as Error).name !== "AbortError" &&
              !controller.signal.aborted
            ) {
              setBatchProgress((p) => ({ ...p, [adapter.id]: "error" }));
            }
          }
        })
      );
    } catch {
      // surfaced via setError
    } finally {
      setBatchMode(false);
      batchAbortRef.current = null;
      if (clearProgressTimerRef.current)
        clearTimeout(clearProgressTimerRef.current);
      clearProgressTimerRef.current = setTimeout(
        () => setBatchProgress({}),
        1500
      );
    }
  };

  const cancelBatch = () => batchAbortRef.current?.abort();

  return (
    <div className="border-b border-app-border bg-app-surface">
      <div className="flex items-center gap-2 px-3 py-2">
        {/* Platform picker — dropdown */}
        <PlatformDropdown
          adapter={currentAdapter}
          onPick={setCurrentPlatform}
          translations={translations}
          batchProgress={batchProgress}
          translatingFor={translatingFor}
        />

        <div className="flex-1" />

        {/* Translation source toggle (only when translation exists) */}
        {currentTranslation && !isBusy && !batchMode && (
          <ToggleBadge
            isUsing={isUsing}
            isStale={!!isStale}
            onToggle={() => setUseTranslation(currentPlatform, !isUsing)}
            onClear={() => clearTranslation(currentPlatform)}
          />
        )}

        {/* Live state — show "in progress" without dropdown */}
        {isBusy ? (
          <SecondaryBtn onClick={cancel}>
            <Loader2 size={11} className="animate-spin" />
            适配中… 停止
          </SecondaryBtn>
        ) : batchMode ? (
          <SecondaryBtn onClick={cancelBatch}>
            <Loader2 size={11} className="animate-spin" />
            批量中… 停止
          </SecondaryBtn>
        ) : (
          <SelfAdaptMenu
            currentAdapter={currentAdapter}
            currentTranslation={!!currentTranslation}
            onRunCurrent={runTranslate}
            onRunAll={runBatch}
            disabled={!!translatingFor}
          />
        )}
      </div>

      {/* Stale-translation strip — surfaces explicitly when the user is
          viewing an AI version that no longer matches the source draft. */}
      {currentTranslation && isStale && isUsing && !isBusy && !batchMode && (
        <div className="px-3 py-1.5 bg-amber-50 dark:bg-amber-950/30 border-t border-amber-200 dark:border-amber-900 text-[11px] text-amber-800 dark:text-amber-300 flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5">
            <AlertCircle size={11} />
            原稿已修改 — 当前 AI 适配版本基于较旧的原稿
          </span>
          <span className="flex items-center gap-1.5">
            <button
              onClick={() => setUseTranslation(currentPlatform, false)}
              className="px-1.5 py-0.5 rounded hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
            >
              切回原稿
            </button>
            {currentAdapter.requiresRewrite && (
              <button
                onClick={runTranslate}
                disabled={!!translatingFor}
                className="px-1.5 py-0.5 rounded bg-amber-800 dark:bg-amber-300 text-amber-50 dark:text-amber-950 hover:opacity-90 disabled:opacity-40 transition-opacity"
              >
                重新适配
              </button>
            )}
          </span>
        </div>
      )}

      {error && (
        <div className="px-3 py-1.5 bg-red-50 dark:bg-red-950/30 border-t border-red-200 dark:border-red-900 text-[11px] text-red-700 dark:text-red-400 flex items-center gap-1.5">
          <AlertCircle size={11} />
          {error}
        </div>
      )}
    </div>
  );
}

// ====================================================================
// Platform dropdown
// ====================================================================

function PlatformDropdown({
  adapter,
  onPick,
  translations,
  batchProgress,
  translatingFor,
}: {
  adapter: (typeof ADAPTERS)[number];
  onPick: (id: PlatformId) => void;
  translations: Partial<Record<PlatformId, unknown>>;
  batchProgress: Partial<Record<PlatformId, "running" | "done" | "error">>;
  translatingFor: PlatformId | null;
}) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          className="flex items-center gap-2 pl-2 pr-2.5 py-1.5 rounded-md border transition-colors hover:bg-app-surface-hover"
          style={{
            background: hexWithAlpha(adapter.accent, 0.06),
            borderColor: hexWithAlpha(adapter.accent, 0.25),
          }}
          title="切换平台"
        >
          <Dot color={adapter.accent} />
          <span className="text-sm font-medium text-app-fg">{adapter.name}</span>
          <ChevronDown size={12} className="text-app-fg-subtle" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          className="z-50 w-[320px] bg-app-surface border border-app-border rounded-lg shadow-xl py-1 animate-fade-in"
        >
          <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-app-fg-subtle">
            目标平台
          </div>
          <div>
            {ADAPTERS.map((a) => {
              const active = a.id === adapter.id;
              const hasTrans = !!translations[a.id];
              const progress = batchProgress[a.id];
              const beingTranslated = translatingFor === a.id;
              return (
                <Popover.Close key={a.id} asChild>
                  <button
                    onClick={() => onPick(a.id)}
                    className={cn(
                      "w-full flex items-start gap-2.5 px-3 py-2 text-left hover:bg-app-surface-hover transition-colors",
                      active && "bg-app-surface-hover"
                    )}
                  >
                    <Dot color={a.accent} className="mt-1.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-app-fg">
                          {a.name}
                        </span>
                        {(beingTranslated || progress === "running") && (
                          <Loader2
                            size={10}
                            className="animate-spin text-app-fg-muted"
                          />
                        )}
                        {!beingTranslated &&
                          !progress &&
                          hasTrans && (
                            <Sparkles
                              size={10}
                              className="text-orange-600"
                              aria-label="已有 AI 原生化版本"
                            />
                          )}
                        {progress === "done" && (
                          <Check size={10} className="text-emerald-600" />
                        )}
                        {progress === "error" && (
                          <AlertCircle size={10} className="text-red-600" />
                        )}
                      </div>
                      <div className="text-[11px] text-app-fg-muted truncate mt-0.5">
                        {a.description}
                      </div>
                    </div>
                    {active && <Check size={13} className="text-app-fg mt-1 shrink-0" />}
                  </button>
                </Popover.Close>
              );
            })}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function Dot({ color, className }: { color: string; className?: string }) {
  return (
    <span
      className={cn("inline-block w-2 h-2 rounded-full shrink-0", className)}
      style={{ background: color }}
      aria-hidden
    />
  );
}

/** Convert "#RRGGBB" + alpha [0..1] to an rgba() string. Used to tint UI
 *  with each platform's brand color without painting the whole surface. */
function hexWithAlpha(hex: string, alpha: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ====================================================================
// Buttons
// ====================================================================

function SecondaryBtn({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] bg-app-bg border border-app-border text-app-fg-muted hover:text-app-fg hover:bg-app-surface-hover disabled:opacity-40 transition-colors"
    >
      {children}
    </button>
  );
}

// ====================================================================
// Self-adapt menu — replaces the old "原生化此篇 / 全部原生化" pair
// ====================================================================

function SelfAdaptMenu({
  currentAdapter,
  currentTranslation,
  onRunCurrent,
  onRunAll,
  disabled,
}: {
  currentAdapter: (typeof ADAPTERS)[number];
  currentTranslation: boolean;
  onRunCurrent: () => void;
  onRunAll: () => void;
  disabled: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const canRewriteCurrent = currentAdapter.requiresRewrite;
  const currentLabel = currentTranslation ? "重新适配当前平台" : "适配当前平台";

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          disabled={disabled}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] bg-app-fg text-app-bg hover:opacity-90 disabled:opacity-40 transition-opacity"
          title="平台自适配"
        >
          <Wand2 size={11} />
          平台自适配
          <ChevronDown size={11} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          className="z-50 w-[280px] bg-app-surface border border-app-border rounded-lg shadow-xl py-1 animate-fade-in"
        >
          <button
            onClick={() => {
              setOpen(false);
              onRunCurrent();
            }}
            disabled={!canRewriteCurrent}
            className={cn(
              "w-full flex items-start gap-2.5 px-3 py-2 text-left transition-colors",
              canRewriteCurrent
                ? "hover:bg-app-surface-hover cursor-pointer"
                : "opacity-50 cursor-not-allowed"
            )}
          >
            <Sparkles size={12} className="mt-0.5 text-orange-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-app-fg">
                {currentLabel}
                <span className="ml-1.5 text-[11px] text-app-fg-muted font-normal">
                  · {currentAdapter.name}
                </span>
              </div>
              <div className="text-[11px] text-app-fg-muted mt-0.5">
                {canRewriteCurrent
                  ? "由 AI 针对该短文平台改写、压缩、控字数"
                  : "长文平台无需 AI 改写，直接使用编辑器原文"}
              </div>
            </div>
          </button>
          <div className="h-px bg-app-border my-1" />
          <button
            onClick={() => {
              setOpen(false);
              onRunAll();
            }}
            className="w-full flex items-start gap-2.5 px-3 py-2 text-left hover:bg-app-surface-hover transition-colors"
          >
            <Wand2 size={12} className="mt-0.5 text-app-fg shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-app-fg">适配全部平台</div>
              <div className="text-[11px] text-app-fg-muted mt-0.5">
                批量改写所有短文平台（小红书 / X Thread / 微博 / 朋友圈）
              </div>
            </div>
          </button>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

// ====================================================================
// Translation toggle badge
// ====================================================================

function ToggleBadge({
  isUsing,
  isStale,
  onToggle,
  onClear,
}: {
  isUsing: boolean;
  isStale: boolean;
  onToggle: () => void;
  onClear: () => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-app-bg border text-[11px]",
        isStale && isUsing
          ? "border-amber-300 dark:border-amber-800"
          : "border-app-border"
      )}
    >
      <button
        onClick={onToggle}
        className={cn(
          "px-1.5 py-0.5 rounded transition-colors",
          isUsing
            ? "bg-app-fg text-app-bg"
            : "text-app-fg-muted hover:text-app-fg"
        )}
        title={isUsing ? "切回原稿" : "切到 AI 原生化版"}
      >
        {isUsing ? "✨ 原生版" : "原稿"}
      </button>
      <button
        onClick={onClear}
        className="text-app-fg-subtle hover:text-app-fg p-0.5"
        title="清除此平台的 AI 原生化版本"
      >
        <RotateCcw size={10} />
      </button>
    </div>
  );
}
