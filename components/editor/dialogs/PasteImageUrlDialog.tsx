"use client";

import * as React from "react";
import { Globe, Check } from "lucide-react";
import { AppDialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { insertAtCursor } from "@/lib/editor-ref";
import { toast } from "@/components/ui/toast";

/**
 * Insert an image by its public URL. Skips IndexedDB entirely — the URL
 * goes straight into markdown. Use this when your image is already on a
 * CDN (Cloudflare R2, Vercel Blob, 七牛云, COS, ...) and you don't need
 * Butea's upload pipeline.
 */
export function PasteImageUrlDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [url, setUrl] = React.useState("");
  const [alt, setAlt] = React.useState("");
  const [previewOk, setPreviewOk] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    if (!open) {
      setUrl("");
      setAlt("");
      setPreviewOk(null);
    }
  }, [open]);

  // Light validation — does it look like a usable image URL?
  const isReasonableUrl = (() => {
    try {
      const u = new URL(url);
      return /^https?:$/.test(u.protocol);
    } catch {
      return false;
    }
  })();

  const insert = () => {
    if (!isReasonableUrl) {
      toast.error("URL 不合法", "需要 http:// 或 https:// 开头");
      return;
    }
    const safeAlt = alt.trim().replace(/[\[\]]/g, "") || "image";
    insertAtCursor(`![${safeAlt}](${url.trim()})\n\n`);
    toast.success("已插入图片", "URL 已直接写入 markdown");
    onOpenChange(false);
  };

  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      title={
        <span className="flex items-center gap-2">
          <Globe size={14} /> 粘贴公网图片 URL
        </span>
      }
      description="跳过本地存储，URL 直接写入 markdown。适合你的图片已经在 CDN 上。"
    >
      <div className="p-5 space-y-4">
        <label className="block">
          <span className="text-[10px] uppercase tracking-wider text-app-fg-subtle">
            图片 URL
          </span>
          <input
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setPreviewOk(null);
            }}
            placeholder="https://..."
            className="mt-1 w-full h-9 px-2.5 rounded-md border border-app-border bg-app-bg text-sm font-mono placeholder:text-app-fg-subtle focus:outline-none focus:border-app-fg-muted"
            autoFocus
          />
        </label>
        <label className="block">
          <span className="text-[10px] uppercase tracking-wider text-app-fg-subtle">
            Alt 文字（可选 · 帮助 SEO 与无障碍）
          </span>
          <input
            value={alt}
            onChange={(e) => setAlt(e.target.value)}
            placeholder="图片描述"
            className="mt-1 w-full h-9 px-2.5 rounded-md border border-app-border bg-app-bg text-sm placeholder:text-app-fg-subtle focus:outline-none focus:border-app-fg-muted"
          />
        </label>

        {isReasonableUrl && (
          <div className="border border-app-border rounded-md p-2 bg-app-bg">
            <div className="text-[10px] uppercase tracking-wider text-app-fg-subtle mb-2">
              预览
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={alt}
              onLoad={() => setPreviewOk(true)}
              onError={() => setPreviewOk(false)}
              className="max-w-full max-h-[200px] mx-auto rounded"
            />
            {previewOk === false && (
              <div className="text-[11px] text-red-700 dark:text-red-400 mt-2">
                ⚠ 加载失败 — URL 可能已过期、被防盗链、或不是图片
              </div>
            )}
            {previewOk === true && (
              <div className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-2 flex items-center gap-1">
                <Check size={11} /> 加载成功
              </div>
            )}
          </div>
        )}

        <div className="flex justify-between items-center gap-3 pt-2 border-t border-app-border">
          <p className="text-[11px] text-app-fg-muted leading-relaxed">
            推荐图床：Cloudflare R2 · Vercel Blob · 七牛云 · 腾讯 COS。把图先传到任意一个，把链接粘到这里。
          </p>
          <Button onClick={insert} disabled={!isReasonableUrl}>
            插入
          </Button>
        </div>
      </div>
    </AppDialog>
  );
}
