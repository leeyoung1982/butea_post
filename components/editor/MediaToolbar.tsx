"use client";

import * as React from "react";
import {
  Image as ImageIcon,
  Video,
  Link2,
  Bold,
  Italic,
  Strikethrough,
  Quote,
  List,
  ListOrdered,
  Code2,
  Heading2,
  Upload,
  Globe,
  ChevronDown,
  Minus,
  Undo2,
  Redo2,
} from "lucide-react";
import { undo, redo } from "@codemirror/commands";
import * as Popover from "@radix-ui/react-popover";
import { insertAtCursor, getEditorView } from "@/lib/editor-ref";
import { imageMarkdown } from "@/lib/llm/image";
import { VideoEmbedDialog } from "./dialogs/VideoEmbedDialog";
import { LinkCardDialog } from "./dialogs/LinkCardDialog";
import { PasteImageUrlDialog } from "./dialogs/PasteImageUrlDialog";
import { AIInlineMenu } from "./AIInlineMenu";
import { StylingMenu } from "./StylingMenu";
import { toast } from "@/components/ui/toast";

/**
 * Slim toolbar above the editor. Format buttons dispatch directly via the
 * registered EditorView (no placeholder text); media buttons open dialogs.
 *
 * Keyboard shortcuts (⌘B / ⌘I / ⌘E) duplicate the bold / italic / code
 * actions inside the editor — they survive even if focus is unclear, since
 * the keymap is attached to the EditorView itself.
 */
