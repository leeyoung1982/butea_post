"use client";

import {
  Decoration,
  EditorView,
  WidgetType,
  type DecorationSet,
} from "@codemirror/view";
import {
  RangeSetBuilder,
  StateEffect,
  StateField,
  type EditorState,
  type Extension,
} from "@codemirror/state";
import { resolveBlobUrl, MEDIA_URL_PREFIX } from "@/lib/media/store";
import { getEditorView } from "@/lib/editor-ref";
import { clamp, escapeHtml } from "@/lib/utils";

const MIN_SIZE = 40;

const ICON_ALIGN_LEFT =
  '<line x1="21" y1="10" x2="3" y2="10"/><line x1="17" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="17" y1="18" x2="3" y2="18"/>';
const ICON_ALIGN_CENTER =
  '<line x1="21" y1="10" x2="3" y2="10"/><line x1="18" y1="6" x2="6" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="18" y1="18" x2="6" y2="18"/>';
const ICON_ALIGN_RIGHT =
  '<line x1="21" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="7" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="21" y1="18" x2="7" y2="18"/>';
const ICON_STRETCH =
  '<rect width="20" height="6" x="2" y="4" rx="2"/><rect width="20" height="6" x="2" y="14" rx="2"/>';
const ICON_ROTATE_CCW =
  '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>';

function svgInner(paths: string, size = 13): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
}

// Per-id version map — bumped after `updateMediaInPlace` so the widget's
// eq() check fails and CM rebuilds with the new blob bytes (the URL
// string is unchanged).
const mediaVersion = new Map<string, number>();
function getMediaVersion(id: string): number {
  return mediaVersion.get(id) ?? 0;
}
export function bumpMediaVersion(id: string): void {
  mediaVersion.set(id, getMediaVersion(id) + 1);
}

export const refreshImagePreviews = StateEffect.define<void>();

/**
 * Image rendering state.
 *   imgW × imgH   — underlying image at its current display scale
 *   viewW × viewH — visible crop window (≤ image size)
 *   offX, offY    — px the image is shifted up/left inside the window
 *   align         — left/center/right/full or null (inline default)
 */
export type AlignMode = "left" | "center" | "right" | "full" | null;

type ImageInfo = {
  url: string;
  alt: string;
  imgW: number | null;
  imgH: number | null;
  viewW: number | null;
  viewH: number | null;
  offX: number;
  offY: number;
  align: AlignMode;
};

type ImageMatch = ImageInfo & {
  index: number;
  length: number;
};

function parseAlign(style: string): AlignMode {
  if (!style) return null;
  if (/\bwidth\s*:\s*100\s*%/i.test(style) && /\bheight\s*:\s*auto/i.test(style)) {
    return "full";
  }
  const ml = /\bmargin-left\s*:\s*auto/i.test(style);
  const mr = /\bmargin-right\s*:\s*auto/i.test(style);
  if (ml && mr) return "center";
  if (ml) return "right";
  if (mr) return "left";
  // Backwards compat with the old float-based encoding
  if (/\bfloat\s*:\s*left/i.test(style)) return "left";
  if (/\bfloat\s*:\s*right/i.test(style)) return "right";
  return null;
}

function alignStyles(align: AlignMode): string {
  switch (align) {
    case "left":
      return "display:block;margin-left:0;margin-right:auto;";
    case "center":
      return "display:block;margin-left:auto;margin-right:auto;";
    case "right":
      return "display:block;margin-left:auto;margin-right:0;";
    default:
      return "";
  }
}

const MD_IMG_RE = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const SPAN_CROP_RE =
  /<span\s+class\s*=\s*["']butea-crop["'][\s\S]*?<\/span>/gi;
const HTML_IMG_RE = /<img\b[^>]*?\/?>/gi;

function getAttr(tag: string, name: string): string | null {
  const re = new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, "i");
  return re.exec(tag)?.[1] ?? null;
}

function getStylePx(style: string, prop: string): number | null {
  const re = new RegExp(`\\b${prop}\\s*:\\s*(-?\\d+(?:\\.\\d+)?)px`, "i");
  const m = re.exec(style);
  return m ? Number(m[1]) : null;
}

