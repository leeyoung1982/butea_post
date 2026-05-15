"use client";

import * as React from "react";
import { Link2, Loader2 } from "lucide-react";
import { AppDialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { insertAtCursor } from "@/lib/editor-ref";

type Meta = {
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  url: string;
};

export function LinkCardDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [url, setUrl] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [meta, setMeta] = React.useState<Meta | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setUrl("");
      setMeta(null);
      setError(null);
    }
  }, [open]);

  const fetchMeta = async () => {
    if (!url) return;
    setBusy(true);
    setError(null);
    setMeta(null);
    try {
      const res = await fetch(`/api/og?url=${encodeURIComponent(url)}`);
      if (!res.ok) {
        setError(`抓取失败：HTTP ${res.status} ${res.statusText}`);
        return;
      }
      const data = await res.json().catch(() => null);
      if (!data) {
        setError("响应不是合法 JSON（可能是网关错误）");
        return;
      }
      if (!data.ok) {
        setError(data.error || "无法获取链接元数据");
        return;
      }
      setMeta(data.meta);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const insert = () => {
    if (!meta) return;
    const card = buildCardHtml(meta);
    insertAtCursor("\n\n" + card + "\n\n");
    onOpenChange(false);
  };

  const insertPlain = () => {
    if (!url) return;
    const text = meta?.title ?? url;
    insertAtCursor(`[${text}](${url})`);
    onOpenChange(false);
  };

  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      title={
        <span className="flex items-center gap-2">
          <Link2 size={14} /> 外链卡片
        </span>
      }
      description="自动抓取目标页面的 og 元数据，生成带标题/摘要/缩略图的富链接卡片"
    >
      <div className="p-5 space-y-3">
        <label className="block">
          <span className="text-[10px] uppercase tracking-wider text-app-fg-subtle">
            链接地址
          </span>
          <div className="mt-1 flex gap-2">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchMeta()}
              placeholder="https://..."
              className="flex-1 h-9 px-2.5 rounded-md border border-app-border bg-app-bg text-sm font-mono placeholder:text-app-fg-subtle focus:outline-none focus:border-app-fg-muted"
            />
            <Button onClick={fetchMeta} disabled={busy || !url}>
              {busy ? <Loader2 size={13} className="animate-spin" /> : "抓取"}
            </Button>
          </div>
        </label>

        {error && (
          <div className="text-[12px] text-red-700 dark:text-red-400">
            ⚠ {error}
          </div>
        )}

        {meta && (
          <div className="space-y-3">
            <div className="text-xs uppercase tracking-wider text-app-fg-subtle">
              预览
            </div>
            <div
              dangerouslySetInnerHTML={{ __html: buildCardHtml(meta) }}
              className="border border-app-border rounded-lg overflow-hidden bg-app-bg"
            />
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" onClick={insertPlain}>
                只插入普通链接
              </Button>
              <Button onClick={insert}>插入卡片</Button>
            </div>
          </div>
        )}
      </div>
    </AppDialog>
  );
}

/**
 * Build a self-contained, inline-styled HTML card that renders nicely in
 * both our preview AND on platforms that allow embedded HTML (公众号、X long).
 * The styles use inline `style="..."` so juice doesn't need to touch it.
 */
function buildCardHtml(m: Meta): string {
  const safe = (s?: string) =>
    (s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  const title = safe(m.title ?? m.url);
  const desc = safe(m.description ?? "");
  const site = safe(m.siteName ?? "");
  const image = m.image ?? "";

  return [
    `<a href="${m.url}" data-butea="link-card" style="display:flex;text-decoration:none;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;background:#fff;color:inherit;margin:1em 0;max-width:600px;">`,
    image
      ? `<span style="flex:0 0 120px;background:url('${image}') center/cover no-repeat #f4f4f5;min-height:96px;"></span>`
      : "",
    `<span style="flex:1;padding:12px 14px;display:flex;flex-direction:column;justify-content:center;min-width:0;">`,
    `<span style="font-size:14px;font-weight:600;color:#111827;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${title}</span>`,
    desc
      ? `<span style="font-size:12px;color:#6b7280;line-height:1.5;margin-top:4px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${desc}</span>`
      : "",
    site
      ? `<span style="font-size:11px;color:#9ca3af;margin-top:6px;">${site}</span>`
      : "",
    `</span>`,
    `</a>`,
  ].join("");
}
