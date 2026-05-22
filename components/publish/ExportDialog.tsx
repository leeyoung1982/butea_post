"use client";

import * as React from "react";
import { Copy, Download, Check } from "lucide-react";
import { AppDialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { useWorkshop } from "@/lib/store";
import { getTheme } from "@/lib/themes/themes";
import { getAdapter, type AdapterOutput } from "@/lib/adapters";
import { ImageHostPanel } from "@/components/publish/ImageHostPanel";
import { toast } from "@/components/ui/toast";

export function ExportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const markdown = useWorkshop((s) => s.markdown);
  const themeId = useWorkshop((s) => s.themeId);
  const platformId = useWorkshop((s) => s.currentPlatform);
  const topic = useWorkshop((s) => s.topic);
  const audience = useWorkshop((s) => s.audience);
  const translations = useWorkshop((s) => s.translations);
  const useTranslation = useWorkshop((s) => s.useTranslation);
  const customThemeTokens = useWorkshop((s) => s.customThemeTokens);
  const theme = React.useMemo(
    () => getTheme(themeId, customThemeTokens ?? undefined),
    [themeId, customThemeTokens]
  );
  const adapter = getAdapter(platformId);

  // Mirror Preview's logic: export the user's currently-chosen version.
  const effectiveMarkdown =
    useTranslation[platformId] && translations[platformId]
      ? translations[platformId]!.markdown
      : markdown;

  const [output, setOutput] = React.useState<AdapterOutput | null>(null);
  const [copied, setCopied] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    adapter.render({ markdown: effectiveMarkdown, topic, audience }, theme).then(setOutput);
  }, [open, effectiveMarkdown, theme, adapter, topic, audience]);

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

  const download = (kind: "md" | "html" | "json") => {
    let content: string;
    let mime: string;
    let ext: string;
    if (kind === "md") {
      content = markdown;
      mime = "text/markdown";
      ext = "md";
    } else if (kind === "html") {
      content = output?.kind === "html" ? output.html : "";
      mime = "text/html";
      ext = "html";
    } else {
      content = JSON.stringify(output, null, 2);
      mime = "application/json";
      ext = "json";
    }
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const firstHeading = (markdown.match(/^#\s+(.+)/m)?.[1] ?? "draft").replace(/<[^>]+>/g, "").trim() || "draft";
    a.download = `${firstHeading.replace(/[^\w一-龥\s-]/g, "").slice(0, 40)}.${adapter.id}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      title={
        <span className="flex items-center gap-2">
          <span
            className="inline-block w-2 h-2 rounded-full"
            style={{ background: adapter.accent }}
          />
          <span>导出 — {adapter.name}</span>
        </span>
      }
      description={adapter.description}
    >
      <div className="p-5 space-y-5">
        {!output ? (
          <div className="text-sm text-app-fg-muted">生成中…</div>
        ) : output.kind === "html" ? (
          <HtmlExportSection
            html={output.html}
            copied={copied}
            onCopyRich={() => copyRichHtml(output.html)}
            onCopyHtml={() => copyText("html", output.html)}
            onDownloadHtml={() => download("html")}
            onDownloadMd={() => download("md")}
            onCopyMd={() => copyText("md", markdown)}
            warnings={output.stats?.warnings}
          />
        ) : output.kind === "thread" ? (
          <ThreadExportSection
            output={output}
            copied={copied}
            onCopyAll={() =>
              copyText(
                "all",
                output.posts.map((p) => p.text).join("\n\n---\n\n")
              )
            }
            onCopyOne={(i, t) => copyText(`p-${i}`, t)}
          />
        ) : output.kind === "cards" ? (
          <CardsExportSection
            output={output}
            copied={copied}
            onCopyTitle={() => copyText("title", output.title)}
            onCopyBody={() => copyText("body", output.body)}
            onCopyTags={() =>
              copyText("tags", output.tags.map((t) => `#${t}`).join(" "))
            }
          />
        ) : (
          <SummaryExportSection
            output={output}
            copied={copied}
            onCopy={() => copyText("sum", output.text)}
          />
        )}

        <div className="border-t border-app-border pt-5">
          <ImageHostPanel />
        </div>

        <Section title="API 直发（下阶段）" hint="OAuth 接入后可一键推送到对应平台">
          <Button variant="outline" disabled>
            推送到 {adapter.name}（开发中）
          </Button>
        </Section>
      </div>
    </AppDialog>
  );
}

function HtmlExportSection(props: {
  html: string;
  copied: string | null;
  onCopyRich: () => void;
  onCopyHtml: () => void;
  onDownloadHtml: () => void;
  onDownloadMd: () => void;
  onCopyMd: () => void;
  warnings?: string[];
}) {
  return (
    <>
      <Section title="一键发布（推荐）" hint="复制富文本，粘到目标平台后台 / X long-form 编辑器。">
        <div className="flex gap-2 flex-wrap">
          <Button onClick={props.onCopyRich}>
            {props.copied === "rich" ? <Check size={13} /> : <Copy size={13} />}
            复制富文本
          </Button>
          <Button variant="secondary" onClick={props.onCopyHtml}>
            {props.copied === "html" ? <Check size={13} /> : <Copy size={13} />}
            复制 HTML 源码
          </Button>
        </div>
      </Section>

      <Section title="文件下载">
        <div className="flex gap-2 flex-wrap">
          <Button variant="secondary" onClick={props.onDownloadMd}>
            <Download size={13} /> 下载 .md
          </Button>
          <Button variant="secondary" onClick={props.onDownloadHtml}>
            <Download size={13} /> 下载 .html
          </Button>
          <Button variant="secondary" onClick={props.onCopyMd}>
            {props.copied === "md" ? <Check size={13} /> : <Copy size={13} />}
            复制 Markdown
          </Button>
        </div>
      </Section>

      {props.warnings && props.warnings.length > 0 && (
        <Section title="检查">
          <div className="space-y-1 text-xs text-amber-700 dark:text-amber-400">
            {props.warnings.map((w, i) => (
              <div key={i}>⚠ {w}</div>
            ))}
          </div>
        </Section>
      )}
    </>
  );
}

