/**
 * Module-level reference to the active CodeMirror EditorView.
 *
 * The MarkdownEditor registers its view via `setEditorView` on mount; toolbar
 * components and dialogs call `insertAtCursor` / `replaceSelection` /
 * `wrapSelection` without needing prop-drilling or React refs through layers.
 *
 * Why not a React ref? The editor and the toolbar live in cousin subtrees
 * and the toolbar's actions may also be called from dialogs that aren't
 * children of either. A module-level ref keeps the API flat.
 */
import type { EditorView } from "@codemirror/view";
import type { Editor as TipTapEditor } from "@tiptap/react";

let activeView: EditorView | null = null;
let activeTipTap: TipTapEditor | null = null;

export function setEditorView(v: EditorView | null) {
  activeView = v;
}

export function getEditorView(): EditorView | null {
  // Note: callers must handle null (the editor may be unmounted when the
  // user toggles between Markdown/Visual modes, or before mount finishes).
  return activeView;
}

/** Register the TipTap editor when the Visual mode mounts. Cleared on
 *  unmount. Only one of (CM view, TipTap) is mounted at a time because
 *  the mode toggle swaps them. */
export function setTipTapEditor(e: TipTapEditor | null) {
  activeTipTap = e;
}

export function getTipTapEditor(): TipTapEditor | null {
  return activeTipTap;
}

/** Returns "visual" if TipTap is the currently active editor, else "md". */
export function activeMode(): "md" | "visual" {
  return activeTipTap ? "visual" : "md";
}

/**
 * Insert text at the current selection (replacing any selected range).
 * Cursor is positioned at the end of the inserted text. Works for whichever
 * editor (CodeMirror or TipTap) is currently mounted.
 */
export function insertAtCursor(text: string) {
  if (activeTipTap) {
    activeTipTap.chain().focus().insertContent(text).run();
    return;
  }
  const view = activeView;
  if (!view) return;
  const sel = view.state.selection.main;
  view.dispatch({
    changes: { from: sel.from, to: sel.to, insert: text },
    selection: { anchor: sel.from + text.length },
  });
  view.focus();
}

/** Read the currently-selected text from whichever editor is mounted. */
export function readActiveSelection(): { text: string; from: number; to: number } {
  if (activeTipTap) {
    const { from, to } = activeTipTap.state.selection;
    return {
      text: activeTipTap.state.doc.textBetween(from, to),
      from,
      to,
    };
  }
  const view = activeView;
  if (!view) return { text: "", from: 0, to: 0 };
  const sel = view.state.selection.main;
  return {
    text: sel.empty ? "" : view.state.doc.sliceString(sel.from, sel.to),
    from: sel.from,
    to: sel.to,
  };
}

/** Replace the snapshotted range with new text. For TipTap this is a
 *  current-selection replace (the snapshot is informational only). */
export function replaceRange(from: number, to: number, text: string) {
  if (activeTipTap) {
    activeTipTap
      .chain()
      .focus()
      .setTextSelection({ from, to })
      .insertContent(text)
      .run();
    return;
  }
  const view = activeView;
  if (!view) return;
  view.dispatch({
    changes: { from, to, insert: text },
    selection: { anchor: from + text.length },
  });
  view.focus();
}

/** Insert text on a new line below the current selection. */
export function insertBlockBelow(text: string) {
  const view = activeView;
  if (!view) return;
  const sel = view.state.selection.main;
  const doc = view.state.doc;
  const line = doc.lineAt(sel.from);
  const insertText = "\n\n" + text + "\n";
  view.dispatch({
    changes: { from: line.to, to: line.to, insert: insertText },
    selection: { anchor: line.to + insertText.length },
  });
  view.focus();
}

/** Insert text at the very top of the document (after frontmatter if any). */
export function insertAtTop(text: string) {
  const view = activeView;
  if (!view) return;
  const doc = view.state.doc;
  const firstLine = doc.line(1).text;
  let insertAt = 0;
  if (firstLine.trim() === "---") {
    for (let i = 2; i <= doc.lines; i++) {
      if (doc.line(i).text.trim() === "---") {
        // `+1` to move past the trailing newline, clamped so a doc whose
        // entire content IS `---\n---` doesn't compute a position past EOF.
        insertAt = Math.min(doc.line(i).to + 1, doc.length);
        break;
      }
    }
  }
  view.dispatch({
    changes: { from: insertAt, to: insertAt, insert: text + "\n\n" },
    selection: { anchor: insertAt + text.length },
  });
  view.focus();
}

/** Read the H1 title from the doc (used to seed AI cover prompts etc.) */
export function readH1Title(): string {
  const view = activeView;
  if (!view) return "";
  const m = /^#\s+(.+)$/m.exec(view.state.doc.toString());
  return m ? m[1].trim() : "";
}
