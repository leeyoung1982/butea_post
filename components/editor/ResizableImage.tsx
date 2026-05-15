"use client";

import * as React from "react";
import Image from "@tiptap/extension-image";
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";
import { defaultMarkdownSerializer } from "prosemirror-markdown";
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  StretchHorizontal,
  RotateCcw,
} from "lucide-react";
import { clamp, escapeHtml } from "@/lib/utils";

/**
 * Drop-in replacement for `@tiptap/extension-image` with:
 *   1. width/height/imgWidth/imgHeight/cropX/cropY attributes
 *   2. A React NodeView with 8 drag handles. Corners = uniform scale
 *      (preserves aspect AND any existing crop). Edges = crop pixels off
 *      that side (image content stays at the same scale; the visible
 *      window shrinks).
 *   3. A markdown serializer that emits:
 *        - `![alt](src)` when untouched
 *        - `<img src="..." width="X" height="Y" />` when resized but uncropped
 *        - `<span class="butea-crop">...<img/></span>` when cropped
 *   4. parseHTML rules that read the wrapper span back into attrs
 *
 * The original blob is never modified. Ctrl+Z undoes each drag because
 * TipTap captures the attribute change as a normal transaction.
 */

type HandleDir = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";
type AlignMode = "left" | "center" | "right" | "full" | null;

const MIN_SIZE = 40;