function parseImgAttrs(tag: string): { url: string; alt: string; w: number | null; h: number | null; ox: number; oy: number } | null {
  const src = getAttr(tag, "src");
  if (!src) return null;
  const alt = getAttr(tag, "alt") ?? "";
  const wAttr = getAttr(tag, "width");
  const hAttr = getAttr(tag, "height");
  const style = getAttr(tag, "style") ?? "";
  const w = wAttr ? Number(wAttr) : getStylePx(style, "width");
  const h = hAttr ? Number(hAttr) : getStylePx(style, "height");
  const ml =
    getStylePx(style, "margin-left") ??
    (function () {
      const m = /\bmargin\s*:\s*(-?\d+(?:\.\d+)?)px\s+\S+\s+\S+\s+(-?\d+(?:\.\d+)?)px/.exec(style);
      return m ? Number(m[2]) : null;
    })();
  const mt =
    getStylePx(style, "margin-top") ??
    (function () {
      const m = /\bmargin\s*:\s*(-?\d+(?:\.\d+)?)px/.exec(style);
      return m ? Number(m[1]) : null;
    })();
  return {
    url: src,
    alt,
    w,
    h,
    ox: ml != null ? -ml : 0,
    oy: mt != null ? -mt : 0,
  };
}

function findAllImages(text: string): ImageMatch[] {
  const out: ImageMatch[] = [];
  const spanRanges: [number, number][] = [];

  let m: RegExpExecArray | null;
  SPAN_CROP_RE.lastIndex = 0;
  while ((m = SPAN_CROP_RE.exec(text)) !== null) {
    const fullMatch = m[0];
    const start = m.index;
    const end = start + fullMatch.length;
    spanRanges.push([start, end]);

    const spanStyle = getAttr(fullMatch.slice(0, fullMatch.indexOf(">") + 1), "style") ?? "";
    const viewW = getStylePx(spanStyle, "width");
    const viewH = getStylePx(spanStyle, "height");

    const innerImgRe = /<img\b[^>]*?\/?>/i;
    const innerMatch = innerImgRe.exec(fullMatch);
    if (!innerMatch) continue;
    const inner = parseImgAttrs(innerMatch[0]);
    if (!inner) continue;

    out.push({
      index: start,
      length: fullMatch.length,
      url: inner.url,
      alt: inner.alt,
      imgW: inner.w,
      imgH: inner.h,
      viewW,
      viewH,
      offX: inner.ox,
      offY: inner.oy,
      align: parseAlign(spanStyle),
    });
  }

  MD_IMG_RE.lastIndex = 0;
  while ((m = MD_IMG_RE.exec(text)) !== null) {
    out.push({
      index: m.index,
      length: m[0].length,
      url: m[2],
      alt: m[1],
      imgW: null,
      imgH: null,
      viewW: null,
      viewH: null,
      offX: 0,
      offY: 0,
      align: null,
    });
  }

  HTML_IMG_RE.lastIndex = 0;
  while ((m = HTML_IMG_RE.exec(text)) !== null) {
    const start = m.index;
    if (spanRanges.some(([a, b]) => start >= a && start < b)) continue;
    const inner = parseImgAttrs(m[0]);
    if (!inner) continue;
    const imgStyle = getAttr(m[0], "style") ?? "";
    const align = parseAlign(imgStyle);
    const isFullMode = align === "full";
    out.push({
      index: start,
      length: m[0].length,
      url: inner.url,
      alt: inner.alt,
      imgW: isFullMode ? null : inner.w,
      imgH: isFullMode ? null : inner.h,
      viewW: isFullMode ? null : inner.w,
      viewH: isFullMode ? null : inner.h,
      offX: 0,
      offY: 0,
      align,
    });
  }

  out.sort((a, b) => a.index - b.index);
  return out;
}

type HandleDir = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

const HANDLE_LAYOUT: { dir: HandleDir; cursor: string; style: Record<string, string> }[] = [
  { dir: "nw", cursor: "nwse-resize", style: { left: "-4px", top: "-4px" } },
  { dir: "n",  cursor: "ns-resize",   style: { left: "calc(50% - 4px)", top: "-4px" } },
  { dir: "ne", cursor: "nesw-resize", style: { right: "-4px", top: "-4px" } },
  { dir: "e",  cursor: "ew-resize",   style: { right: "-4px", top: "calc(50% - 4px)" } },
  { dir: "se", cursor: "nwse-resize", style: { right: "-4px", bottom: "-4px" } },
  { dir: "s",  cursor: "ns-resize",   style: { left: "calc(50% - 4px)", bottom: "-4px" } },
  { dir: "sw", cursor: "nesw-resize", style: { left: "-4px", bottom: "-4px" } },
  { dir: "w",  cursor: "ew-resize",   style: { left: "-4px", top: "calc(50% - 4px)" } },
];

