"use client";

import * as React from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import { TextAlign } from "@tiptap/extension-text-align";
import { Markdown } from "tiptap-markdown";
import { ResizableImage } from "./ResizableImage";
import { FontSize, LineHeight } from "@/lib/editor-text-style";
import { HalfHighlight, HIGHLIGHT_COLORS } from "@/lib/editor-highlight";
import {
  Bold,
  Italic,
  Heading2,
  Quote,
  List,
  ListOrdered,
  Code2,
  Link as LinkIcon,
  Image as ImageIcon,
  Strikethrough,
  Undo2,
  Redo2,
  Minus,
  Video,
  Upload,
  Globe,
  ChevronDown,
  Highlighter,
  FileCode2,
} from "lucide-react";
import { useWorkshop } from "@/lib/store";
import { getTheme } from "@/lib/themes/themes";
import { buildThemeCss } from "@/lib/md/render";
import { resolveMediaInMarkdown } from "@/lib/media/store";
import { imageMarkdown } from "@/lib/llm/image";
import { setTipTapEditor, insertAtCursor } from "@/lib/editor-ref";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { VideoEmbedDialog } from "./dialogs/VideoEmbedDialog";
import { LinkCardDialog } from "./dialogs/LinkCardDialog";
import { PasteImageUrlDialog } from "./dialogs/PasteImageUrlDialog";
import { AIInlineMenu } from "./AIInlineMenu";
import { StylingMenu } from "./StylingMenu";
import { ThemePicker } from "@/components/themes/ThemePicker";
import * as Popover from "@radix-ui/react-popover";

