"use client";

import * as React from "react";
import { Sparkles, Loader2, Check } from "lucide-react";
import { AppDialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import {
  generateImage,
  imageMarkdown,
  MissingImageKeyError,
  type ImageSize,
  type ImageStyle,
} from "@/lib/llm/image";
import { insertAtCursor, insertAtTop, readH1Title } from "@/lib/editor-ref";
import { useWorkshop } from "@/lib/store";
import { cn } from "@/lib/utils";

const STYLE_PRESETS: { id: ImageStyle; label: string; suffix: string }[] = [
  { id: "vivid", label: "鲜活", suffix: ", vibrant colors, cinematic, dramatic lighting" },
  { id: "natural", label: "写实", suffix: ", natural lighting, photorealistic" },
];

const VIBE_PRESETS = [
  { id: "minimal", label: "极简", suffix: ", minimalist composition, lots of negative space, flat illustration" },
  { id: "illustration", label: "插画", suffix: ", editorial illustration, flat colors, geometric shapes" },
  { id: "photo", label: "摄影", suffix: ", documentary photography, 35mm film grain" },
  { id: "techno", label: "科技", suffix: ", futuristic, neon accents, isometric perspective" },
  { id: "warm", label: "暖色", suffix: ", warm color palette, sunset tones, soft shadows" },
  { id: "mono", label: "黑白", suffix: ", black and white photography, high contrast" },
];

const SIZE_PRESETS: { id: ImageSize; label: string; ratio: string }[] = [
  { id: "1024x1024", label: "正方形", ratio: "1:1" },
  { id: "1792x1024", label: "横版", ratio: "16:9" },
  { id: "1024x1792", label: "竖版", ratio: "9:16" },
];

export function AIImageDialog({
  open,
  onOpenChange,
  mode,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "inline" | "cover";
}) {
  const topic = useWorkshop((s) => s.topic);
  const themeId = useWorkshop((s) => s.themeId);
  const setSidebarPanel = useWorkshop((s) => s.setSidebarPanel);

  const [prompt, setPrompt] = React.useState("");
  const [style, setStyle] = React.useState<ImageStyle>("vivid");
  const [vibe, setVibe] = React.useState<string>("minimal");
  const [size, setSize] = React.useState<ImageSize>(
    mode === "cover" ? "1792x1024" : "1024x1024"
  );
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [results, setResults] = React.useState<{ b64: string; revised?: string }[]>([]);

  React.useEffect(() => {
    if (!open) return;
    setError(null);
    setResults([]);
    // Seed prompt for cover mode
    if (mode === "cover") {
      const h1 = readH1Title();
      const seed = h1 ? `A cover image for an article titled "${h1}"` : "";
      const ctx = topic ? `, about ${topic}` : "";
      setPrompt(seed + ctx);
      setSize("1792x1024");
    } else {
      setPrompt("");
      setSize("1024x1024");
    }
  }, [open, mode, topic]);

  const composedPrompt = React.useMemo(() => {
    const vibeP = VIBE_PRESETS.find((v) => v.id === vibe);
    const styleP = STYLE_PRESETS.find((s) => s.id === style);
    return [prompt.trim(), vibeP?.suffix, styleP?.suffix].filter(Boolean).join("");
  }, [prompt, vibe, style]);

  const generate = async () => {
    if (!prompt.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const imgs = await generateImage({
        prompt: composedPrompt,
        size,
        style,
        quality: mode === "cover" ? "hd" : "standard",
        n: 1,
      });
      setResults(imgs.map((i) => ({ b64: i.b64, revised: i.revisedPrompt })));
    } catch (e) {
      if (e instanceof MissingImageKeyError) {
        setError(e.message);
        setSidebarPanel("ai");
      } else {
        setError((e as Error).message);
      }
    } finally {
      setBusy(false);
    }
  };

  const insertSelected = async (b64: string) => {
    const alt = prompt.slice(0, 80).replace(/[\[\]]/g, "");
    const md = await imageMarkdown(b64, alt);
    if (mode === "cover") {
      insertAtTop(md);
    } else {
      insertAtCursor(md);
    }
    onOpenChange(false);
  };

  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      title={
        <span className="flex items-center gap-2">
          <Sparkles size={14} />
          {mode === "cover" ? "AI 封面生成" : "AI 文中插图"}
        </span>
      }
      description={
        mode === "cover"
          ? "根据 H1 标题和你选的风格生成 16:9 封面图，插入正文最前面"
          : "在当前光标位置插入一张 AI 生图"
      }
    >
      <div className="p-5 space-y-4">
        {/* Prompt */}
        <Field label="描述（中英都行）">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={
              mode === "cover"
                ? "A minimalist cover for an article about..."
                : "一张说明这一段的配图。"
            }
            rows={3}
            className="w-full px-3 py-2 rounded-md border border-app-border bg-app-bg text-sm placeholder:text-app-fg-subtle focus:outline-none focus:border-app-fg-muted"
          />
        </Field>

        {/* Style preset row */}
        <Field label="风格">
          <div className="flex flex-wrap gap-1.5">
            {VIBE_PRESETS.map((v) => (
              <button
                key={v.id}
                onClick={() => setVibe(v.id)}
                className={cn(
                  "px-2.5 py-1 rounded-md text-xs transition-colors",
                  vibe === v.id
                    ? "bg-app-fg text-app-bg"
                    : "bg-app-bg border border-app-border text-app-fg-muted hover:text-app-fg"
                )}
              >
                {v.label}
              </button>
            ))}
          </div>
        </Field>

        {/* Style / size */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="色调">
            <div className="flex gap-1.5">
              {STYLE_PRESETS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setStyle(s.id)}
                  className={cn(
                    "flex-1 px-2 py-1 rounded-md text-xs transition-colors",
                    style === s.id
                      ? "bg-app-fg text-app-bg"
                      : "bg-app-bg border border-app-border text-app-fg-muted hover:text-app-fg"
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </Field>

          <Field label="比例">
            <div className="flex gap-1.5">
              {SIZE_PRESETS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSize(s.id)}
                  className={cn(
                    "flex-1 px-2 py-1 rounded-md text-xs transition-colors",
                    size === s.id
                      ? "bg-app-fg text-app-bg"
                      : "bg-app-bg border border-app-border text-app-fg-muted hover:text-app-fg"
                  )}
                >
                  {s.ratio}
                </button>
              ))}
            </div>
          </Field>
        </div>

        {/* Composed prompt preview */}
        <details className="text-[11px] text-app-fg-muted">
          <summary className="cursor-pointer hover:text-app-fg">查看最终发给模型的 prompt</summary>
          <div className="mt-2 p-2 bg-app-bg border border-app-border rounded font-mono break-all">
            {composedPrompt || "—"}
          </div>
        </details>

        {/* Action */}
        <div className="flex items-center justify-between">
          <div className="text-[11px] text-app-fg-subtle">
            {mode === "cover" ? "16:9 高质量封面 · 用你设置的图片 provider" : "用你设置的图片 provider"}
          </div>
          <Button onClick={generate} disabled={busy || !prompt.trim()}>
            {busy ? (
              <>
                <Loader2 size={13} className="animate-spin" /> 生成中…
              </>
            ) : (
              <>
                <Sparkles size={13} /> 生成
              </>
            )}
          </Button>
        </div>

        {error && (
          <div className="px-3 py-2 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded text-[12px] text-red-700 dark:text-red-400">
            ⚠ {error}
          </div>
        )}

        {/* Results */}
        {results.length > 0 && (
          <div className="space-y-3 pt-2 border-t border-app-border">
            <div className="text-xs uppercase tracking-wider text-app-fg-subtle">
              结果（点击使用）
            </div>
            <div className="grid grid-cols-1 gap-3">
              {results.map((r, i) => (
                <button
                  key={i}
                  onClick={() => insertSelected(r.b64)}
                  className="group relative rounded-lg overflow-hidden border border-app-border hover:border-app-fg transition-colors"
                >
                  <img
                    src={`data:image/png;base64,${r.b64}`}
                    alt="generated"
                    className="w-full h-auto"
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <span className="bg-white text-black px-3 py-1.5 rounded-md text-sm flex items-center gap-1.5">
                      <Check size={13} /> 插入到{mode === "cover" ? "封面" : "正文"}
                    </span>
                  </div>
                  {r.revised && (
                    <div className="px-3 py-1.5 bg-app-bg text-[10px] text-app-fg-muted border-t border-app-border">
                      模型实际用的 prompt：{r.revised.slice(0, 200)}
                      {r.revised.length > 200 && "…"}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppDialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-wider text-app-fg-subtle">
        {label}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
