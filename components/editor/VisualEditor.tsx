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
import { AdmonitionDecoration, ADMONITION_TYPES, admonitionEditorCss } from "@/lib/editor-admonition";
import { CodeBlockChrome, codeBlockChromeCss } from "@/lib/editor-codeblock";
import {
  Bold,
  Italic,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Pilcrow,
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
    () => buildThemeCss(theme, ".ProseMirror") + admonitionEditorCss(".ProseMirror") + codeBlockChromeCss(".ProseMirror"),
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
      AdmonitionDecoration,
      CodeBlockChrome,
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
        <HeadingDropdown editor={editor} disabled={rawMode} />
        <BlockquoteDropdown editor={editor} disabled={rawMode} />
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
        <CodeBlockDropdown editor={editor} disabled={rawMode} />

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

const HEADING_ITEMS: {
  label: string;
  level: number | null;
  icon: React.ReactNode;
}[] = [
  { label: "正文", level: null, icon: <Pilcrow size={12} /> },
  { label: "H1 一级标题", level: 1, icon: <Heading1 size={12} /> },
  { label: "H2 二级标题", level: 2, icon: <Heading2 size={12} /> },
  { label: "H3 三级标题", level: 3, icon: <Heading3 size={12} /> },
  { label: "H4 四级标题", level: 4, icon: <Heading4 size={12} /> },
];

/**
 * Helper: detect current admonition type from the blockquote the cursor is in.
 * Returns null if not in a blockquote, or "plain" for a plain quote.
 */
function detectAdmonitionType(editor: Editor): string | null {
  const { $from } = editor.state.selection;
  for (let d = $from.depth; d >= 0; d--) {
    const node = $from.node(d);
    if (node.type.name === "blockquote") {
      const first = node.firstChild;
      if (first?.type.name === "paragraph") {
        const m = /^\[!(\w+)\]/.exec(first.textContent);
        if (m) return m[1].toLowerCase();
      }
      return "plain";
    }
  }
  return null;
}

/**
 * Apply or replace admonition type on the current block.
 * - If not in blockquote: wrap in blockquote, prepend [!type]
 * - If in plain blockquote: prepend [!type]
 * - If already has [!type]: replace the type token
 * - If choosing "plain": remove the [!type] token but keep blockquote
 */
function applyAdmonition(editor: Editor, type: string | null) {
  const current = detectAdmonitionType(editor);

  if (current === null) {
    // Not in a blockquote — wrap first
    editor.chain().focus().toggleBlockquote().run();
    if (type) {
      // Insert token at the start of the first paragraph in the new blockquote
      const { $from } = editor.state.selection;
      // Find the paragraph start inside the blockquote
      for (let d = $from.depth; d >= 0; d--) {
        if ($from.node(d).type.name === "blockquote") {
          const paraStart = $from.start(d) + 1; // paragraph open inside blockquote
          editor.chain().insertContentAt(paraStart, `[!${type}] `).run();
          break;
        }
      }
    }
    return;
  }

  if (type === null) {
    // Removing admonition — strip the [!type] token if present
    if (current !== "plain") {
      stripAdmonitionToken(editor);
    }
    // Unwrap blockquote
    editor.chain().focus().toggleBlockquote().run();
    return;
  }

  if (current === "plain") {
    // Plain blockquote → add token at start
    const { $from } = editor.state.selection;
    for (let d = $from.depth; d >= 0; d--) {
      if ($from.node(d).type.name === "blockquote") {
        const paraStart = $from.start(d) + 1;
        editor.chain().insertContentAt(paraStart, `[!${type}] `).run();
        break;
      }
    }
    return;
  }

  // Already has a type — replace it
  replaceAdmonitionToken(editor, type);
}

function stripAdmonitionToken(editor: Editor) {
  const { $from } = editor.state.selection;
  for (let d = $from.depth; d >= 0; d--) {
    const node = $from.node(d);
    if (node.type.name === "blockquote") {
      const first = node.firstChild;
      if (first?.type.name === "paragraph") {
        const m = /^\[!\w+\]\s*/.exec(first.textContent);
        if (m) {
          const paraStart = $from.start(d) + 1;
          const { tr } = editor.state;
          tr.delete(paraStart, paraStart + m[0].length);
          editor.view.dispatch(tr);
        }
      }
      break;
    }
  }
}

function replaceAdmonitionToken(editor: Editor, newType: string) {
  const { $from } = editor.state.selection;
  for (let d = $from.depth; d >= 0; d--) {
    const node = $from.node(d);
    if (node.type.name === "blockquote") {
      const first = node.firstChild;
      if (first?.type.name === "paragraph") {
        const m = /^\[!\w+\]/.exec(first.textContent);
        if (m) {
          const paraStart = $from.start(d) + 1;
          const { tr } = editor.state;
          tr.insertText(`[!${newType}]`, paraStart, paraStart + m[0].length);
          editor.view.dispatch(tr);
        }
      }
      break;
    }
  }
}

function BlockquoteDropdown({
  editor,
  disabled,
}: {
  editor: Editor;
  disabled?: boolean;
}) {
  const isInQuote = editor.isActive("blockquote");

  const items = [
    { key: "plain", label: "引用", icon: <Quote size={12} /> },
    ...ADMONITION_TYPES.map((a) => ({
      key: a.type,
      label: a.label,
      icon: <span className="text-xs leading-none">{a.icon}</span>,
    })),
  ];

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          className={cn(
            "flex items-center gap-0.5 px-1.5 py-1 rounded text-xs transition-colors whitespace-nowrap",
            isInQuote
              ? "bg-app-surface-hover text-app-fg"
              : "text-app-fg-muted hover:text-app-fg hover:bg-app-surface-hover",
            disabled && "opacity-40 cursor-not-allowed"
          )}
          title="引用 / 卡片"
        >
          <Quote size={12} />
          <ChevronDown size={8} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          className="z-50 bg-app-surface border border-app-border rounded-lg shadow-xl p-1 animate-fade-in min-w-[140px]"
        >
          {items.map((item) => (
            <Popover.Close key={item.key} asChild>
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  if (item.key === "plain") {
                    const current = detectAdmonitionType(editor);
                    if (current === null) {
                      // Not in blockquote — wrap as plain quote
                      editor.chain().focus().toggleBlockquote().run();
                    } else if (current === "plain") {
                      // Already plain quote — unwrap
                      editor.chain().focus().toggleBlockquote().run();
                    } else {
                      // Has admonition — strip token, keep quote
                      stripAdmonitionToken(editor);
                    }
                  } else {
                    applyAdmonition(editor, item.key);
                  }
                }}
                className={cn(
                  "flex items-center gap-2 w-full px-2 py-1.5 rounded text-xs transition-colors",
                  "text-app-fg-muted hover:text-app-fg hover:bg-app-surface-hover"
                )}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            </Popover.Close>
          ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

const CODE_LANGUAGES = [
  { lang: "", label: "纯文本" },
  { lang: "javascript", label: "JavaScript" },
  { lang: "typescript", label: "TypeScript" },
  { lang: "python", label: "Python" },
  { lang: "html", label: "HTML" },
  { lang: "css", label: "CSS" },
  { lang: "json", label: "JSON" },
  { lang: "bash", label: "Bash" },
  { lang: "sql", label: "SQL" },
  { lang: "markdown", label: "Markdown" },
  { lang: "yaml", label: "YAML" },
  { lang: "rust", label: "Rust" },
  { lang: "go", label: "Go" },
  { lang: "java", label: "Java" },
];

function CodeBlockDropdown({
  editor,
  disabled,
}: {
  editor: Editor;
  disabled?: boolean;
}) {
  const isActive = editor.isActive("codeBlock");

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          className={cn(
            "flex items-center gap-0.5 px-1.5 py-1 rounded text-xs transition-colors whitespace-nowrap",
            isActive
              ? "bg-app-surface-hover text-app-fg"
              : "text-app-fg-muted hover:text-app-fg hover:bg-app-surface-hover",
            disabled && "opacity-40 cursor-not-allowed"
          )}
          title="代码块"
        >
          <Code2 size={12} />
          <ChevronDown size={8} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          className="z-50 bg-app-surface border border-app-border rounded-lg shadow-xl p-1 animate-fade-in min-w-[120px] max-h-[280px] overflow-y-auto"
        >
          {CODE_LANGUAGES.map((c) => (
            <Popover.Close key={c.lang} asChild>
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  if (isActive) {
                    // Update language on existing code block
                    editor
                      .chain()
                      .focus()
                      .updateAttributes("codeBlock", { language: c.lang })
                      .run();
                  } else {
                    editor
                      .chain()
                      .focus()
                      .toggleCodeBlock()
                      .updateAttributes("codeBlock", { language: c.lang })
                      .run();
                  }
                }}
                className={cn(
                  "flex items-center gap-2 w-full px-2 py-1.5 rounded text-xs transition-colors",
                  isActive &&
                    editor.isActive("codeBlock", { language: c.lang })
                    ? "bg-app-surface-hover text-app-fg"
                    : "text-app-fg-muted hover:text-app-fg hover:bg-app-surface-hover"
                )}
              >
                <Code2 size={10} className="opacity-40" />
                <span>{c.label}</span>
              </button>
            </Popover.Close>
          ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function HeadingDropdown({
  editor,
  disabled,
}: {
  editor: Editor;
  disabled?: boolean;
}) {
  const activeItem =
    HEADING_ITEMS.find(
      (h) => h.level !== null && editor.isActive("heading", { level: h.level })
    ) ?? HEADING_ITEMS[0];

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          className={cn(
            "flex items-center gap-0.5 px-1.5 py-1 rounded text-xs transition-colors whitespace-nowrap",
            activeItem.level !== null
              ? "bg-app-surface-hover text-app-fg"
              : "text-app-fg-muted hover:text-app-fg hover:bg-app-surface-hover",
            disabled && "opacity-40 cursor-not-allowed"
          )}
          title="标题层级"
        >
          {activeItem.icon}
          <ChevronDown size={8} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          className="z-50 bg-app-surface border border-app-border rounded-lg shadow-xl p-1 animate-fade-in min-w-[120px]"
        >
          {HEADING_ITEMS.map((h) => (
            <Popover.Close key={h.label} asChild>
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  if (h.level === null) {
                    editor.chain().focus().setParagraph().run();
                  } else {
                    editor
                      .chain()
                      .focus()
                      .toggleHeading({ level: h.level as 1 | 2 | 3 | 4 })
                      .run();
                  }
                }}
                className={cn(
                  "flex items-center gap-2 w-full px-2 py-1.5 rounded text-xs transition-colors",
                  (h.level === null && !editor.isActive("heading"))
                    ? "bg-app-surface-hover text-app-fg"
                    : h.level !== null && editor.isActive("heading", { level: h.level })
                    ? "bg-app-surface-hover text-app-fg"
                    : "text-app-fg-muted hover:text-app-fg hover:bg-app-surface-hover"
                )}
              >
                {h.icon}
                {h.label}
              </button>
            </Popover.Close>
          ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

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