function alignToStyle(align: AlignMode): string {
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

function parseAlignFromStyle(style: string): AlignMode {
  if (!style) return null;
  if (/\bwidth\s*:\s*100\s*%/i.test(style) && /\bheight\s*:\s*auto/i.test(style)) {
    return "full";
  }
  const ml = /\bmargin-left\s*:\s*auto/i.test(style);
  const mr = /\bmargin-right\s*:\s*auto/i.test(style);
  if (ml && mr) return "center";
  if (ml) return "right";
  if (mr) return "left";
  // Backwards compat with the old float encoding
  if (/\bfloat\s*:\s*left/i.test(style)) return "left";
  if (/\bfloat\s*:\s*right/i.test(style)) return "right";
  return null;
}

const HANDLE_LAYOUT: {
  dir: HandleDir;
  cursor: string;
  style: React.CSSProperties;
}[] = [
  { dir: "nw", cursor: "nwse-resize", style: { left: -4, top: -4 } },
  { dir: "n",  cursor: "ns-resize",   style: { left: "calc(50% - 4px)", top: -4 } },
  { dir: "ne", cursor: "nesw-resize", style: { right: -4, top: -4 } },
  { dir: "e",  cursor: "ew-resize",   style: { right: -4, top: "calc(50% - 4px)" } },
  { dir: "se", cursor: "nwse-resize", style: { right: -4, bottom: -4 } },
  { dir: "s",  cursor: "ns-resize",   style: { left: "calc(50% - 4px)", bottom: -4 } },
  { dir: "sw", cursor: "nesw-resize", style: { left: -4, bottom: -4 } },
  { dir: "w",  cursor: "ew-resize",   style: { left: -4, top: "calc(50% - 4px)" } },
];

type ImgAttrs = {
  src: string;
  alt: string | null;
  title: string | null;
  width: number | null;     // visible window width (frame)
  height: number | null;    // visible window height
  imgWidth: number | null;  // underlying image scaled width
  imgHeight: number | null; // underlying image scaled height
  cropX: number;            // px shifted left
  cropY: number;            // px shifted up
  align: AlignMode;         // null/left/center/right/full
};

function ResizableImageView({ node, updateAttributes, selected }: NodeViewProps) {
  const imgRef = React.useRef<HTMLImageElement>(null);
  const frameRef = React.useRef<HTMLSpanElement>(null);
  const badgeRef = React.useRef<HTMLSpanElement>(null);
  const [hovering, setHovering] = React.useState(false);
  const attrs = node.attrs as ImgAttrs;

  const showHandles = hovering || selected;

  const isCropped =
    (attrs.width != null &&
      attrs.imgWidth != null &&
      attrs.width !== attrs.imgWidth) ||
    (attrs.height != null &&
      attrs.imgHeight != null &&
      attrs.height !== attrs.imgHeight) ||
    attrs.cropX > 0 ||
    attrs.cropY > 0;

  const startDrag = (e: React.PointerEvent<HTMLSpanElement>, dir: HandleDir) => {
    e.preventDefault();
    e.stopPropagation();
    const handle = e.currentTarget;
    try {
      handle.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    const img = imgRef.current;
    const frame = frameRef.current;
    if (!img || !frame) return;

    const startImgW = img.offsetWidth;
    const startImgH = img.offsetHeight;
    const startViewW = frame.offsetWidth;
    const startViewH = frame.offsetHeight;
    const startOffX = attrs.cropX;
    const startOffY = attrs.cropY;
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

    // Defer state mutation until the first actual move — a stray click
    // on the handle shouldn't mutate anything. On first move we also
    // clear the img's max-* constraints (natural-state CSS would
    // otherwise squash the image while we crop).
    let firstMove = true;
    const prepareForDrag = () => {
      img.style.maxWidth = "none";
      img.style.maxHeight = "none";
      img.style.width = startImgW + "px";
      img.style.height = startImgH + "px";
      frame.style.width = startViewW + "px";
      frame.style.height = startViewH + "px";
      frame.style.overflow = "hidden";
    };

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;

      if (firstMove) {
        firstMove = false;
        prepareForDrag();
      }

      if (isCorner) {
        // Drive uniform scale by whichever axis the cursor moved more
        // (absolute pixel delta). max(sW, sH) felt inconsistent — same
        // drag direction at different corners produced different scaling
        // feedback. Dominant-axis tracking matches standard resize tools.
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
        curImgW = startImgW;
        curImgH = startImgH;
        if (wMul === 1) {
          curViewW = clamp(
            startViewW + dx,
            MIN_SIZE,
            startImgW - startOffX
          );
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
          curViewH = clamp(
            startViewH + dy,
            MIN_SIZE,
            startImgH - startOffY
          );
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

      img.style.width = curImgW + "px";
      img.style.height = curImgH + "px";
      img.style.marginLeft = `-${curOffX}px`;
      img.style.marginTop = `-${curOffY}px`;
      frame.style.width = curViewW + "px";
      frame.style.height = curViewH + "px";
      // Imperative badge update — avoids a full React re-render per pointermove
      const badge = badgeRef.current;
      if (badge) {
        const vw = Math.round(curViewW);
        const vh = Math.round(curViewH);
        const iw = Math.round(curImgW);
        const ih = Math.round(curImgH);
        const cropped = Math.abs(iw - vw) >= 1 || Math.abs(ih - vh) >= 1;
        badge.textContent = cropped
          ? `${vw} × ${vh} (从 ${iw} × ${ih} 裁切)`
          : `${vw} × ${vh}`;
      }
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
      if (firstMove) return;
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
      updateAttributes({
        imgWidth: Math.round(curImgW),
        imgHeight: Math.round(curImgH),
        width: Math.round(curViewW),
        height: Math.round(curViewH),
        cropX: Math.round(curOffX),
        cropY: Math.round(curOffY),
      });
    };

    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onUp);
  };

  const setAlign = (next: AlignMode) => {
    const target: AlignMode = attrs.align === next ? null : next;
    if (target === "full") {
      updateAttributes({
        align: "full",
        width: null,
        height: null,
        imgWidth: null,
        imgHeight: null,
        cropX: 0,
        cropY: 0,
      });
    } else {
      updateAttributes({ align: target });
    }
  };

  const resetAll = () => {
    updateAttributes({
      align: null,
      width: null,
      height: null,
      imgWidth: null,
      imgHeight: null,
      cropX: 0,
      cropY: 0,
    });
  };

  const isFull = attrs.align === "full";

  // Outer wrapper alignment via text-align (same trick as MD widget).
  // Cropping + frame sizing only apply when NOT in full mode.
  let wrapperAlign: "left" | "center" | "right" = "left";
  if (attrs.align === "center") wrapperAlign = "center";
  else if (attrs.align === "right") wrapperAlign = "right";

  return (
    <NodeViewWrapper
      as="span"
      className="butea-resizable-img inline-block"
      style={{
        display: "block",
        textAlign: wrapperAlign,
        width: "100%",
      }}
    >
      {/* Container: positioning context for all overlays. Sized by frame.
          Critical that this is NOT overflow:hidden so the toolbar isn't
          clipped when the image is smaller than the toolbar width. */}
      <span
        className={isFull ? "relative block" : "relative inline-block"}
        style={{
          ...(isFull ? { width: "100%" } : {}),
          maxWidth: "100%",
          verticalAlign: "middle",
        }}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      >
        {/* Frame: the clip box. Always overflow:hidden — when not cropped
            the img fills it exactly so there's nothing to clip. */}
        <span
          ref={frameRef}
          className="relative block"
          style={{
            lineHeight: 0,
            overflow: "hidden",
            border: "1px solid rgba(0,0,0,0.1)",
            borderRadius: 2,
            maxWidth: "100%",
            ...(isFull ? { width: "100%" } : {}),
            ...(!isFull && isCropped && attrs.width != null
              ? { width: `${attrs.width}px` }
              : {}),
            ...(!isFull && isCropped && attrs.height != null
              ? { height: `${attrs.height}px` }
              : {}),
            outline: selected ? "2px solid #ea580c" : undefined,
            outlineOffset: selected ? 0 : undefined,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={attrs.src}
            alt={attrs.alt ?? ""}
            draggable={false}
            style={
              isFull
                ? { display: "block", width: "100%", height: "auto" }
                : {
                    display: "block",
                    ...(attrs.imgWidth != null
                      ? { width: `${attrs.imgWidth}px` }
                      : attrs.width != null
                      ? { width: `${attrs.width}px` }
                      : {}),
                    ...(attrs.imgHeight != null
                      ? { height: `${attrs.imgHeight}px` }
                      : attrs.height != null
                      ? { height: `${attrs.height}px` }
                      : {}),
                    ...(isCropped
                      ? {
                          marginLeft: `-${attrs.cropX || 0}px`,
                          marginTop: `-${attrs.cropY || 0}px`,
                        }
                      : {}),
                    ...(attrs.imgWidth == null && attrs.width == null
                      ? { maxHeight: "260px", maxWidth: "100%" }
                      : {}),
                  }
            }
          />
        </span>

        {/* All overlays are siblings of the frame, inside the container —
            so frame.overflow:hidden doesn't clip them. */}
        {HANDLE_LAYOUT.map((h) => (
          <span
            key={h.dir}
            onPointerDown={(e) => startDrag(e, h.dir)}
            style={{
              position: "absolute",
              width: 10,
              height: 10,
              background: "#ea580c",
              border: "2px solid #fff",
              borderRadius: 3,
              boxShadow: "0 0 3px rgba(0,0,0,0.5)",
              opacity: showHandles ? 1 : 0,
              transition: "opacity 0.15s",
              zIndex: 4,
              cursor: h.cursor,
              ...h.style,
            }}
          />
        ))}
        <span
          ref={badgeRef}
          style={{
            position: "absolute",
            left: 6,
            bottom: 6,
            padding: "2px 6px",
            fontSize: 10,
            fontFamily: "ui-monospace,monospace",
            color: "#fff",
            background: "rgba(0,0,0,0.6)",
            borderRadius: 3,
            pointerEvents: "none",
            zIndex: 3,
            opacity: showHandles ? 1 : 0,
            transition: "opacity 0.15s",
          }}
        >
          {(() => {
            const vw = attrs.width ?? attrs.imgWidth ?? null;
            const vh = attrs.height ?? attrs.imgHeight ?? null;
            const iw = attrs.imgWidth ?? attrs.width ?? null;
            const ih = attrs.imgHeight ?? attrs.height ?? null;
            if (vw == null || vh == null) return "";
            return isCropped && iw != null && ih != null
              ? `${vw} × ${vh} (从 ${iw} × ${ih} 裁切)`
              : `${vw} × ${vh}`;
          })()}
        </span>
        {showHandles && (
          <AlignToolbar align={attrs.align} onPick={setAlign} onReset={resetAll} />
        )}
      </span>
    </NodeViewWrapper>
  );
}

function AlignToolbar({
  align,
  onPick,
  onReset,
}: {
  align: AlignMode;
  onPick: (a: AlignMode) => void;
  onReset: () => void;
}) {
  const items: {
    id: Exclude<AlignMode, null>;
    Icon: React.ComponentType<{ size?: number }>;
    title: string;
  }[] = [
    { id: "left", Icon: AlignLeft, title: "靠左对齐" },
    { id: "center", Icon: AlignCenter, title: "水平居中" },
    { id: "right", Icon: AlignRight, title: "靠右对齐" },
    { id: "full", Icon: StretchHorizontal, title: "撑满容器宽度(会重置尺寸/裁切)" },
  ];
  return (
    <span
      onMouseDown={(e) => e.preventDefault()}
      style={{
        position: "absolute",
        top: 8,
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        alignItems: "center",
        gap: 2,
        padding: 3,
        background: "rgba(20,20,20,0.92)",
        border: "1px solid rgba(255,255,255,0.14)",
        borderRadius: 6,
        zIndex: 5,
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        boxShadow: "0 2px 12px rgba(0,0,0,0.4)",
      }}
    >
      {items.map((it) => (
        <IconBtn
          key={it.id}
          title={it.title}
          active={align === it.id}
          onClick={() => onPick(it.id)}
        >
          <it.Icon size={13} />
        </IconBtn>
      ))}
      <span
        style={{
          width: 1,
          height: 18,
          background: "rgba(255,255,255,0.2)",
          margin: "0 3px",
        }}
      />
      <IconBtn title="重置:清除尺寸/裁切/对齐" active={false} onClick={onReset}>
        <RotateCcw size={13} />
      </IconBtn>
    </span>
  );
}

function IconBtn({
  children,
  title,
  active,
  onClick,
}: {
  children: React.ReactNode;
  title: string;
  active: boolean;
  onClick: () => void;
}) {
  const [hover, setHover] = React.useState(false);
  const bg = active
    ? "#ea580c"
    : hover
    ? "rgba(255,255,255,0.18)"
    : "rgba(255,255,255,0.07)";
  const border = active
    ? "rgba(255,255,255,0.4)"
    : hover
    ? "rgba(255,255,255,0.22)"
    : "rgba(255,255,255,0.1)";
  return (
    <button
      type="button"
      title={title}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 26,
        height: 24,
        padding: 0,
        color: "#fff",
        background: bg,
        border: `1px solid ${border}`,
        cursor: "pointer",
        borderRadius: 4,
        transition: "background .12s, border-color .12s",
        userSelect: "none",
      }}
    >
      {children}
    </button>
  );
}

// =====================================================================
// Markdown serialization
// =====================================================================

type SerializerState = { write: (s: string) => void };
type PMImageNode = { attrs: ImgAttrs };

function buildSerializedMarkdown(attrs: ImgAttrs): string | null {
  const { src, alt, width, height, imgWidth, imgHeight, cropX, cropY, align } = attrs;
  const safeAlt = escapeHtml(alt ?? "");

  // Full-width mode short-circuits — drops size/crop info, stretches to 100%
  if (align === "full") {
    return `<img src="${src}" alt="${safeAlt}" style="display:block;width:100%;height:auto;" />`;
  }

  const hasResize =
    width != null || height != null || imgWidth != null || imgHeight != null;
  const alignStyle = alignToStyle(align ?? null);
  if (!hasResize && !cropX && !cropY && !alignStyle) return null;

  const cropped =
    (width != null && imgWidth != null && width !== imgWidth) ||
    (height != null && imgHeight != null && height !== imgHeight) ||
    cropX > 0 ||
    cropY > 0;

  if (!cropped) {
    let s = `<img src="${src}" alt="${safeAlt}"`;
    if (width != null) s += ` width="${width}"`;
    if (height != null) s += ` height="${height}"`;
    if (alignStyle) s += ` style="${alignStyle}"`;
    s += ` />`;
    return s;
  }

  const spanStyle =
    `display:inline-block;overflow:hidden;vertical-align:middle;` +
    `width:${width ?? imgWidth}px;height:${height ?? imgHeight}px;` +
    alignStyle;
  const imgStyle =
    `display:block;` +
    `width:${imgWidth ?? width}px;height:${imgHeight ?? height}px;` +
    `margin:-${cropY || 0}px 0 0 -${cropX || 0}px;`;
  return (
    `<span class="butea-crop" style="${spanStyle}">` +
    `<img src="${src}" alt="${safeAlt}" style="${imgStyle}" />` +
    `</span>`
  );
}

// =====================================================================
// parseHTML helpers — pull crop info out of the wrapper span when the
// user switches mode or loads from saved markdown
// =====================================================================

function pxFromStyle(style: string, prop: string): number | null {
  const re = new RegExp(`\\b${prop}\\s*:\\s*(-?\\d+(?:\\.\\d+)?)px`, "i");
  const m = re.exec(style);
  return m ? Number(m[1]) : null;
}

function readMarginOffset(style: string): { ox: number; oy: number } {
  const shorthand = /\bmargin\s*:\s*(-?\d+(?:\.\d+)?)px\s+\S+\s+\S+\s+(-?\d+(?:\.\d+)?)px/.exec(
    style
  );
  if (shorthand) {
    return { oy: -Number(shorthand[1]), ox: -Number(shorthand[2]) };
  }
  const ml = pxFromStyle(style, "margin-left");
  const mt = pxFromStyle(style, "margin-top");
  return { ox: ml != null ? -ml : 0, oy: mt != null ? -mt : 0 };
}

export const ResizableImage = Image.extend({
  addAttributes() {
    const parent = (this.parent?.() ?? {}) as Record<string, unknown>;
    return {
      ...parent,
      width: {
        default: null,
        parseHTML: (el: HTMLElement) => {
          const v = el.getAttribute("width");
          return v ? Number(v) : null;
        },
        renderHTML: (a: { width?: number | null }) =>
          a.width != null ? { width: a.width } : {},
      },
      height: {
        default: null,
        parseHTML: (el: HTMLElement) => {
          const v = el.getAttribute("height");
          return v ? Number(v) : null;
        },
        renderHTML: (a: { height?: number | null }) =>
          a.height != null ? { height: a.height } : {},
      },
      imgWidth: { default: null },
      imgHeight: { default: null },
      cropX: { default: 0 },
      cropY: { default: 0 },
      align: { default: null },
    };
  },

  parseHTML() {
    return [
      // Crop wrapper — `<span class="butea-crop">...<img/></span>`
      {
        tag: "span.butea-crop",
        getAttrs: (el: HTMLElement) => {
          const img = el.querySelector("img");
          if (!img) return false;
          const spanStyle = el.getAttribute("style") ?? "";
          const imgStyle = img.getAttribute("style") ?? "";
          const viewW = pxFromStyle(spanStyle, "width");
          const viewH = pxFromStyle(spanStyle, "height");
          const imgW = pxFromStyle(imgStyle, "width");
          const imgH = pxFromStyle(imgStyle, "height");
          const { ox, oy } = readMarginOffset(imgStyle);
          return {
            src: img.getAttribute("src"),
            alt: img.getAttribute("alt") ?? "",
            title: img.getAttribute("title"),
            width: viewW,
            height: viewH,
            imgWidth: imgW,
            imgHeight: imgH,
            cropX: ox,
            cropY: oy,
            align: parseAlignFromStyle(spanStyle),
          };
        },
        contentElement: "img",
      },
      {
        tag: "img[src]",
        getAttrs: (el: HTMLElement) => {
          const style = el.getAttribute("style") ?? "";
          const align = parseAlignFromStyle(style);
          // For align="full" mode, ignore the explicit width/height
          // attributes — the inline 100% style overrides them anyway.
          const wAttr = el.getAttribute("width");
          const hAttr = el.getAttribute("height");
          const w = wAttr ? Number(wAttr) : null;
          const h = hAttr ? Number(hAttr) : null;
          return {
            src: el.getAttribute("src"),
            alt: el.getAttribute("alt") ?? "",
            title: el.getAttribute("title"),
            width: align === "full" ? null : w,
            height: align === "full" ? null : h,
            imgWidth: align === "full" ? null : w,
            imgHeight: align === "full" ? null : h,
            cropX: 0,
            cropY: 0,
            align,
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const a = HTMLAttributes as ImgAttrs & Record<string, unknown>;
    if (a.align === "full") {
      return [
        "img",
        {
          src: a.src,
          alt: a.alt ?? "",
          style: "display:block;width:100%;height:auto;",
        },
      ];
    }
    const cropped =
      (a.width != null && a.imgWidth != null && a.width !== a.imgWidth) ||
      (a.height != null && a.imgHeight != null && a.height !== a.imgHeight) ||
      (a.cropX ?? 0) > 0 ||
      (a.cropY ?? 0) > 0;
    const alignStyle = alignToStyle(a.align ?? null);
    if (!cropped) {
      const out: Record<string, unknown> = { src: a.src };
      if (a.alt) out.alt = a.alt;
      if (a.title) out.title = a.title;
      if (a.width != null) out.width = a.width;
      if (a.height != null) out.height = a.height;
      if (alignStyle) out.style = alignStyle;
      return ["img", out];
    }
    const spanStyle =
      `display:inline-block;overflow:hidden;vertical-align:middle;` +
      `width:${a.width ?? a.imgWidth}px;height:${a.height ?? a.imgHeight}px;` +
      alignStyle;
    const imgStyle =
      `display:block;` +
      `width:${a.imgWidth ?? a.width}px;height:${a.imgHeight ?? a.height}px;` +
      `margin:-${a.cropY || 0}px 0 0 -${a.cropX || 0}px;`;
    return [
      "span",
      { class: "butea-crop", style: spanStyle },
      ["img", { src: a.src, alt: a.alt ?? "", style: imgStyle }],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageView);
  },

  addStorage() {
    const parent = (this.parent?.() ?? {}) as Record<string, unknown>;
    return {
      ...parent,
      markdown: {
        serialize(state: SerializerState, node: PMImageNode) {
          const out = buildSerializedMarkdown(node.attrs);
          if (out) state.write(out);
          else
            (
              defaultMarkdownSerializer.nodes.image as unknown as (
                state: SerializerState,
                node: PMImageNode
              ) => void
            )(state, node);
        },
        parse: {},
      },
    };
  },
});