export function MediaToolbar() {
  const [videoOpen, setVideoOpen] = React.useState(false);
  const [linkOpen, setLinkOpen] = React.useState(false);
  const [pasteUrlOpen, setPasteUrlOpen] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const uploadImage = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("请选择图片文件");
      return;
    }
    try {
      const md = await imageMarkdown(file, file.name.replace(/\.[^.]+$/, ""));
      insertAtCursor(md);
    } catch (err) {
      console.error("[Butea] image upload failed:", err);
      toast.error("图片保存失败", (err as Error).message);
    }
  };

  const onFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await uploadImage(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  /** Wrap the current selection with delimiters; cursor sits after the wrap. */
  const wrap = (left: string, right: string) => {
    const view = getEditorView();
    if (!view) return;
    const sel = view.state.selection.main;
    const selected = sel.empty
      ? ""
      : view.state.doc.sliceString(sel.from, sel.to);
    view.dispatch({
      changes: { from: sel.from, to: sel.to, insert: left + selected + right },
      selection: { anchor: sel.from + left.length + selected.length },
    });
    view.focus();
  };

  /** Smart code: inline when single line, fenced block when multiline. */
  const codeWrap = () => {
    const view = getEditorView();
    if (!view) return;
    const sel = view.state.selection.main;
    const selected = sel.empty
      ? ""
      : view.state.doc.sliceString(sel.from, sel.to);
    if (selected.includes("\n")) {
      const text = "```\n" + selected + "\n```";
      view.dispatch({
        changes: { from: sel.from, to: sel.to, insert: text },
        selection: { anchor: sel.from + 4 + selected.length },
      });
    } else {
      view.dispatch({
        changes: { from: sel.from, to: sel.to, insert: "`" + selected + "`" },
        selection: { anchor: sel.from + 1 + selected.length },
      });
    }
    view.focus();
  };

  /** Add a markdown prefix to the start of the line containing the cursor. */
  const prefixLine = (prefix: string) => {
    const view = getEditorView();
    if (!view) return;
    const sel = view.state.selection.main;
    const line = view.state.doc.lineAt(sel.from);
    view.dispatch({
      changes: { from: line.from, to: line.from, insert: prefix },
      selection: { anchor: sel.from + prefix.length },
    });
    view.focus();
  };

  // Use onMouseDown + preventDefault so the editor never loses selection
  // when the user clicks a button. (Default browser behaviour on button
  // mouse-down is to move focus away from the editor.)
  const click = (fn: () => void) => (e: React.MouseEvent) => {
    e.preventDefault();
    fn();
  };

  return (
    <>
      <div className="flex items-center gap-0 px-1.5 py-1 border-b border-app-border bg-app-surface overflow-x-auto">
        {/* Formatting */}
        <Tool title="加粗 (⌘B)" onMouseDown={click(() => wrap("**", "**"))}>
          <Bold size={12} />
        </Tool>
        <Tool title="斜体 (⌘I)" onMouseDown={click(() => wrap("*", "*"))}>
          <Italic size={12} />
        </Tool>
        <Tool title="删除线" onMouseDown={click(() => wrap("~~", "~~"))}>
          <Strikethrough size={12} />
        </Tool>
        <Tool title="二级标题" onMouseDown={click(() => prefixLine("## "))}>
          <Heading2 size={12} />
        </Tool>
        <Tool title="引用" onMouseDown={click(() => prefixLine("> "))}>
          <Quote size={12} />
        </Tool>
        <Tool title="无序列表" onMouseDown={click(() => prefixLine("- "))}>
          <List size={12} />
        </Tool>
        <Tool title="有序列表" onMouseDown={click(() => prefixLine("1. "))}>
          <ListOrdered size={12} />
        </Tool>
        <Tool
          title="代码（多行=代码块；单行=行内）(⌘E)"
          onMouseDown={click(codeWrap)}
        >
          <Code2 size={12} />
        </Tool>

        <Divider />

        {/* Text styling — color / size / line-height / alignment */}
        <StylingMenu />

        <Divider />

        {/* Media */}
        {/* Image — two paths: local upload OR paste a public URL */}
        <Popover.Root>
          <Popover.Trigger asChild>
            <button
              type="button"
              className="flex items-center gap-1 px-1.5 py-1 rounded text-xs transition-colors text-app-fg-muted hover:text-app-fg hover:bg-app-surface-hover whitespace-nowrap"
              title="插入图片：本地文件 或 公网 URL"
            >
              <ImageIcon size={12} />
              <span className="hidden md:inline">图片</span>
              <ChevronDown size={10} />
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              align="start"
              sideOffset={4}
              className="z-50 w-[220px] bg-app-surface border border-app-border rounded-lg shadow-xl py-1 animate-fade-in"
            >
              <Popover.Close asChild>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-start gap-2.5 px-3 py-2 text-left hover:bg-app-surface-hover transition-colors"
                >
                  <Upload size={13} className="mt-0.5 text-app-fg-muted" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-app-fg">
                      上传本地文件
                    </span>
                    <span className="block text-[11px] text-app-fg-muted leading-snug mt-0.5">
                      存到浏览器，发布前再上传图床
                    </span>
                  </span>
                </button>
              </Popover.Close>
              <Popover.Close asChild>
                <button
                  onClick={() => setPasteUrlOpen(true)}
                  className="w-full flex items-start gap-2.5 px-3 py-2 text-left hover:bg-app-surface-hover transition-colors"
                >
                  <Globe size={13} className="mt-0.5 text-app-fg-muted" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-app-fg">
                      粘贴公网 URL
                    </span>
                    <span className="block text-[11px] text-app-fg-muted leading-snug mt-0.5">
                      已在 CDN 上的图片，直接写入 markdown
                    </span>
                  </span>
                </button>
              </Popover.Close>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
        <Tool title="嵌入视频" onMouseDown={click(() => setVideoOpen(true))}>
          <Video size={12} />
          <span className="hidden md:inline">视频</span>
        </Tool>
        <Tool title="外链卡片" onMouseDown={click(() => setLinkOpen(true))}>
          <Link2 size={12} />
          <span className="hidden md:inline">链接</span>
        </Tool>
        <Tool title="分割线" onMouseDown={click(() => insertAtCursor("\n\n---\n\n"))}>
          <Minus size={12} />
        </Tool>

        <Divider />

        {/* Unified AI menu — text rewrite + image generation in one dropdown */}
        <AIInlineMenu />

        <div className="flex-1" />

        <Tool
          title="撤销 (⌘Z)"
          onMouseDown={click(() => {
            const view = getEditorView();
            if (view) {
              undo(view);
              view.focus();
            }
          })}
        >
          <Undo2 size={12} />
        </Tool>
        <Tool
          title="重做 (⌘⇧Z)"
          onMouseDown={click(() => {
            const view = getEditorView();
            if (view) {
              redo(view);
              view.focus();
            }
          })}
        >
          <Redo2 size={12} />
        </Tool>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={onFilePick}
        className="hidden"
      />

      <VideoEmbedDialog open={videoOpen} onOpenChange={setVideoOpen} />
      <LinkCardDialog open={linkOpen} onOpenChange={setLinkOpen} />
      <PasteImageUrlDialog open={pasteUrlOpen} onOpenChange={setPasteUrlOpen} />
    </>
  );
}

function Tool({
  children,
  title,
  onMouseDown,
}: {
  children: React.ReactNode;
  title: string;
  onMouseDown: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      onMouseDown={onMouseDown}
      title={title}
      type="button"
      className="flex items-center gap-1 px-1.5 py-1 rounded text-xs transition-colors text-app-fg-muted hover:text-app-fg hover:bg-app-surface-hover whitespace-nowrap"
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="w-px h-4 bg-app-border mx-1.5 shrink-0" />;
}