class ResizableImageWidget extends WidgetType {
  constructor(readonly info: ImageInfo, readonly version: number) {
    super();
  }

  eq(other: ResizableImageWidget): boolean {
    const a = this.info;
    const b = other.info;
    return (
      a.url === b.url &&
      a.alt === b.alt &&
      a.imgW === b.imgW &&
      a.imgH === b.imgH &&
      a.viewW === b.viewW &&
      a.viewH === b.viewH &&
      a.offX === b.offX &&
      a.offY === b.offY &&
      a.align === b.align &&
      this.version === other.version
    );
  }

  toDOM(): HTMLElement {
    const { info } = this;
    const wrap = document.createElement("div");
    wrap.setAttribute("aria-hidden", "true");
    wrap.className = "cm-butea-img-preview";

    const textAlign =
      info.align === "center" ? "center" : info.align === "right" ? "right" : "left";
    wrap.style.cssText = `padding:4px 0 8px 0;max-width:100%;text-align:${textAlign};`;

    const isFull = info.align === "full";
    const cropped =
      !isFull &&
      (info.offX > 0 ||
        info.offY > 0 ||
        (info.viewW != null && info.imgW != null && info.viewW !== info.imgW) ||
        (info.viewH != null && info.imgH != null && info.viewH !== info.imgH));

    // Container: positioning context for ALL overlay controls (toolbar,
    // handles, size badge). Sized to wrap the frame. Critical that this
    // does NOT have overflow:hidden — otherwise the toolbar gets clipped
    // when the image is smaller than the toolbar's width.
    const container = document.createElement("div");
    const containerStyles = ["position:relative", "max-width:100%"];
    if (isFull) {
      containerStyles.push("display:block", "width:100%");
    } else {
      containerStyles.push("display:inline-block");
    }
    container.style.cssText = containerStyles.join(";");

    // Frame: the image clip box. ALWAYS overflow:hidden — for non-cropped
    // images img fills frame exactly so there's nothing to clip; for
    // cropped images img extends beyond and the overflow is clipped.
    const frame = document.createElement("div");
    const frameStyles = [
      "position:relative",
      "overflow:hidden",
      "line-height:0",
      "background:var(--app-bg,transparent)",
      "border:1px solid var(--app-border,rgba(0,0,0,0.1))",
      "border-radius:2px",
      "max-width:100%",
      "display:block",
    ];
    if (isFull) {
      frameStyles.push("width:100%");
    } else if (cropped) {
      if (info.viewW != null) frameStyles.push(`width:${info.viewW}px`);
      if (info.viewH != null) frameStyles.push(`height:${info.viewH}px`);
    }
    frame.style.cssText = frameStyles.join(";");

    const img = document.createElement("img");
    img.alt = info.alt;
    img.draggable = false;
    img.loading = "lazy";
    img.style.cssText = "display:block;user-select:none;";
    if (isFull) {
      img.style.width = "100%";
      img.style.height = "auto";
    } else {
      if (info.imgW != null) img.style.width = info.imgW + "px";
      if (info.imgH != null) img.style.height = info.imgH + "px";
      if (cropped) {
        img.style.marginLeft = `-${info.offX}px`;
        img.style.marginTop = `-${info.offY}px`;
      }
      if (info.imgW == null && info.imgH == null) {
        img.style.maxHeight = "260px";
        img.style.maxWidth = "100%";
      }
    }

    const localId = info.url.startsWith(MEDIA_URL_PREFIX)
      ? info.url.slice(MEDIA_URL_PREFIX.length)
      : null;
    if (localId) {
      resolveBlobUrl(localId).then((u) => {
        if (u) img.src = u;
        else frame.replaceChildren(missingNote(info.url));
      });
    } else {
      img.src = info.url;
    }
    img.onerror = () => frame.replaceChildren(missingNote(info.url));

    frame.appendChild(img);
    container.appendChild(frame);

    // All overlays go in container, NOT in frame, so overflow:hidden
    // doesn't clip them. Positioned absolutely against container which
    // sizes to wrap the frame.
    const handleEls = this.createHandles(container, img, frame);
    const badge = createSizeBadge(container, img, frame);
    const toolbar = this.createAlignToolbar(container);

    // Unified hover: all overlays appear/hide together when hovering
    // anywhere over the container
    const overlays = [...handleEls, badge, toolbar];
    container.addEventListener("mouseenter", () => {
      for (const el of overlays) el.style.opacity = "1";
    });
    container.addEventListener("mouseleave", () => {
      for (const el of overlays) el.style.opacity = "0";
    });

    wrap.appendChild(container);
    return wrap;
  }

