"use client";

import * as React from "react";
import { Video } from "lucide-react";
import { AppDialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { insertAtCursor } from "@/lib/editor-ref";

/**
 * Detect known video providers and produce an embed markdown.
 * For platforms that strip iframes (e.g. WeChat), we degrade to a clickable
 * thumbnail link with the provider name.
 */
type VideoProvider = "youtube" | "bilibili" | "vimeo" | "raw" | "unknown";

function parseUrl(url: string): { provider: VideoProvider; id?: string } {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtube.com" || host === "m.youtube.com") {
      return { provider: "youtube", id: u.searchParams.get("v") ?? undefined };
    }
    if (host === "youtu.be") {
      return { provider: "youtube", id: u.pathname.slice(1) };
    }
    if (host === "bilibili.com" || host === "m.bilibili.com") {
      const m = /\/video\/([A-Za-z0-9]+)/.exec(u.pathname);
      return { provider: "bilibili", id: m?.[1] };
    }
    if (host === "vimeo.com") {
      return { provider: "vimeo", id: u.pathname.replace(/^\//, "") };
    }
    if (/\.(mp4|webm|mov)(\?|$)/i.test(u.pathname)) {
      return { provider: "raw" };
    }
    return { provider: "unknown" };
  } catch {
    return { provider: "unknown" };
  }
}

function buildEmbed(url: string): string {
  const { provider, id } = parseUrl(url);
  switch (provider) {
    case "youtube":
      return [
        `<!-- video:youtube -->`,
        `<iframe width="100%" height="400" src="https://www.youtube.com/embed/${id}" title="YouTube video" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`,
        `<!-- /video -->`,
      ].join("\n");
    case "bilibili":
      return [
        `<!-- video:bilibili -->`,
        `<iframe width="100%" height="400" src="//player.bilibili.com/player.html?bvid=${id}&high_quality=1&danmaku=0" scrolling="no" border="0" frameborder="no" allowfullscreen="true"></iframe>`,
        `<!-- /video -->`,
      ].join("\n");
    case "vimeo":
      return [
        `<!-- video:vimeo -->`,
        `<iframe src="https://player.vimeo.com/video/${id}" width="100%" height="400" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`,
        `<!-- /video -->`,
      ].join("\n");
    case "raw":
      return `<video controls width="100%" src="${url}"></video>`;
    default:
      return `[🎬 视频链接](${url})`;
  }
}

export function VideoEmbedDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [url, setUrl] = React.useState("");

  React.useEffect(() => {
    if (open) setUrl("");
  }, [open]);

  const parsed = url ? parseUrl(url) : null;

  const insert = () => {
    if (!url) return;
    insertAtCursor("\n\n" + buildEmbed(url) + "\n\n");
    onOpenChange(false);
  };

  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      title={
        <span className="flex items-center gap-2">
          <Video size={14} /> 视频嵌入
        </span>
      }
      description="支持 YouTube / Bilibili / Vimeo / 直链 .mp4"
    >
      <div className="p-5 space-y-3">
        <label className="block">
          <span className="text-[10px] uppercase tracking-wider text-app-fg-subtle">
            视频链接
          </span>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=... 或 https://www.bilibili.com/video/BVxxx"
            className="mt-1 w-full h-9 px-2.5 rounded-md border border-app-border bg-app-bg text-sm font-mono placeholder:text-app-fg-subtle focus:outline-none focus:border-app-fg-muted"
          />
        </label>
        {parsed && parsed.provider !== "unknown" && (
          <div className="text-[11px] text-emerald-700 dark:text-emerald-400">
            ✓ 识别为 {parsed.provider}
            {parsed.id ? ` · ID: ${parsed.id}` : ""}
          </div>
        )}
        {parsed && parsed.provider === "unknown" && (
          <div className="text-[11px] text-amber-700 dark:text-amber-400">
            ⚠ 未识别 provider — 将插入为普通链接
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={insert} disabled={!url}>
            插入
          </Button>
        </div>
        <p className="text-[11px] text-app-fg-muted leading-relaxed pt-2 border-t border-app-border">
          注意：微信公众号不支持 iframe。导出公众号 HTML 时会自动降级为带封面图的链接卡片。
        </p>
      </div>
    </AppDialog>
  );
}
