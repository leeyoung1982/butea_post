"use client";

import * as React from "react";
import CodeMirror, { type ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { EditorView, keymap, drawSelection } from "@codemirror/view";
import { useWorkshop } from "@/lib/store";
import { setEditorView, insertAtCursor } from "@/lib/editor-ref";
import { imagePreviewExtension } from "@/lib/editor-image-preview";
import { imageMarkdown } from "@/lib/llm/image";
import { toast } from "@/components/ui/toast";

/**
 * Wrap the current selection (or insert markers at cursor) with `left` /
 * `right` delimiters. Used by both the toolbar buttons and the keyboard
 * shortcuts, so behaviour stays identical regardless of how it's triggered.
 */
function wrapInView(view: EditorView, left: string, right: string): boolean {
  const sel = view.state.selection.main;
  const selected = sel.empty
    ? ""
    : view.state.doc.sliceString(sel.from, sel.to);
  view.dispatch({
    changes: { from: sel.from, to: sel.to, insert: left + selected + right },
    selection: { anchor: sel.from + left.length + selected.length },
  });
  return true;
}

/** Smart code wrap: inline when single line/empty, fenced block when multiline. */
function codeWrapInView(view: EditorView): boolean {
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
  return true;
}

const formatKeymap = keymap.of([
  { key: "Mod-b", run: (v) => wrapInView(v, "**", "**") },
  { key: "Mod-i", run: (v) => wrapInView(v, "*", "*") },
  { key: "Mod-e", run: (v) => codeWrapInView(v) },
]);

const baseExtensions = [
  markdown({ base: markdownLanguage, addKeymap: true }),
  EditorView.lineWrapping,
  formatKeymap,
  // Renders an inline thumbnail under every markdown image line. Resolves
  // `butea-media://<id>` against IndexedDB so locally-uploaded images show
  // up without leaving MD mode.
  imagePreviewExtension,
  // Explicit drawSelection extension — guarantees CM6 paints selection bars
  // across empty lines (so multi-paragraph selection looks continuous instead
  // of split into "blocks"). Without this, CM falls back to native ::selection
  // which leaves visible gaps over blank rows.
  drawSelection({ cursorBlinkRate: 1000 }),
  EditorView.theme(
    {
      "&": { fontSize: "14px", height: "100%" },
      ".cm-scroller": { fontFamily: "inherit" },
      // Crisp single-color selection that reads as one continuous range,
      // not a confused mosaic of blocks. Drawn by drawSelection, so it
      // covers empty lines too.
      "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
        {
          background: "rgba(234, 88, 12, 0.18) !important", // butea orange tint
        },
    },
    { dark: false }
  ),
];

export function MarkdownEditor() {
  const cmRef = React.useRef<ReactCodeMirrorRef>(null);
  const markdownValue = useWorkshop((s) => s.markdown);
  const setMarkdown = useWorkshop((s) => s.setMarkdown);
  const setSelection = useWorkshop((s) => s.setSelection);
  const [dragOver, setDragOver] = React.useState(false);

  // Belt-and-suspenders view registration:
  //   - onCreateEditor (JSX prop) fires synchronously when CM6 builds the view
  //   - useLayoutEffect re-registers once after mount as fallback
  //   - Cleanup on unmount (mode switch) clears the stale ref so toolbar
  //     buttons stop dispatching into a disposed editor.
  React.useLayoutEffect(() => {
    const view = cmRef.current?.view;
    if (view) setEditorView(view);
    return () => {
      setEditorView(null);
    };
  }, []);

  const onChange = React.useCallback(
    (val: string) => setMarkdown(val),
    [setMarkdown]
  );

  const onUpdate = React.useCallback(
    (view: EditorView) => {
      const sel = view.state.selection.main;
      if (!sel.empty) {
        setSelection(view.state.doc.sliceString(sel.from, sel.to));
      } else {
        setSelection("");
      }
    },
    [setSelection]
  );

  // Drag-and-drop into the editor area. Two source types:
  //   1. OS file drop (image files) — uploads to IDB, inserts markdown
  //   2. AssetsPanel asset drag — has `application/x-butea-media` MIME with
  //      the existing media id; insert a `butea-media://<id>` ref
  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);

    // (2) Asset drag from the panel
    const mediaId = e.dataTransfer.getData("application/x-butea-media");
    if (mediaId) {
      const plain = e.dataTransfer.getData("text/plain");
      const ref = plain || `![image](butea-media://${mediaId})`;
      insertAtCursor(ref + "\n\n");
      return;
    }

    // (1) OS file drop
    const files = Array.from(e.dataTransfer.files).filter((f) =>
      f.type.startsWith("image/")
    );
    if (files.length === 0) return;
    try {
      const mds = await Promise.all(
        files.map((file) =>
          imageMarkdown(file, file.name.replace(/\.[^.]+$/, ""))
        )
      );
      for (const md of mds) insertAtCursor(md + "\n\n");
    } catch (err) {
      console.error("[Butea] drop upload failed:", err);
      toast.error("图片导入失败", (err as Error).message);
    }
  };

  return (
    <div
      className="h-full w-full overflow-hidden bg-app-surface relative"
      onDragOver={(e) => {
        const types = e.dataTransfer.types;
        if (
          types.includes("Files") ||
          types.includes("application/x-butea-media")
        ) {
          e.preventDefault();
          setDragOver(true);
        }
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      <CodeMirror
        ref={cmRef}
        value={markdownValue}
        onChange={onChange}
        height="100%"
        onCreateEditor={(view) => setEditorView(view)}
        basicSetup={{
          lineNumbers: false,
          foldGutter: false,
          // Disabled: highlighting the active line confuses the user about
          // what's selected (the whole logical line — including wrapped
          // sub-rows — gets a background that looks like a Notion-style
          // block selection). Removing it makes character-level selection
          // feel precise.
          highlightActiveLine: false,
          highlightActiveLineGutter: false,
          autocompletion: false,
          searchKeymap: true,
        }}
        extensions={[
          ...baseExtensions,
          EditorView.updateListener.of((u) => {
            if (u.selectionSet) onUpdate(u.view);
          }),
        ]}
        style={{ height: "100%" }}
      />
      {dragOver && (
        <div className="absolute inset-0 z-10 bg-orange-50/90 dark:bg-orange-950/40 backdrop-blur-sm flex items-center justify-center pointer-events-none border-2 border-dashed border-orange-400 m-2 rounded-md">
          <div className="text-sm text-orange-700 dark:text-orange-300 font-medium">
            松开以插入图片
          </div>
        </div>
      )}
    </div>
  );
}
