"use client";

import * as React from "react";
import {
  Copy,
  Check,
  Loader2,
  Sparkles,
  Globe,
  Download,
  AlertCircle,
  Rocket,
  Settings,
} from "lucide-react";
import { useWorkshop } from "@/lib/store";
import { getTheme } from "@/lib/themes/themes";
import { ADAPTERS, getAdapter, type AdapterOutput } from "@/lib/adapters";
import type { PlatformId } from "@/lib/adapters/types";
import {
  translateForPlatform,
  hashMarkdown,
  MissingLLMKeyError,
} from "@/lib/llm/translate";
import { ImageHostPanel } from "@/components/publish/ImageHostPanel";
import { AstroPushSection } from "@/components/publish/AstroPushSection";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

/**
 * Publish Center — replaces the old Preview + PlatformTabs + ExportDialog.
 *
 * Flow:
 *   1. User writes in the immersive editor
 *   2. When done, opens the Publish sidebar
 *   3. Picks a platform → sees preview + copy/download actions
 *   4. Short-form platforms get AI adaptation; long-form uses source directly
 */
export function PublishCenter() {
  const markdown = useWorkshop((s) => s.markdown);
  const themeId = useWorkshop((s) => s.themeId);
  const currentPlatform = useWorkshop((s) => s.currentPlatform);
  const setCurrentPlatform = useWorkshop((s) => s.setCurrentPlatform);
  const translations = useWorkshop((s) => s.translations);
  const useTranslation = useWorkshop((s) => s.useTranslation);
  const setUseTranslation = useWorkshop((s) => s.setUseTranslation);
  const setTranslation = useWorkshop((s) => s.setTranslation);
  const clearTranslation = useWorkshop((s) => s.clearTranslation);
  const translatingFor = useWorkshop((s) => s.translatingFor);
  const setTranslatingFor = useWorkshop((s) => s.setTranslatingFor);
  const setTranslationProgress = useWorkshop((s) => s.setTranslationProgress);
  const topic = useWorkshop((s) => s.topic);
  const audience = useWorkshop((s) => s.audience);
  const setAiOpen = useWorkshop((s) => s.setAiOpen);

  const customThemeTokens = useWorkshop((s) => s.customThemeTokens);
  const theme = React.useMemo(
    () => getTheme(themeId, customThemeTokens ?? undefined),
    [themeId, customThemeTokens]
  );
  const adapter = getAdapter(currentPlatform);
  const sourceHash = React.useMemo(() => hashMarkdown(markdown), [markdown]);
  const currentTranslation = translations[currentPlatform];
  const isStale =
    currentTranslation && currentTranslation.sourceHash !== sourceHash;
  const isBusy = translatingFor === currentPlatform;

  const [output, setOutput] = React.useState<AdapterOutput | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState<string | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  // Determine effective markdown for current platform
  const effectiveMarkdown = React.useMemo(() => {
    if (useTranslation[currentPlatform] && translations[currentPlatform]) {
      return translations[currentPlatform]!.markdown;
    }
    return markdown;
  }, [markdown, currentPlatform, useTranslation, translations]);

  // Render preview
  React.useEffect(() => {
    let cancelled = false;
    adapter
      .render({ markdown: effectiveMarkdown, topic, audience }, theme)
      .then((r) => {
        if (!cancelled) setOutput(r);
      })
      .catch((e) => {
        if (!cancelled)
          toast.error("渲染失败", (e as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, [effectiveMarkdown, theme, adapter, topic, audience]);

  const flash = (key: string) => {
    setCopied(key);
    setTimeout(() => setCopied(null), 1600);
  };

  const copyText = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      flash(key);
    } catch (e) {
      toast.error("复制失败", (e as Error).message);
    }
  };

  const copyRichHtml = async (html: string) => {
    try {
      const blob = new Blob([html], { type: "text/html" });
      const textBlob = new Blob([markdown], { type: "text/plain" });
      await navigator.clipboard.write([
        new ClipboardItem({ "text/html": blob, "text/plain": textBlob }),
      ]);
      flash("rich");
    } catch (e) {
      toast.error("复制失败", (e as Error).message);
    }
  };

  const downloadFile = (content: string, ext: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const title = markdown.match(/^#\s+(.+)/m)?.[1] ?? "draft";
    a.download = `${title.replace(/[^\w\u4e00-\u9fff\s-]/g, "").slice(0, 40)}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const runAdapt = async () => {
    if (translatingFor) return;
    if (!adapter.requiresRewrite) return;
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

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-app-border">
        <div className="text-sm font-medium">发布中心</div>
        <div className="text-[11px] text-app-fg-muted mt-0.5">
          选择平台，预览效果，一键复制或下载
        </div>
      </div>

      {/* Platform selector */}
      <div className="px-3 py-2 border-b border-app-border space-y-1">
        <div className="text-[10px] uppercase tracking-wider text-app-fg-subtle mb-1.5">
          目标平台
        </div>
        <div className="flex flex-wrap gap-1">
          {ADAPTERS.map((a) => {
            const active = a.id === currentPlatform;
            const hasTrans = !!translations[a.id];
            return (
              <button
                key={a.id}
                onClick={() => setCurrentPlatform(a.id)}
                className={cn(
                  "flex items-center gap-1 px-2 py-1 rounded text-[11px] transition-colors",
                  active
                    ? "text-white font-medium"
                    : "text-app-fg-muted hover:text-app-fg hover:bg-app-surface-hover"
                )}
                style={active ? { background: a.accent } : undefined}
              >
                {a.name}
                {hasTrans && !active && (
                  <Sparkles size={9} className="text-orange-500" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* AI adapt controls (for short-form platforms) */}
      {adapter.requiresRewrite && (
        <div className="px-3 py-2 border-b border-app-border space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-app-fg-muted">
              AI 平台适配
            </span>
            {isBusy ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => abortRef.current?.abort()}
              >
                <Loader2 size={11} className="animate-spin" />
                停止
              </Button>
            ) : (
              <Button size="sm" onClick={runAdapt}>
                <Sparkles size={11} />
                {currentTranslation ? "重新适配" : "适配"}
              </Button>
            )}
          </div>
          {currentTranslation && !isBusy && (
            <div className="flex items-center gap-2 text-[11px]">
              <button
                onClick={() =>
                  setUseTranslation(
                    currentPlatform,
                    !useTranslation[currentPlatform]
                  )
                }
                className={cn(
                  "px-2 py-0.5 rounded transition-colors",
                  useTranslation[currentPlatform]
                    ? "bg-orange-100 text-orange-800"
                    : "bg-app-bg text-app-fg-muted"
                )}
              >
                {useTranslation[currentPlatform] ? "查看原稿" : "查看适配版"}
              </button>
              <button
                onClick={() => clearTranslation(currentPlatform)}
                className="text-app-fg-subtle hover:text-app-fg"
              >
                清除
              </button>
              {isStale && (
                <span className="text-amber-600 flex items-center gap-1">
                  <AlertCircle size={10} />
                  原稿已变更
                </span>
              )}
            </div>
          )}
          {error && (
            <div className="text-[11px] text-red-600 flex items-center gap-1">
              <AlertCircle size={10} />
              {error}
            </div>
          )}
        </div>
      )}

      {/* Preview + actions */}
      <div className="flex-1 overflow-auto">
        {!output ? (
          <div className="p-4 text-xs text-app-fg-muted">渲染中...</div>
        ) : output.kind === "html" ? (
          <div className="space-y-3 p-3">
            {/* Stats */}
            {output.stats && (
              <div className="text-[11px] text-app-fg-muted flex items-center gap-2">
                <span
                  className="font-medium"
                  style={{ color: adapter.accent }}
                >
                  {output.stats.characterCount.toLocaleString()} 字
                </span>
                {output.stats.warnings?.map((w, i) => (
                  <span key={i} className="text-amber-600">
                    {w}
                  </span>
                ))}
              </div>
            )}
            {/* HTML preview (compact) */}
            <div
              className="preview-root bg-white rounded border border-app-border p-4 text-sm max-h-[300px] overflow-auto"
              dangerouslySetInnerHTML={{ __html: output.html }}
            />
            {output.previewCss && (
              <style dangerouslySetInnerHTML={{ __html: output.previewCss }} />
            )}
            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => copyRichHtml(output.html)}>
                {copied === "rich" ? (
                  <Check size={12} />
                ) : (
                  <Copy size={12} />
                )}
                复制富文本
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => copyText("html", output.html)}
              >
                {copied === "html" ? (
                  <Check size={12} />
                ) : (
                  <Copy size={12} />
                )}
                复制 HTML
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => copyText("md", markdown)}
              >
                {copied === "md" ? (
                  <Check size={12} />
                ) : (
                  <Copy size={12} />
                )}
                复制 MD
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  downloadFile(output.html, "html", "text/html")
                }
              >
                <Download size={12} />
                .html
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  downloadFile(markdown, "md", "text/markdown")
                }
              >
                <Download size={12} />
                .md
              </Button>
            </div>
          </div>
        ) : output.kind === "thread" ? (
          <div className="p-3 space-y-2">
            {output.posts.map((p) => (
              <div
                key={p.index}
                className="bg-app-bg border border-app-border rounded-lg p-3"
              >
                <div className="flex items-center justify-between mb-1 text-[11px] text-app-fg-muted">
                  <span>#{p.index}</span>
                  <div className="flex items-center gap-2">
                    <span
                      className={
                        p.overLimit ? "text-red-600 font-semibold" : ""
                      }
                    >
                      {p.charCount}/280
                    </span>
                    <button
                      onClick={() => copyText(`p-${p.index}`, p.text)}
                      className="hover:text-app-fg"
                    >
                      {copied === `p-${p.index}` ? (
                        <Check size={11} />
                      ) : (
                        <Copy size={11} />
                      )}
                    </button>
                  </div>
                </div>
                <div className="text-xs whitespace-pre-wrap">{p.text}</div>
              </div>
            ))}
            <Button
              size="sm"
              className="w-full"
              onClick={() =>
                copyText(
                  "all-thread",
                  output.posts.map((p) => p.text).join("\n\n---\n\n")
                )
              }
            >
              <Copy size={12} />
              复制全部
            </Button>
          </div>
        ) : output.kind === "cards" ? (
          <div className="p-3 space-y-3">
            <div className="bg-app-bg border border-app-border rounded-lg p-3">
              <div className="text-[10px] text-app-fg-subtle mb-1">标题</div>
              <div className="text-sm font-semibold flex items-center justify-between">
                {output.title}
                <button
                  onClick={() => copyText("title", output.title)}
                  className="text-app-fg-muted hover:text-app-fg"
                >
                  {copied === "title" ? (
                    <Check size={11} />
                  ) : (
                    <Copy size={11} />
                  )}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {output.cards.map((c) => (
                <div
                  key={c.n}
                  className="aspect-[3/4] rounded-md p-2 text-[9px]"
                  style={{
                    background:
                      "linear-gradient(160deg, #FFEDD5 0%, #FECDD3 100%)",
                    color: "#7C2D12",
                  }}
                >
                  <div className="font-mono">
                    {String(c.n).padStart(2, "0")}
                  </div>
                  <div className="mt-1 font-bold leading-tight text-[10px]">
                    {c.headline}
                  </div>
                  <div className="mt-1 opacity-80 leading-snug line-clamp-4">
                    {c.body}
                  </div>
                </div>
              ))}
            </div>
            <Button
              size="sm"
              className="w-full"
              onClick={() => copyText("body", output.body)}
            >
              <Copy size={12} />
              复制正文
            </Button>
            <div className="flex flex-wrap gap-1">
              {output.tags.map((t) => (
                <span
                  key={t}
                  className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200"
                >
                  #{t}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-3 space-y-3">
            <div className="bg-app-bg border border-app-border rounded-lg p-3 text-xs whitespace-pre-wrap">
              {output.text}
            </div>
            {output.link && (
              <div className="text-[11px] text-blue-600 break-all">
                {output.link}
              </div>
            )}
            <Button
              size="sm"
              className="w-full"
              onClick={() => copyText("summary", output.text)}
            >
              <Copy size={12} />
              复制文本
            </Button>
          </div>
        )}

        {/* Image hosting */}
        <div className="px-3 py-3 border-t border-app-border">
          <ImageHostPanel />
        </div>

        {/* Astro blog push */}
        <div className="px-3 py-3 border-t border-app-border">
          <AstroPushSection />
        </div>
      </div>
    </div>
  );
}
