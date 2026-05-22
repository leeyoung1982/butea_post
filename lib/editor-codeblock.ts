"use client";

import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

/**
 * TipTap extension that adds a language label (top-left) and a copy button
 * (top-right) to code blocks inside the editor, matching the publish output.
 */

const pluginKey = new PluginKey("codeBlockChrome");

export const CodeBlockChrome = Extension.create({
  name: "codeBlockChrome",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: pluginKey,
        props: {
          decorations(state) {
            const decorations: Decoration[] = [];
            state.doc.descendants((node, pos) => {
              if (node.type.name !== "codeBlock") return;
              const lang =
                (node.attrs as { language?: string }).language || "";
              const label = lang || "代码";

              // Add class to the code block node for padding-top
              decorations.push(
                Decoration.node(pos, pos + node.nodeSize, {
                  class: "code-block-chrome",
                })
              );

              // Widget at the start of the code block content
              decorations.push(
                Decoration.widget(
                  pos + 1, // inside the code block
                  (view) => {
                    const bar = document.createElement("div");
                    bar.className = "code-block-bar";
                    bar.contentEditable = "false";

                    const langSpan = document.createElement("span");
                    langSpan.className = "code-block-lang";
                    langSpan.textContent = label;
                    bar.appendChild(langSpan);

                    const copyBtn = document.createElement("button");
                    copyBtn.className = "code-block-copy";
                    copyBtn.type = "button";
                    copyBtn.title = "复制代码";
                    // Clipboard SVG icon (Lucide "clipboard")
                    const svgCopy = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg>`;
                    const svgCheck = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`;
                    copyBtn.innerHTML = svgCopy;
                    copyBtn.addEventListener("click", (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const text = node.textContent;
                      navigator.clipboard.writeText(text).then(() => {
                        copyBtn.innerHTML = svgCheck;
                        setTimeout(() => {
                          copyBtn.innerHTML = svgCopy;
                        }, 1500);
                      });
                    });
                    bar.appendChild(copyBtn);

                    return bar;
                  },
                  { side: -1, key: `code-chrome-${pos}` }
                )
              );
            });
            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },
});

/**
 * CSS for code block chrome inside the editor.
 */
export function codeBlockChromeCss(root: string): string {
  return `
${root} .code-block-chrome {
  position: relative;
  padding-top: 32px !important;
}
${root} .code-block-bar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 12px;
  pointer-events: auto;
  user-select: none;
  z-index: 1;
}
${root} .code-block-lang {
  font-size: 0.7em;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  opacity: 0.5;
}
${root} .code-block-copy {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border-radius: 4px;
  border: 1px solid rgba(128,128,128,0.2);
  background: transparent;
  color: inherit;
  opacity: 0.4;
  cursor: pointer;
  transition: opacity 0.15s;
}
${root} .code-block-copy:hover {
  opacity: 0.9;
}
`;
}
