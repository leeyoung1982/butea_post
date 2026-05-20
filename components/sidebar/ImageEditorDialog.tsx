"use client";

import * as React from "react";
import { Scissors } from "lucide-react";
import { AppDialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import {
  getMedia,
  saveMedia,
  updateMediaInPlace,
  type MediaRecord,
} from "@/lib/media/store";
import { toast } from "@/components/ui/toast";
import { clamp } from "@/lib/utils";

type Rect = { x: number; y: number; w: number; h: number };
type DragMode = "move" | "nw" | "ne" | "sw" | "se";

const EDGES: { label: string; value: number }[] = [
  { label: "800", value: 800 },
  { label: "1200", value: 1200 },
  { label: "1920", value: 1920 },
  { label: "原始", value: 0 },
];
const MIN = 16;

function computeOutput(rect: Rect, longest: number) {
  let w = Math.round(rect.w);
  let h = Math.round(rect.h);
  if (longest > 0 && Math.max(w, h) > longest) {
    const s = longest / Math.max(w, h);
    w = Math.round(w * s);
    h = Math.round(h * s);
  }
  return { w, h };
}

export function ImageEditorDialog({
  rec, open, onOpenChange, onSaved, defaultReplace = false,
}: {
  rec: MediaRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void | Promise<void>;
  /** Default "覆盖原图" to true (typical when opened from the markdown
   *  editor — the `butea-media://<id>` reference needs to keep working). */
  defaultReplace?: boolean;
}) {
  const [url, setUrl] = React.useState<string | null>(null);
  const [img, setImg] = React.useState<HTMLImageElement | null>(null);
  const [rect, setRect] = React.useState<Rect | null>(null);
  const [longest, setLongest] = React.useState(1200);
  const [quality, setQuality] = React.useState(85);
  const [replace, setReplace] = React.useState(defaultReplace);
  const [saving, setSaving] = React.useState(false);
  const stageRef = React.useRef<HTMLDivElement>(null);
  const [stage, setStage] = React.useState({ w: 0, h: 0, scale: 1 });
  const dragRef = React.useRef<{ mode: DragMode; sx: number; sy: number; start: Rect } | null>(null);

  React.useEffect(() => {
    if (!open || !rec) return;
    let cancelled = false;
    let created: string | null = null;
    (async () => {
      const fresh = await getMedia(rec.id);
      if (!fresh || cancelled) return;
      const u = URL.createObjectURL(fresh.blob);
      created = u;
      const el = new Image();
      el.onload = () => {
        if (cancelled) return;
        setUrl(u);
        setImg(el);
        setRect({ x: 0, y: 0, w: el.naturalWidth, h: el.naturalHeight });
      };
      el.onerror = () => toast.error("图片加载失败");
      el.src = u;
    })();
    return () => {
      cancelled = true;
      if (created) URL.revokeObjectURL(created);
      setUrl(null); setImg(null); setRect(null); setReplace(defaultReplace);
    };
  }, [open, rec, defaultReplace]);

  React.useLayoutEffect(() => {
    if (!img || !stageRef.current) return;
    const el = stageRef.current;
    const update = () => {
      const scale = Math.min(el.clientWidth / img.naturalWidth, el.clientHeight / img.naturalHeight, 1);
      setStage({ w: img.naturalWidth * scale, h: img.naturalHeight * scale, scale });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [img]);

  const startDrag = (e: React.PointerEvent, mode: DragMode) => {
    if (!rect) return;
    e.stopPropagation(); e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    dragRef.current = { mode, sx: e.clientX, sy: e.clientY, start: { ...rect } };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || !img) return;
    const dx = (e.clientX - d.sx) / stage.scale;
    const dy = (e.clientY - d.sy) / stage.scale;
    const W = img.naturalWidth, H = img.naturalHeight;
    if (d.mode === "move") {
      setRect({
        x: clamp(d.start.x + dx, 0, W - d.start.w),
        y: clamp(d.start.y + dy, 0, H - d.start.h),
        w: d.start.w, h: d.start.h,
      });
      return;
    }
    let x1 = d.start.x, y1 = d.start.y;
    let x2 = d.start.x + d.start.w, y2 = d.start.y + d.start.h;
    if (d.mode === "nw" || d.mode === "sw") x1 = clamp(d.start.x + dx, 0, x2 - MIN);
    if (d.mode === "ne" || d.mode === "se") x2 = clamp(x2 + dx, x1 + MIN, W);
    if (d.mode === "nw" || d.mode === "ne") y1 = clamp(d.start.y + dy, 0, y2 - MIN);
    if (d.mode === "sw" || d.mode === "se") y2 = clamp(y2 + dy, y1 + MIN, H);
    setRect({ x: x1, y: y1, w: x2 - x1, h: y2 - y1 });
  };

  const endDrag = (e: React.PointerEvent) => {
    dragRef.current = null;
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
  };

  const out = rect ? computeOutput(rect, longest) : { w: 0, h: 0 };

  const save = async () => {
    if (!rec || !img || !rect) return;
    setSaving(true);
    try {
      const c = document.createElement("canvas");
      c.width = out.w; c.height = out.h;
      const ctx = c.getContext("2d");
      if (!ctx) throw new Error("浏览器不支持 canvas");
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h, 0, 0, out.w, out.h);
      const blob = await new Promise<Blob>((resolve, reject) =>
        c.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("toBlob 返回空"))),
          "image/jpeg", quality / 100
        )
      );
      const stem = rec.name.replace(/\.[^.]+$/, "");
      if (replace) {
        // Overwrite the binary while keeping the same id so existing
        // `butea-media://<id>` references in markdown stay valid. Bump
        // the version + dispatch a refresh effect so the editor's image
        // widget rebuilds with the new pixels.
        await updateMediaInPlace(rec.id, blob, `${stem}.jpg`);
        toast.success("已覆盖原图");
      } else {
        await saveMedia(blob, `${stem}.edited.jpg`);
        toast.success("已保存为新资产");
      }
      await onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error("保存失败", (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (!rec) return null;

  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      title={<span className="flex items-center gap-2"><Scissors size={14} /> 编辑图片</span>}
      description={rec.name}
      className="max-w-3xl"
    >
      <div className="p-4 space-y-3">
        <div
          ref={stageRef}
          className="relative bg-app-bg border border-app-border rounded-md overflow-hidden flex items-center justify-center select-none"
          style={{ height: 380 }}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          {url && img && rect && stage.w > 0 && (
            <div className="relative" style={{ width: stage.w, height: stage.h }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" draggable={false} className="block w-full h-full" />
              <div
                className="absolute cursor-move ring-1 ring-white/90"
                style={{
                  left: rect.x * stage.scale, top: rect.y * stage.scale,
                  width: rect.w * stage.scale, height: rect.h * stage.scale,
                  boxShadow: "0 0 0 9999px rgba(0,0,0,0.5)",
                }}
                onPointerDown={(e) => startDrag(e, "move")}
              >
                {(["nw", "ne", "sw", "se"] as const).map((c) => (
                  <div
                    key={c}
                    onPointerDown={(e) => startDrag(e, c)}
                    className="absolute w-3 h-3 bg-white border border-black/40"
                    style={{
                      left: c.includes("w") ? -6 : undefined,
                      right: c.includes("e") ? -6 : undefined,
                      top: c.startsWith("n") ? -6 : undefined,
                      bottom: c.startsWith("s") ? -6 : undefined,
                      cursor: `${c}-resize`,
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between text-[11px] text-app-fg-muted">
          <div>
            裁剪 {rect ? `${Math.round(rect.w)} × ${Math.round(rect.h)}` : "—"}
            {" → "}输出 {out.w} × {out.h}
          </div>
          <button
            onClick={() => img && setRect({ x: 0, y: 0, w: img.naturalWidth, h: img.naturalHeight })}
            className="text-app-fg-muted hover:text-app-fg underline"
          >
            重置裁剪
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider text-app-fg-subtle w-20">最长边</span>
          <div className="flex gap-1">
            {EDGES.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setLongest(opt.value)}
                className={`px-2.5 h-7 text-xs rounded border transition-colors ${
                  longest === opt.value
                    ? "bg-app-fg text-app-bg border-app-fg"
                    : "border-app-border text-app-fg-muted hover:text-app-fg hover:bg-app-surface-hover"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider text-app-fg-subtle w-20">JPEG 质量</span>
          <input
            type="range" min={60} max={95} step={1}
            value={quality}
            onChange={(e) => setQuality(Number(e.target.value))}
            className="flex-1"
          />
          <span className="text-xs font-mono text-app-fg w-8 text-right">{quality}</span>
        </div>

        <div className="flex items-center justify-between gap-3 pt-2 border-t border-app-border">
          <label className="flex items-center gap-1.5 text-[11px] text-app-fg-muted cursor-pointer">
            <input
              type="checkbox"
              checked={replace}
              onChange={(e) => setReplace(e.target.checked)}
            />
            覆盖原图（已引用的 markdown 会指向新 id）
          </label>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>
              取消
            </Button>
            <Button onClick={save} size="sm" disabled={saving || !rect}>
              {saving ? "保存中…" : "保存"}
            </Button>
          </div>
        </div>
      </div>
    </AppDialog>
  );
}
