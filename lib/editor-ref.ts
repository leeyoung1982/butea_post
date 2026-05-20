/**
 * Module-level reference to the active TipTap editor.
 *
 * v0.5: TipTap is the sole editor surface. All toolbar components, dialogs,
 * and AI flows call these helpers without needing prop-drilling.
 */
import type { Editor as TipTapEditor } from "@tiptap/react";

let activeTipTap: TipTapEditor | null = null;

export function setTipTapEditor(e: TipTapEditor | null) {
  activeTipTap = e;
}

export function getTipTapEditor(): TipTapEditor | null {
  return activeTipTap;
}

/**
 * Insert text at the current selection (replacing any selected range).
 */
export function insertAtCursor(text: string) {
  if (!activeTipTap) return;
  activeTipTap.chain().focus().insertContent(text).run();
}

/** Read the currently-selected text. */
export function readActiveSelection(): {
  text: string;
  from: number;
  to: number;
} {
  if (!activeTipTap) return { text: "", from: 0, to: 0 };
  const { from, to } = activeTipTap.state.selection;
  return {
    text: activeTipTap.state.doc.textBetween(from, to),
    from,
    to,
  };
}

/** Replace a specific range with new text. */
export function replaceRange(from: number, to: number, text: string) {
  if (!activeTipTap) return;
  activeTipTap
    .chain()
    .focus()
    .setTextSelection({ from, to })
    .insertContent(text)
    .run();
}

/** Insert text on a new line below the current selection. */
export function insertBlockBelow(text: string) {
  if (!activeTipTap) return;
  const { to } = activeTipTap.state.selection;
  activeTipTap
    .chain()
    .focus()
    .setTextSelection(to)
    .insertContent("\n\n" + text + "\n")
    .run();
}

/** Insert text at the very top of the document. */
export function insertAtTop(text: string) {
  if (!activeTipTap) return;
  activeTipTap
    .chain()
    .focus()
    .setTextSelection(0)
    .insertContent(text + "\n\n")
    .run();
}

/** Read the H1 title from the doc. */
export function readH1Title(): string {
  if (!activeTipTap) return "";
  const doc = activeTipTap.state.doc;
  let title = "";
  doc.descendants((node) => {
    if (title) return false;
    if (node.type.name === "heading" && node.attrs.level === 1) {
      title = node.textContent.trim();
      return false;
    }
    return true;
  });
  return title;
}

// ---------------------------------------------------------------------------
// Legacy shims — keep exports so files that haven't been updated yet still
// compile. These are no-ops and will be removed once all callers migrate.
// ---------------------------------------------------------------------------

/** @deprecated No-op in v0.5. Use setTipTapEditor. */
export function setEditorView(_v: unknown) {}

/** @deprecated Always returns null in v0.5. */
export function getEditorView(): null {
  return null;
}

/** @deprecated Always returns "visual" in v0.5. */
export function activeMode(): "visual" {
  return "visual";
}
