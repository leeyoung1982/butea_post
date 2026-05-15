"use client";

import * as React from "react";
import { Monitor, Smartphone } from "lucide-react";
import { useWorkshop } from "@/lib/store";
import { getTheme } from "@/lib/themes/themes";
import { getAdapter, type AdapterOutput } from "@/lib/adapters";
import { cn } from "@/lib/utils";
import { PlatformTabs } from "./PlatformTabs";
import { ThemePicker } from "@/components/themes/ThemePicker";

/** Lightweight value debouncer — avoids a dep on use-debounce. */
function useDebouncedValue<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export function Preview() {
  const markdown = useWorkshop((s) => s.markdown);
  const themeId = useWorkshop((s) => s.themeId);
  const platformId = useWorkshop((s) => s.currentPlatform);
  const viewport = useWorkshop((s) => s.viewport);
  const setViewport = useWorkshop((s) => s.setViewport);
  const topic = useWorkshop((s) => s.topic);
  const audience = useWorkshop((s) => s.audience);
  const translations = useWorkshop((s) => s.translations);
  const useTranslation = useWorkshop((s) => s.useTranslation);
  const translatingFor = useWorkshop((s) => s.translatingFor);
  const translationProgress = useWorkshop((s) => s.translationProgress);

  const theme = getTheme(themeId);
  const adapter = getAdapter(platformId);
  const wordCount = markdown.replace(/\s/g, "").length;

  // Choose which markdown to render: live translation stream > stored
  // translation (if user opted in) > original draft.
  const effectiveMarkdown = React.useMemo(() => {
    if (translatingFor === platformId && translationProgress) {
      return translationProgress;
    }
    if (useTranslation[platformId] && translations[platformId]) {
      return translations[platformId]!.markdown;
    }
    return markdown;
  }, [
    markdown,
    translatingFor,
    translationProgress,
    platformId,
    useTranslation,
    translations,
  ]);

  // Debounce: typing burst → at most one preview render per 120ms. Keeps
  // CodeMirror typing smooth even with the full remark/rehype pipeline.
  const debouncedMarkdown = useDebouncedValue(effectiveMarkdown, 120);

  const [output, setOutput] = React.useState<AdapterOutput | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setError(null);
    adapter
      .render({ markdown: debouncedMarkdown, topic, audience }, theme)
      .then((r) => {
        if (!cancelled) setOutput(r);
      })
      .catch((e) => {
        if (!cancelled) setError((e as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedMarkdown, theme, adapter, topic, audience]);

  return (
    <div className="flex flex-col h-full bg-app-bg">
      {/* Preview-pane utility bar: word count + viewport toggle + theme.
          These were in the top app bar but they're contextual to the
          preview, so they live here now. */}
      <div className="h-7 shrink-0 px-3 flex items-center justify-between gap-2 border-b border-app-border bg-app-surface">
        <div className="flex items-center gap-2">
          <span className="text-[10px] tracking-[0.15em] text-app-fg-subtle uppercase">
            预览
          </span>
          <span className="text-[11px] text-app-fg-subtle tabular-nums">
            · {wordCount.toLocaleString()} 字
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex items-center bg-app-bg border border-app-border rounded p-0.5">
            <button
              onClick={() => setViewport("desktop")}
              className={cn(
                "px-1.5 py-0.5 rounded transition-colors",
                viewport === "desktop"
                  ? "bg-app-surface text-app-fg"
                  : "text-app-fg-muted hover:text-app-fg"
              )}
              title="桌面预览"
            >
              <Monitor size={11} />
            </button>
            <button
              onClick={() => setViewport("phone")}
              className={cn(
                "px-1.5 py-0.5 rounded transition-colors",
                viewport === "phone"
                  ? "bg-app-surface text-app-fg"
                  : "text-app-fg-muted hover:text-app-fg"
              )}
              title="手机预览"
            >
              <Smartphone size={11} />
            </button>
          </div>
          <ThemePicker />
        </div>
      </div>

      {/* Platform accent ribbon — 2px stripe in the current platform's color
          so the user always knows which adapter they're previewing. */}
      <div
        className="h-[2px] shrink-0 transition-colors duration-300"
        style={{ background: adapter.accent }}
      />
      <PlatformTabs />

      {/* Stats / warnings strip */}
      {output?.stats && (
        <div className="px-3 py-1.5 border-b border-app-border bg-app-surface flex items-center gap-3 text-[11px] text-app-fg-muted">
          <span
            className="tabular-nums font-medium"
            style={{ color: adapter.accent }}
          >
            {output.stats.characterCount.toLocaleString()} 字
          </span>
          {output.stats.paragraphCount !== undefined && (
            <span className="tabular-nums">{output.stats.paragraphCount} 块</span>
          )}
          <span className="text-app-fg-subtle">·</span>
          <span className="text-app-fg-subtle truncate">
            {adapter.limits.note}
          </span>
          {output.stats.warnings?.map((w, i) => (
            <span
              key={i}
              className="text-amber-700 dark:text-amber-400 truncate"
              title={w}
            >
              ⚠ {w}
            </span>
          ))}
        </div>
      )}

      <div
        className={cn(
          "flex-1 overflow-auto flex justify-center",
          viewport === "phone" ? "py-6" : ""
        )}
      >
        {error ? (
          <div className="p-6 text-sm text-red-600">⚠ 渲染失败：{error}</div>
        ) : !output ? (
          <div className="p-6 text-sm text-app-fg-muted">渲染中…</div>
        ) : output.kind === "html" ? (
          <HtmlPreview output={output} viewport={viewport} />
        ) : output.kind === "thread" ? (
          <ThreadPreview output={output} />
        ) : output.kind === "cards" ? (
          <CardsPreview output={output} />
        ) : (
          <SummaryPreview output={output} />
        )}
      </div>
    </div>
  );
}

function HtmlPreview({
  output,
  viewport,
}: {
  output: Extract<AdapterOutput, { kind: "html" }>;
  viewport: "desktop" | "phone";
}) {
  // Event delegation: any [data-copy-code] click copies the sibling <code> text.
  const containerRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      const btn = t.closest("[data-copy-code]") as HTMLElement | null;
      if (!btn) return;
      const pre = btn.closest("pre");
      const code = pre?.querySelector("code");
      if (!code) return;
      navigator.clipboard.writeText(code.textContent ?? "").then(() => {
        const prev = btn.textContent;
        btn.textContent = "已复制";
        btn.style.opacity = "1";
        setTimeout(() => {
          btn.textContent = prev;
          btn.style.opacity = "0.5";
        }, 1200);
      });
    };
    root.addEventListener("click", onClick);
    return () => root.removeEventListener("click", onClick);
  }, [output.html]);

  return (
    <div
      className={cn(
        "transition-all",
        viewport === "phone"
          ? "w-[375px] shadow-lg rounded-2xl border border-app-border overflow-hidden self-start"
          : "w-full max-w-[720px]"
      )}
    >
      {viewport === "phone" && (
        <div className="h-7 bg-app-fg flex items-center justify-center">
          <div className="w-20 h-3 bg-black rounded-full" />
        </div>
      )}
      {output.previewCss && (
        <style dangerouslySetInnerHTML={{ __html: output.previewCss }} />
      )}
      <div
        ref={containerRef}
        className="preview-root"
        dangerouslySetInnerHTML={{ __html: output.html }}
      />
    </div>
  );
}