  ignoreEvent(): boolean {
    return true;
  }

  private createHandles(
    container: HTMLElement,
    img: HTMLImageElement,
    frame: HTMLElement
  ): HTMLElement[] {
    const handleEls: HTMLElement[] = [];
    for (const layout of HANDLE_LAYOUT) {
      const el = document.createElement("div");
      el.className = "cm-butea-img-handle";
      el.dataset.dir = layout.dir;
      el.style.cssText = [
        "position:absolute",
        "width:10px",
        "height:10px",
        "background:#ea580c",
        "border:2px solid #fff",
        "border-radius:3px",
        "box-shadow:0 0 3px rgba(0,0,0,0.5)",
        "opacity:0",
        "transition:opacity .15s",
        "z-index:4",
        `cursor:${layout.cursor}`,
      ].join(";");
      Object.assign(el.style, layout.style);
      el.addEventListener("pointerdown", (e) =>
        this.startDrag(e, layout.dir, img, frame)
      );
      container.appendChild(el);
      handleEls.push(el);
    }
    return handleEls;
  }

  private createAlignToolbar(container: HTMLElement): HTMLElement {
    const bar = document.createElement("div");
    bar.style.cssText = [
      "position:absolute",
      "top:8px",
      "left:50%",
      "transform:translateX(-50%)",
      "display:flex",
      "align-items:center",
      "gap:2px",
      "padding:3px",
      "background:rgba(20,20,20,0.92)",
      "border:1px solid rgba(255,255,255,0.14)",
      "border-radius:6px",
      "opacity:0",
      "transition:opacity .15s",
      "z-index:5",
      "backdrop-filter:blur(8px)",
      "-webkit-backdrop-filter:blur(8px)",
      "box-shadow:0 2px 12px rgba(0,0,0,0.4)",
    ].join(";");
    bar.addEventListener("mousedown", (e) => e.preventDefault());

    const items: { id: Exclude<AlignMode, null>; icon: string; title: string }[] = [
      { id: "left", icon: ICON_ALIGN_LEFT, title: "靠左对齐" },
      { id: "center", icon: ICON_ALIGN_CENTER, title: "水平居中" },
      { id: "right", icon: ICON_ALIGN_RIGHT, title: "靠右对齐" },
      { id: "full", icon: ICON_STRETCH, title: "撑满容器宽度(会重置尺寸/裁切)" },
    ];

    const setBtnStyle = (b: HTMLButtonElement, active: boolean) => {
      const bg = active ? "#ea580c" : "rgba(255,255,255,0.07)";
      const border = active ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.1)";
      b.style.cssText = [
        "display:inline-flex",
        "align-items:center",
        "justify-content:center",
        "width:26px",
        "height:24px",
        "padding:0",
        "color:#fff",
        `background:${bg}`,
        `border:1px solid ${border}`,
        "cursor:pointer",
        "border-radius:4px",
        "transition:background .12s,border-color .12s",
        "user-select:none",
      ].join(";");
    };

    const makeBtn = (svgPaths: string, title: string, active: boolean) => {
      const b = document.createElement("button");
      b.type = "button";
      b.title = title;
      b.innerHTML = svgInner(svgPaths);
      setBtnStyle(b, active);
      if (!active) {
        b.addEventListener("mouseenter", () => {
          b.style.background = "rgba(255,255,255,0.18)";
          b.style.borderColor = "rgba(255,255,255,0.22)";
        });
        b.addEventListener("mouseleave", () => {
          b.style.background = "rgba(255,255,255,0.07)";
          b.style.borderColor = "rgba(255,255,255,0.1)";
        });
      }
      return b;
    };