function ThreadExportSection(props: {
  output: Extract<AdapterOutput, { kind: "thread" }>;
  copied: string | null;
  onCopyAll: () => void;
  onCopyOne: (i: number, t: string) => void;
}) {
  return (
    <Section title={`Thread · 共 ${props.output.posts.length} 条`}>
      <div className="mb-3">
        <Button onClick={props.onCopyAll}>
          {props.copied === "all" ? <Check size={13} /> : <Copy size={13} />}
          复制全部（按 \\n\\n--- 分隔）
        </Button>
      </div>
      <div className="space-y-2 max-h-[400px] overflow-auto">
        {props.output.posts.map((p) => (
          <div
            key={p.index}
            className="bg-app-bg border border-app-border rounded-md p-3 text-sm"
          >
            <div className="flex items-center justify-between mb-1.5 text-xs text-app-fg-muted">
              <span>#{p.index}</span>
              <div className="flex items-center gap-2">
                <span
                  className={
                    p.overLimit ? "text-red-600 font-semibold" : "text-app-fg-subtle"
                  }
                >
                  {p.charCount}/280
                </span>
                <button
                  onClick={() => props.onCopyOne(p.index, p.text)}
                  className="hover:text-app-fg"
                  title="复制此条"
                >
                  {props.copied === `p-${p.index}` ? <Check size={12} /> : <Copy size={12} />}
                </button>
              </div>
            </div>
            <div className="whitespace-pre-wrap break-words text-app-fg">
              {p.text}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function CardsExportSection(props: {
  output: Extract<AdapterOutput, { kind: "cards" }>;
  copied: string | null;
  onCopyTitle: () => void;
  onCopyBody: () => void;
  onCopyTags: () => void;
}) {
  return (
    <>
      <Section title="标题">
        <div className="flex items-center justify-between gap-2 bg-app-bg border border-app-border rounded-md p-3">
          <span className="text-sm">{props.output.title}</span>
          <Button size="sm" variant="ghost" onClick={props.onCopyTitle}>
            {props.copied === "title" ? <Check size={12} /> : <Copy size={12} />}
          </Button>
        </div>
      </Section>
      <Section title="标签" hint="3-5 个为佳">
        <div className="flex items-center justify-between gap-2 bg-app-bg border border-app-border rounded-md p-3">
          <span className="text-sm">{props.output.tags.map((t) => `#${t}`).join(" ")}</span>
          <Button size="sm" variant="ghost" onClick={props.onCopyTags}>
            {props.copied === "tags" ? <Check size={12} /> : <Copy size={12} />}
          </Button>
        </div>
      </Section>
      <Section title="正文">
        <div className="bg-app-bg border border-app-border rounded-md p-3 text-sm whitespace-pre-wrap max-h-[250px] overflow-auto">
          {props.output.body}
        </div>
        <div className="mt-2">
          <Button onClick={props.onCopyBody}>
            {props.copied === "body" ? <Check size={13} /> : <Copy size={13} />}
            复制正文
          </Button>
        </div>
      </Section>
      <Section title="图卡（建议用设计工具落版后再发）">
        <div className="grid grid-cols-3 gap-2">
          {props.output.cards.map((c) => (
            <div
              key={c.n}
              className="aspect-[3/4] rounded p-2 text-xs"
              style={{
                background: "linear-gradient(160deg, #FFEDD5 0%, #FECDD3 100%)",
                color: "#7C2D12",
              }}
            >
              <div className="font-mono text-[10px]">{String(c.n).padStart(2, "0")}</div>
              <div className="mt-1 font-semibold leading-tight">{c.headline}</div>
              <div className="mt-1 text-[10px] opacity-80 leading-snug line-clamp-5">
                {c.body}
              </div>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}

function SummaryExportSection(props: {
  output: Extract<AdapterOutput, { kind: "summary" }>;
  copied: string | null;
  onCopy: () => void;
}) {
  return (
    <Section title="短文本">
      <div className="bg-app-bg border border-app-border rounded-md p-3 text-sm whitespace-pre-wrap mb-2">
        {props.output.text}
      </div>
      <Button onClick={props.onCopy}>
        {props.copied === "sum" ? <Check size={13} /> : <Copy size={13} />}
        复制
      </Button>
    </Section>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-app-fg-subtle mb-2">
        {title}
      </div>
      {hint && <div className="text-[12px] text-app-fg-muted mb-2.5">{hint}</div>}
      {children}
    </div>
  );
}