function ThreadPreview({
  output,
}: {
  output: Extract<AdapterOutput, { kind: "thread" }>;
}) {
  return (
    <div className="w-full max-w-[600px] py-6 px-4 space-y-3">
      {output.posts.map((p) => (
        <div
          key={p.index}
          className="bg-app-surface border border-app-border rounded-2xl p-4 shadow-sm"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-xs text-app-fg-muted">
              <span className="w-7 h-7 rounded-full bg-app-fg text-app-bg flex items-center justify-center font-semibold text-[10px]">
                {p.index}
              </span>
              <span>Post {p.index} / {output.posts.length}</span>
            </div>
            <span
              className={cn(
                "text-[11px] tabular-nums",
                p.overLimit ? "text-red-600 font-semibold" : "text-app-fg-subtle"
              )}
            >
              {p.charCount}/280
            </span>
          </div>
          <div className="text-sm text-app-fg whitespace-pre-wrap break-words leading-relaxed">
            {p.text}
          </div>
        </div>
      ))}
    </div>
  );
}

function CardsPreview({
  output,
}: {
  output: Extract<AdapterOutput, { kind: "cards" }>;
}) {
  return (
    <div className="w-full max-w-[420px] py-6 px-4 space-y-4">
      {/* Title */}
      <div className="bg-app-surface border border-app-border rounded-xl p-4">
        <div className="text-[10px] uppercase tracking-wider text-app-fg-subtle">
          标题（≤20 字）
        </div>
        <div className="mt-1 text-base font-semibold text-app-fg break-words">
          {output.title}
        </div>
      </div>

      {/* Cards (1 to 9) — simulate the swipeable image-card sequence */}
      <div className="grid grid-cols-3 gap-2">
        {output.cards.map((c) => (
          <div
            key={c.n}
            className="aspect-[3/4] rounded-lg border border-app-border p-3 flex flex-col"
            style={{
              background: "linear-gradient(160deg, #FFEDD5 0%, #FECDD3 100%)",
              color: "#7C2D12",
            }}
          >
            <div className="text-[10px] font-mono">{String(c.n).padStart(2, "0")}/{output.cards.length}</div>
            <div className="mt-2 text-sm font-bold leading-tight">{c.headline}</div>
            <div className="mt-2 text-[10px] leading-snug opacity-80 line-clamp-6">
              {c.body}
            </div>
          </div>
        ))}
      </div>

      {/* Body text under cards */}
      <div className="bg-app-surface border border-app-border rounded-xl p-4">
        <div className="text-[10px] uppercase tracking-wider text-app-fg-subtle mb-2">
          正文（≤1000 字）
        </div>
        <div className="text-sm text-app-fg whitespace-pre-wrap leading-relaxed">
          {output.body.slice(0, 600)}
          {output.body.length > 600 && "…"}
        </div>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5">
        {output.tags.map((t) => (
          <span
            key={t}
            className="text-xs px-2 py-1 rounded-full bg-rose-50 text-rose-600 border border-rose-200"
          >
            #{t}
          </span>
        ))}
      </div>
    </div>
  );
}

function SummaryPreview({
  output,
}: {
  output: Extract<AdapterOutput, { kind: "summary" }>;
}) {
  return (
    <div className="w-full max-w-[460px] py-6 px-4">
      <div className="bg-app-surface border border-app-border rounded-2xl p-5 shadow-sm">
        <div className="text-[10px] uppercase tracking-wider text-app-fg-subtle mb-2">
          短文本（可直接复制粘贴）
        </div>
        <div className="text-sm text-app-fg whitespace-pre-wrap leading-relaxed">
          {output.text}
        </div>
        {output.link && (
          <div className="mt-3 pt-3 border-t border-app-border">
            <div className="text-[10px] text-app-fg-subtle">附带卡片链接</div>
            <div className="text-xs text-blue-600 break-all">{output.link}</div>
          </div>
        )}
      </div>
    </div>
  );
}