    for (const item of items) {
      const isActive = this.info.align === item.id;
      const btn = makeBtn(item.icon, item.title, isActive);
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const next: AlignMode = isActive ? null : item.id;
        writeBackAlign(container, this.info, next);
      });
      bar.appendChild(btn);
    }

    const sep = document.createElement("div");
    sep.style.cssText =
      "width:1px;height:18px;background:rgba(255,255,255,0.2);margin:0 3px;";
    bar.appendChild(sep);

    const resetBtn = makeBtn(ICON_ROTATE_CCW, "重置:清除尺寸/裁切/对齐", false);
    resetBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      writeBackAlign(container, this.info, null, true);
    });
    bar.appendChild(resetBtn);

    container.appendChild(bar);
    return bar;
  }

  private startDrag(
    e: PointerEvent,
    dir: HandleDir,
    img: HTMLImageElement,
    frame: HTMLElement
  ) {
    e.preventDefault();
    e.stopPropagation();
    const handle = e.currentTarget as HTMLElement;
    try {
      handle.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    const startImgW = img.offsetWidth;
    const startImgH = img.offsetHeight;
    const startViewW = frame.offsetWidth;
    const startViewH = frame.offsetHeight;
    const startOffX = this.info.offX;
    const startOffY = this.info.offY;
    if (startImgW < MIN_SIZE || startImgH < MIN_SIZE) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const isCorner = dir.length === 2;
    const wMul = dir.includes("e") ? 1 : dir.includes("w") ? -1 : 0;
    const hMul = dir.includes("s") ? 1 : dir.includes("n") ? -1 : 0;

    let curImgW = startImgW;
    let curImgH = startImgH;
    let curViewW = startViewW;
    let curViewH = startViewH;
    let curOffX = startOffX;
    let curOffY = startOffY;

    // Defer state mutations until the first actual move so a stray click
    // on a handle doesn't change anything. On first move we also clear the
    // img's max-* constraints — the natural-state CSS that would otherwise
    // squash the image to the frame width while we're trying to crop.
    let firstMove = true;
    const prepareForDrag = () => {
      // Lock the image to its currently rendered size and remove any
      // natural-state max constraints that would interfere with cropping.
      img.style.maxWidth = "none";
      img.style.maxHeight = "none";
      img.style.width = startImgW + "px";
      img.style.height = startImgH + "px";
      // The frame is always overflow:hidden now (set in toDOM), so we
      // just need explicit dimensions.
      frame.style.width = startViewW + "px";
      frame.style.height = startViewH + "px";
    };

    const apply = () => {
      img.style.width = curImgW + "px";
      img.style.height = curImgH + "px";
      img.style.marginLeft = `-${curOffX}px`;
      img.style.marginTop = `-${curOffY}px`;
      frame.style.width = curViewW + "px";
      frame.style.height = curViewH + "px";
      const badgeRefresh = (frame as HTMLElement & {
        _butReadSize?: () => void;
      })._butReadSize;
      badgeRefresh?.();
    };

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;

      if (firstMove) {
        firstMove = false;
        prepareForDrag();
      }

      if (isCorner) {
        // Dominant-axis scaling — handle tracks whichever axis the cursor
        // moved more on. Preserves aspect ratio.
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);
        const rawScale =
          absDx >= absDy
            ? (startViewW + dx * wMul) / startViewW
            : (startViewH + dy * hMul) / startViewH;
        const minScale = MIN_SIZE / Math.min(startViewW, startViewH);
        const scale = Math.max(rawScale, minScale);
        curImgW = startImgW * scale;
        curImgH = startImgH * scale;
        curViewW = startViewW * scale;
        curViewH = startViewH * scale;
        curOffX = startOffX * scale;
        curOffY = startOffY * scale;
      } else {
        // Edge = crop. Image dimensions stay; only the visible window and
        // (for left/top edges) the offset change.
        curImgW = startImgW;
        curImgH = startImgH;
        if (wMul === 1) {
          curViewW = clamp(startViewW + dx, MIN_SIZE, startImgW - startOffX);
          curOffX = startOffX;
        } else if (wMul === -1) {
          const upper = startOffX + startViewW - MIN_SIZE;
          curOffX = clamp(startOffX + dx, 0, upper);
          curViewW = startViewW - (curOffX - startOffX);
        } else {
          curViewW = startViewW;
          curOffX = startOffX;
        }
        if (hMul === 1) {
          curViewH = clamp(startViewH + dy, MIN_SIZE, startImgH - startOffY);
          curOffY = startOffY;
        } else if (hMul === -1) {
          const upper = startOffY + startViewH - MIN_SIZE;
          curOffY = clamp(startOffY + dy, 0, upper);
          curViewH = startViewH - (curOffY - startOffY);
        } else {
          curViewH = startViewH;
          curOffY = startOffY;
        }
      }
      apply();
    };

    const onUp = (ev: PointerEvent) => {
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      handle.removeEventListener("pointercancel", onUp);
      try {
        handle.releasePointerCapture(ev.pointerId);
      } catch {
        // ignore
      }
      if (firstMove) return; // no actual movement
      if (
        Math.abs(curImgW - startImgW) < 1 &&
        Math.abs(curImgH - startImgH) < 1 &&
        Math.abs(curViewW - startViewW) < 1 &&
        Math.abs(curViewH - startViewH) < 1 &&
        Math.abs(curOffX - startOffX) < 1 &&
        Math.abs(curOffY - startOffY) < 1
      ) {
        return;
      }
      writeBackState({
        widgetDOM: frame,
        url: this.info.url,
        alt: this.info.alt,
        imgW: Math.round(curImgW),
        imgH: Math.round(curImgH),
        viewW: Math.round(curViewW),
        viewH: Math.round(curViewH),
        offX: Math.round(curOffX),
        offY: Math.round(curOffY),
        align: this.info.align,
      });
    };

    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onUp);
  }
}