export function VisualEditor() {
  const markdownValue = useWorkshop((s) => s.markdown);
  const setMarkdown = useWorkshop((s) => s.setMarkdown);
  const themeId = useWorkshop((s) => s.themeId);
  const customThemeTokens = useWorkshop((s) => s.customThemeTokens);

  // Raw markdown mode toggle
  const [rawMode, setRawMode] = React.useState(false);

  // Build theme CSS targeting the TipTap editor's .ProseMirror container.
  // Memoize on stable primitives (themeId) and reference (customThemeTokens)
  // to avoid rebuilding CSS on every render.
  const theme = React.useMemo(
    () => getTheme(themeId, customThemeTokens ?? undefined),
    [themeId, customThemeTokens]
  );
  const editorCss = React.useMemo(
    () => buildThemeCss(theme, ".ProseMirror"),
    [theme]
  );

  // Guard against sync loops: when we programmatically setContent,
  // TipTap may fire onUpdate — this ref tells onUpdate to ignore it.
  const suppressUpdateRef = React.useRef(false);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4, 5, 6] },
      }),
      Link.configure({ openOnClick: false }),
      ResizableImage,
      TextStyle,
      Color,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      FontSize,
      LineHeight,
      HalfHighlight,
      Markdown.configure({
        html: true,
        breaks: true,
        linkify: true,
        transformPastedText: true,
      }),
    ],
    content: markdownValue,
    onUpdate: ({ editor }) => {
      if (suppressUpdateRef.current) return;
      const storage = editor.storage as unknown as {
        markdown?: { getMarkdown?: () => string };
      };
      const md = storage.markdown?.getMarkdown?.() ?? editor.getHTML();
      setMarkdown(md);
    },
    editorProps: {
      attributes: {
        class: "max-w-none focus:outline-none min-h-full",
      },
      handleDrop: (view, event) => {
        const mediaId = event.dataTransfer?.getData("application/x-butea-media");
        if (mediaId) {
          event.preventDefault();
          (async () => {
            try {
              const md = `![image](butea-media://${mediaId})`;
              const resolved = await resolveMediaInMarkdown(md);
              const m = /!\[([^\]]*)\]\(([^)]+)\)/.exec(resolved);
              if (!m || !view.state) return;
              const { schema } = view.state;
              const coords = { left: event.clientX, top: event.clientY };
              const pos = view.posAtCoords(coords)?.pos;
              const node = schema.nodes.image.create({
                src: m[2],
                alt: m[1],
              });
              const tr =
                pos != null
                  ? view.state.tr.insert(pos, node)
                  : view.state.tr.replaceSelectionWith(node);
              view.dispatch(tr);
            } catch (err) {
              toast.error("插入图片失败", (err as Error).message);
            }
          })();
          return true;
        }

        const files = Array.from(event.dataTransfer?.files ?? []).filter((f) =>
          f.type.startsWith("image/")
        );
        if (files.length === 0) return false;
        event.preventDefault();
        (async () => {
          try {
            const resolved = await Promise.all(
              files.map(async (file) => {
                const md = await imageMarkdown(
                  file,
                  file.name.replace(/\.[^.]+$/, "")
                );
                return resolveMediaInMarkdown(md);
              })
            );
            for (const r of resolved) {
              const m = /!\[([^\]]*)\]\(([^)]+)\)/.exec(r);
              if (m && view.state) {
                const { schema } = view.state;
                const node = schema.nodes.image.create({
                  src: m[2],
                  alt: m[1],
                });
                const tr = view.state.tr.replaceSelectionWith(node);
                view.dispatch(tr);
              }
            }
          } catch (err) {
            toast.error("图片导入失败", (err as Error).message);
          }
        })();
        return true;
      },
    },
  });

  React.useEffect(() => {
    setTipTapEditor(editor ?? null);
    return () => {
      setTipTapEditor(null);
    };
  }, [editor]);

  // Sync external markdown changes into TipTap
  React.useEffect(() => {
    if (!editor || rawMode) return;
    const storage = editor.storage as unknown as {
      markdown?: { getMarkdown?: () => string };
    };
    const current = storage.markdown?.getMarkdown?.() ?? "";
    if (current.trim() === markdownValue.trim()) return;

    let cancelled = false;
    (async () => {
      const resolved = await resolveMediaInMarkdown(markdownValue);
      if (cancelled) return;
      suppressUpdateRef.current = true;
      editor.commands.setContent(resolved, { emitUpdate: false });
      // Release guard on next microtask so user edits are not suppressed
      queueMicrotask(() => {
        suppressUpdateRef.current = false;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [editor, markdownValue, rawMode]);

  // When switching back from raw mode, re-sync editor content
  const handleExitRawMode = React.useCallback(() => {
    setRawMode(false);
    if (editor) {
      (async () => {
        const resolved = await resolveMediaInMarkdown(markdownValue);
        suppressUpdateRef.current = true;
        editor.commands.setContent(resolved, { emitUpdate: false });
        queueMicrotask(() => {
          suppressUpdateRef.current = false;
        });
      })();
    }
  }, [editor, markdownValue]);

  return (
    <div className="h-full w-full flex flex-col">
      <style dangerouslySetInnerHTML={{ __html: editorCss }} />
      <VisualToolbar
        editor={editor}
        rawMode={rawMode}
        onToggleRaw={() => (rawMode ? handleExitRawMode() : setRawMode(true))}
      />
      {rawMode ? (
        <RawMarkdownEditor
          value={markdownValue}
          onChange={setMarkdown}
          theme={theme}
        />
      ) : (
        <div
          className="flex-1 overflow-auto"
          style={{ background: theme.tokens.bg }}
        >
          <EditorContent editor={editor} className="h-full" />
        </div>
      )}
    </div>
  );
}

// ====================================================================
// Raw Markdown editor (plain textarea)
// ====================================================================

function RawMarkdownEditor({
  value,
  onChange,
  theme,
}: {
  value: string;
  onChange: (v: string) => void;
  theme: ReturnType<typeof getTheme>;
}) {
  return (
    <div className="flex-1 overflow-auto bg-[#1e1e1e]">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        className="w-full h-full resize-none focus:outline-none p-8 font-mono text-sm leading-relaxed"
        style={{
          background: "#1e1e1e",
          color: "#d4d4d4",
          caretColor: "#d4d4d4",
          tabSize: 2,
        }}
      />
    </div>
  );
}

// ====================================================================
// Toolbar
// ====================================================================

function VisualToolbar({
  editor,
  rawMode,
  onToggleRaw,
}: {
  editor: Editor | null;
  rawMode: boolean;
  onToggleRaw: () => void;
}) {
  const [, forceRender] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => {
    if (!editor) return;
    const handler = () => forceRender();
    editor.on("selectionUpdate", handler);
    return () => {
      editor.off("selectionUpdate", handler);
    };
  }, [editor]);

  const [videoOpen, setVideoOpen] = React.useState(false);
  const [linkOpen, setLinkOpen] = React.useState(false);
  const [pasteUrlOpen, setPasteUrlOpen] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  if (!editor) {
    return (
      <div className="h-7 shrink-0 border-b border-app-border bg-app-surface" />
    );
  }

  const uploadImage = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("请选择图片文件");
      return;
    }
    try {
      const md = await imageMarkdown(file, file.name.replace(/\.[^.]+$/, ""));
      const resolved = await resolveMediaInMarkdown(md);
      const m = /!\[([^\]]*)\]\(([^)]+)\)/.exec(resolved);
      if (!m) return;
      editor.chain().focus().setImage({ src: m[2], alt: m[1] }).run();
    } catch (err) {
      toast.error("图片保存失败", (err as Error).message);
    }
  };

  const onFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await uploadImage(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <>
      <div className="flex items-center gap-0 px-1.5 py-1 border-b border-app-border bg-app-surface overflow-x-auto">
        {/* Formatting */}
        <T
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="加粗 (⌘B)"
          disabled={rawMode}
        >
          <Bold size={12} />
        </T>
        <T
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="斜体 (⌘I)"
          disabled={rawMode}
        >
          <Italic size={12} />
        </T>
        <T
          active={editor.isActive("strike")}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          title="删除线"
          disabled={rawMode}
        >
          <Strikethrough size={12} />
        </T>
        <T
          active={editor.isActive("heading", { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          title="二级标题"
          disabled={rawMode}
        >
          <Heading2 size={12} />
        </T>
        <T
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          title="引用"
          disabled={rawMode}
        >
          <Quote size={12} />
        </T>
        <T
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="无序列表"
          disabled={rawMode}
        >
          <List size={12} />
        </T>
        <T
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="有序列表"
          disabled={rawMode}
        >
          <ListOrdered size={12} />
        </T>
        <T
          active={editor.isActive("code") || editor.isActive("codeBlock")}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          title="代码块 (⌘E)"
          disabled={rawMode}
        >
          <Code2 size={12} />
        </T>

        {/* Half-height highlight */}
        <HighlightDropdown editor={editor} disabled={rawMode} />

        <Divider />

        {/* Text styling — color / size / line-height / alignment */}
        <StylingMenu />

        {/* Article theme — color / style / custom */}
        <ThemePicker />

        <Divider />

        {/* Image dropdown */}
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
                      存到浏览器,发布前再上传图床
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
                      已在 CDN 上的图片,直接写入
                    </span>
                  </span>
                </button>
              </Popover.Close>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
        <T onClick={() => setVideoOpen(true)} title="嵌入视频" disabled={rawMode}>
          <Video size={12} />
          <span className="hidden md:inline ml-1">视频</span>
        </T>
        <T onClick={() => setLinkOpen(true)} title="外链卡片" disabled={rawMode}>
          <LinkIcon size={12} />
          <span className="hidden md:inline ml-1">链接</span>
        </T>
        <T
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="分割线"
          disabled={rawMode}
        >
          <Minus size={12} />
        </T>

        <Divider />

        {/* Unified AI menu */}
        <AIInlineMenu />

        <div className="flex-1" />

        {/* Raw markdown toggle */}
        <T
          active={rawMode}
          onClick={onToggleRaw}
          title={rawMode ? "返回富文本编辑" : "查看 Markdown 源码"}
        >
          <FileCode2 size={12} />
          <span className="hidden md:inline ml-0.5">
            {rawMode ? "富文本" : "源码"}
          </span>
        </T>

        <Divider />

        <T
          onClick={() => editor.chain().focus().undo().run()}
          title="撤销 (⌘Z)"
          disabled={!editor.can().undo() || rawMode}
        >
          <Undo2 size={12} />
        </T>
        <T
          onClick={() => editor.chain().focus().redo().run()}
          title="重做 (⌘⇧Z)"
          disabled={!editor.can().redo() || rawMode}
        >
          <Redo2 size={12} />
        </T>
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

// ====================================================================
// Highlight dropdown
// ====================================================================

function HighlightDropdown({
  editor,
  disabled,
}: {
  editor: Editor;
  disabled?: boolean;
}) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          className={cn(
            "flex items-center gap-0.5 px-1.5 py-1 rounded text-xs transition-colors whitespace-nowrap",
            editor.isActive("halfHighlight")
              ? "bg-app-surface-hover text-app-fg"
              : "text-app-fg-muted hover:text-app-fg hover:bg-app-surface-hover",
            disabled && "opacity-40 cursor-not-allowed"
          )}
          title="荧光笔标注"
        >
          <Highlighter size={12} />
          <ChevronDown size={8} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          className="z-50 bg-app-surface border border-app-border rounded-lg shadow-xl p-2 animate-fade-in"
        >
          <div className="text-[10px] text-app-fg-subtle mb-1.5">荧光笔颜色</div>
          <div className="flex gap-1">
            {HIGHLIGHT_COLORS.map((c) => (
              <Popover.Close key={c.value} asChild>
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() =>
                    editor.chain().focus().toggleHalfHighlight(c.value).run()
                  }
                  title={c.label}
                  className="w-6 h-6 rounded border border-app-border hover:scale-110 transition-transform"
                  style={{
                    background: `linear-gradient(transparent 60%, ${c.value} 60%)`,
                  }}
                />
              </Popover.Close>
            ))}
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() =>
                editor.chain().focus().unsetHalfHighlight().run()
              }
              title="清除标注"
              className="w-6 h-6 rounded border border-app-border hover:scale-110 transition-transform flex items-center justify-center text-[9px] text-app-fg-muted"
            >
              清
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function T({
  children,
  active,
  disabled,
  onClick,
  title,
}: {
  children: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        if (!disabled) onClick();
      }}
      disabled={disabled}
      title={title}
      className={cn(
        "flex items-center gap-1 px-1.5 py-1 rounded text-xs transition-colors whitespace-nowrap",
        active
          ? "bg-app-surface-hover text-app-fg"
          : "text-app-fg-muted hover:text-app-fg hover:bg-app-surface-hover",
        disabled && "opacity-40 cursor-not-allowed"
      )}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="w-px h-4 bg-app-border mx-1.5 shrink-0" />;
}
