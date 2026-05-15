"use client";

import * as React from "react";
import { Image as ImageIcon, Upload, Trash2, Copy, Scissors } from "lucide-react";
import {
  listMedia,
  deleteMedia,
  saveMedia,
  resolveBlobUrl,
  mediaIdToMarkdownUrl,
  type MediaRecord,
} from "@/lib/media/store";
import { insertAtCursor } from "@/lib/editor-ref";
import { toast } from "@/components/ui/toast";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonList } from "@/components/ui/Skeleton";
import { ImageEditorDialog } from "./ImageEditorDialog";

/**
 * 资产 / Assets sidebar panel. Shows every image in the local media library
 * (manual uploads + AI generations + drag-drops all flow through the same
 * IndexedDB store). Click to insert at cursor; trash icon to delete.
 */
export function AssetsPanel() {
  const [items, setItems] = React.useState<MediaRecord[] | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [editing, setEditing] = React.useState<MediaRecord | null>(null);

  const refresh = React.useCallback(async () => {
    const all = await listMedia();
    all.sort((a, b) => b.createdAt - a.createdAt);
    setItems(all);
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("只能上传图片文件");
      return;
    }
    try {
      await saveMedia(file, file.name);
      await refresh();
      toast.success("已加入资产库");
    } catch (err) {
      toast.error("上传失败", (err as Error).message);
    }
  };

  const onInsert = (rec: MediaRecord) => {
    const alt = rec.name.replace(/\.[^.]+$/, "");
    insertAtCursor(`![${alt}](${mediaIdToMarkdownUrl(rec.id)})\n\n`);
    toast.success("已插入到光标位置");
  };

  const onCopyRef = async (rec: MediaRecord) => {
    try {
      await navigator.clipboard.writeText(mediaIdToMarkdownUrl(rec.id));
      toast.success("已复制 butea-media:// 引用");
    } catch (err) {
      toast.error("复制失败", (err as Error).message);
    }
  };

  const onDelete = async (rec: MediaRecord) => {
    if (!confirm(`从资产库删除「${rec.name}」？\n\n注意：仍引用此图片的 markdown 会变成损坏链接。`))
      return;
    await deleteMedia(rec.id);
    await refresh();
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-app-border">
        <div className="text-sm font-medium">资产 / Assets</div>
        <div className="text-[11px] text-app-fg-muted mt-0.5">
          所有上传 · AI 生成 · 拖入的本地图片
        </div>
      </div>

      <div className="px-3 py-2 border-b border-app-border">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded text-xs bg-app-bg border border-app-border text-app-fg-muted hover:text-app-fg hover:bg-app-surface-hover transition-colors"
        >
          <Upload size={11} />
          上传图片
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={onUpload}
          className="hidden"
        />
        <div className="text-[10px] text-app-fg-subtle text-center pt-1">
          图片存浏览器 IndexedDB · 不上传服务器
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {items === null ? (
          <SkeletonList count={4} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<ImageIcon size={18} />}
            title="资产库是空的"
            description="拖图片到编辑器、用 AI 生成插图，或点上方按钮直接上传，图片都会出现在这里。"
            density="compact"
          />
        ) : (
          <ul className="grid grid-cols-2 gap-2 p-2">
            {items.map((rec) => (
              <AssetCard
                key={rec.id}
                rec={rec}
                onInsert={() => onInsert(rec)}
                onCopyRef={() => onCopyRef(rec)}
                onDelete={() => onDelete(rec)}
                onEdit={() => setEditing(rec)}
              />
            ))}
          </ul>
        )}
      </div>

      <ImageEditorDialog
        rec={editing}
        open={editing !== null}
        onOpenChange={(o) => {
          if (!o) setEditing(null);
        }}
        onSaved={refresh}
      />
    </div>
  );
}

function AssetCard({
  rec,
  onInsert,
  onCopyRef,
  onDelete,
  onEdit,
}: {
  rec: MediaRecord;
  onInsert: () => void;
  onCopyRef: () => void;
  onDelete: () => void;
  onEdit: () => void;
}) {
  const [url, setUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    resolveBlobUrl(rec.id).then((u) => {
      if (!cancelled) setUrl(u);
    });
    return () => {
      cancelled = true;
    };
  }, [rec.id]);

  return (
    <li
      className="group relative rounded-md border border-app-border bg-app-bg overflow-hidden"
      draggable
      onDragStart={(e) => {
        // Native HTML5 DnD payload — the editors listen for this MIME and
        // insert `![alt](butea-media://id)` at the drop position.
        e.dataTransfer.setData("application/x-butea-media", rec.id);
        // Fallback for any consumer that just reads text/plain
        const alt = rec.name.replace(/\.[^.]+$/, "");
        e.dataTransfer.setData(
          "text/plain",
          `![${alt}](butea-media://${rec.id})`
        );
        e.dataTransfer.effectAllowed = "copy";
      }}
    >
      <button
        onClick={onInsert}
        className="w-full aspect-square flex items-center justify-center bg-app-surface-hover overflow-hidden"
        title="点击插入到光标 · 拖拽到编辑器也可"
      >
        {url ? (
          <img
            src={url}
            alt={rec.name}
            className="w-full h-full object-cover pointer-events-none"
            loading="lazy"
            draggable={false}
          />
        ) : (
          <ImageIcon size={20} className="text-app-fg-subtle" />
        )}
      </button>
      <div className="px-2 py-1.5">
        <div className="text-[10px] text-app-fg truncate" title={rec.name}>
          {rec.name}
        </div>
        <div className="text-[9px] text-app-fg-subtle">
          {formatSize(rec.size)} · {relativeTime(rec.createdAt)}
        </div>
      </div>
      <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <IconBtn onClick={onEdit} title="编辑 / 裁剪">
          <Scissors size={10} />
        </IconBtn>
        <IconBtn onClick={onCopyRef} title="复制 markdown 引用">
          <Copy size={10} />
        </IconBtn>
        <IconBtn onClick={onDelete} title="删除" danger>
          <Trash2 size={10} />
        </IconBtn>
      </div>
    </li>
  );
}

function IconBtn({
  children,
  onClick,
  title,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  danger?: boolean;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={title}
      className={`p-1 rounded bg-app-surface/90 backdrop-blur text-app-fg-muted hover:text-app-fg ${
        danger ? "hover:text-red-600" : ""
      }`}
    >
      {children}
    </button>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return "刚刚";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  return `${Math.floor(diff / 86_400_000)}d`;
}