function createSizeBadge(
  container: HTMLElement,
  img: HTMLImageElement,
  frame: HTMLElement
): HTMLElement {
  const badge = document.createElement("div");
  badge.style.cssText = [
    "position:absolute",
    "left:6px",
    "bottom:6px",
    "padding:2px 6px",
    "font-size:10px",
    "font-family:ui-monospace,monospace",
    "color:#fff",
    "background:rgba(0,0,0,0.6)",
    "border-radius:3px",
    "opacity:0",
    "transition:opacity .15s",
    "pointer-events:none",
    "z-index:3",
  ].join(";");
  container.appendChild(badge);
  const refresh = () => {
    const imgW = img.offsetWidth;
    const imgH = img.offsetHeight;
    const viewW = frame.offsetWidth;
    const viewH = frame.offsetHeight;
    if (Math.abs(imgW - viewW) < 1 && Math.abs(imgH - viewH) < 1) {
      badge.textContent = `${Math.round(viewW)} × ${Math.round(viewH)}`;
    } else {
      badge.textContent = `${Math.round(viewW)} × ${Math.round(viewH)} (从 ${Math.round(imgW)} × ${Math.round(imgH)} 裁切)`;
    }
  };
  img.addEventListener("load", refresh);
  refresh();
  (frame as HTMLElement & { _butReadSize?: () => void })._butReadSize = refresh;
  return badge;
}

function missingNote(url: string): HTMLElement {
  const el = document.createElement("div");
  el.textContent = `(图片无法加载：${url})`;
  el.style.cssText = [
    "font-size: 11px",
    "color: var(--app-fg-muted, #888)",
    "padding: 6px 10px",
    "border: 1px dashed var(--app-border, rgba(0,0,0,0.15))",
    "border-radius: 4px",
    "background: var(--app-bg, transparent)",
  ].join(";");
  return el;
}

export function buildImageMarkdown(opts: {
  url: string;
  alt: string;
  imgW: number | null;
  imgH: number | null;
  viewW: number | null;
  viewH: number | null;
  offX: number;
  offY: number;
  align: AlignMode;
}): string {
  const safeAlt = escapeHtml(opts.alt);

  if (opts.align === "full") {
    return `<img src="${opts.url}" alt="${safeAlt}" style="display:block;width:100%;height:auto;" />`;
  }

  const hasSize = opts.imgW != null && opts.imgH != null;
  const isCropped =
    hasSize &&
    opts.viewW != null &&
    opts.viewH != null &&
    (opts.viewW !== opts.imgW ||
      opts.viewH !== opts.imgH ||
      opts.offX > 0 ||
      opts.offY > 0);
  const align = alignStyles(opts.align);

  if (!hasSize && !isCropped && !align) {
    return `![${opts.alt}](${opts.url})`;
  }

  if (!isCropped) {
    let attrs = `src="${opts.url}" alt="${safeAlt}"`;
    if (opts.imgW != null) attrs += ` width="${opts.imgW}"`;
    if (opts.imgH != null) attrs += ` height="${opts.imgH}"`;
    if (align) attrs += ` style="${align}"`;
    return `<img ${attrs} />`;
  }

  const spanStyle =
    `display:inline-block;overflow:hidden;vertical-align:middle;` +
    `width:${opts.viewW}px;height:${opts.viewH}px;${align}`;
  const imgStyle =
    `display:block;width:${opts.imgW}px;height:${opts.imgH}px;` +
    `margin:-${opts.offY}px 0 0 -${opts.offX}px;`;
  return (
    `<span class="butea-crop" style="${spanStyle}">` +
    `<img src="${opts.url}" alt="${safeAlt}" style="${imgStyle}" />` +
    `</span>`
  );
}

function writeBackState(opts: {
  widgetDOM: HTMLElement;
  url: string;
  alt: string;
  imgW: number;
  imgH: number;
  viewW: number;
  viewH: number;
  offX: number;
  offY: number;
  align: AlignMode;
}) {
  const view = getEditorView();
  if (!view) return;
  let widgetPos: number;
  try {
    widgetPos = view.posAtDOM(opts.widgetDOM);
  } catch {
    return;
  }
  const checkPos = Math.max(0, widgetPos - 1);
  const line = view.state.doc.lineAt(checkPos);
  const matches = findAllImages(line.text).filter((m) => m.url === opts.url);
  if (matches.length === 0) return;
  const match = matches[0];

  const newSyntax = buildImageMarkdown(opts);
  const newLine =
    line.text.slice(0, match.index) +
    newSyntax +
    line.text.slice(match.index + match.length);
  view.dispatch({
    changes: { from: line.from, to: line.to, insert: newLine },
  });
}

function writeBackAlign(
  widgetDOM: HTMLElement,
  current: ImageInfo,
  newAlign: AlignMode,
  reset = false
) {
  const view = getEditorView();
  if (!view) return;
  let widgetPos: number;
  try {
    widgetPos = view.posAtDOM(widgetDOM);
  } catch {
    return;
  }
  const checkPos = Math.max(0, widgetPos - 1);
  const line = view.state.doc.lineAt(checkPos);
  const matches = findAllImages(line.text).filter((m) => m.url === current.url);
  if (matches.length === 0) return;
  const match = matches[0];

  const newInfo: Parameters<typeof buildImageMarkdown>[0] = reset
    ? {
        url: current.url,
        alt: current.alt,
        imgW: null,
        imgH: null,
        viewW: null,
        viewH: null,
        offX: 0,
        offY: 0,
        align: null,
      }
    : {
        url: current.url,
        alt: current.alt,
        imgW: current.imgW,
        imgH: current.imgH,
        viewW: current.viewW,
        viewH: current.viewH,
        offX: current.offX,
        offY: current.offY,
        align: newAlign,
      };

  const newSyntax = buildImageMarkdown(newInfo);
  const newLine =
    line.text.slice(0, match.index) +
    newSyntax +
    line.text.slice(match.index + match.length);
  view.dispatch({
    changes: { from: line.from, to: line.to, insert: newLine },
  });
}

function computeDecorations(state: EditorState): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const text = state.doc.toString();
  const matches = findAllImages(text);
  for (const m of matches) {
    const line = state.doc.lineAt(m.index + m.length);
    const id = m.url.startsWith(MEDIA_URL_PREFIX)
      ? m.url.slice(MEDIA_URL_PREFIX.length)
      : null;
    const version = id ? getMediaVersion(id) : 0;
    builder.add(
      line.to,
      line.to,
      Decoration.widget({
        widget: new ResizableImageWidget(m, version),
        side: 1,
        block: true,
      })
    );
  }
  return builder.finish();
}

export const imagePreviewExtension: Extension = StateField.define<DecorationSet>({
  create(state) {
    return computeDecorations(state);
  },
  update(deco, tr) {
    if (tr.docChanged) return computeDecorations(tr.state);
    for (const effect of tr.effects) {
      if (effect.is(refreshImagePreviews)) return computeDecorations(tr.state);
    }
    return deco;
  },
  provide: (f) => EditorView.decorations.from(f),
});
