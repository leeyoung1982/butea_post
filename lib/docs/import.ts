"use client";

import TurndownService from "turndown";

/**
 * Convert a local file (markdown / text / html / docx) into markdown.
 *
 * Supported types — we explicitly DO NOT support PDF: PDF is a layout format
 * without semantic structure, and any PDF→MD conversion produces a flat blob
 * of text without proper headings, lists, tables. Better to copy/paste from
 * the PDF reader than mislead the user with a degraded import.
 */
export type ImportResult = {
  markdown: string;
  title: string;
  warnings?: string[];
};

const SUPPORTED_EXTS = [".md", ".markdown", ".txt", ".html", ".htm", ".docx"] as const;

export function isSupportedFile(name: string): boolean {
  const lower = name.toLowerCase();
  return SUPPORTED_EXTS.some((ext) => lower.endsWith(ext));
}

export const ACCEPT_ATTR = ".md,.markdown,.txt,.html,.htm,.docx";

export async function importFile(file: File): Promise<ImportResult> {
  const lower = file.name.toLowerCase();
  const baseTitle = file.name.replace(/\.[^.]+$/, "");

  if (lower.endsWith(".md") || lower.endsWith(".markdown") || lower.endsWith(".txt")) {
    const text = await file.text();
    return { markdown: text, title: pickTitle(text, baseTitle) };
  }

  if (lower.endsWith(".html") || lower.endsWith(".htm")) {
    const html = await file.text();
    const md = htmlToMarkdown(html);
    return { markdown: md, title: pickTitle(md, baseTitle) };
  }

  if (lower.endsWith(".docx")) {
    return importDocx(file, baseTitle);
  }

  throw new Error(
    `不支持的文件类型。支持：${SUPPORTED_EXTS.join(", ")}`
  );
}

/** First H1 in markdown, or fallback. */
function pickTitle(md: string, fallback: string): string {
  const m = /^#\s+(.+)$/m.exec(md);
  return m ? m[1].trim() : fallback;
}

// ====================================================================
// HTML → Markdown
// ====================================================================

let turndownInstance: TurndownService | null = null;

function getTurndown(): TurndownService {
  if (turndownInstance) return turndownInstance;
  const td = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
    emDelimiter: "*",
    strongDelimiter: "**",
  });
  // Better table support (turndown skips tables by default)
  td.addRule("table", {
    filter: ["table"],
    replacement: (_content, node) => {
      const table = node as HTMLTableElement;
      const rows = Array.from(table.rows);
      if (rows.length === 0) return "";
      const lines: string[] = [];
      rows.forEach((row, i) => {
        const cells = Array.from(row.cells).map((c) =>
          c.textContent?.trim().replace(/\|/g, "\\|") ?? ""
        );
        lines.push("| " + cells.join(" | ") + " |");
        if (i === 0) {
          lines.push("| " + cells.map(() => "---").join(" | ") + " |");
        }
      });
      return "\n\n" + lines.join("\n") + "\n\n";
    },
  });
  // Strip <style>/<script> entirely
  td.addRule("strip-noise", {
    filter: ["script", "style", "noscript", "iframe"] as TurndownService.Filter,
    replacement: () => "",
  });
  turndownInstance = td;
  return td;
}

export function htmlToMarkdown(html: string): string {
  // Strip <head> to avoid metadata bleeding into output
  const stripped = html.replace(/<head[\s\S]*?<\/head>/i, "");
  return getTurndown().turndown(stripped).trim();
}

// ====================================================================
// DOCX → Markdown (via mammoth → HTML → turndown)
// ====================================================================

type MammothBrowser = {
  convertToHtml: (input: { arrayBuffer: ArrayBuffer }) => Promise<{
    value: string;
    messages: { type: string; message: string }[];
  }>;
};

async function importDocx(file: File, baseTitle: string): Promise<ImportResult> {
  // Dynamic import keeps mammoth out of the initial bundle.
  const mod = (await import("mammoth/mammoth.browser")) as unknown as MammothBrowser;
  const arrayBuffer = await file.arrayBuffer();
  const result = await mod.convertToHtml({ arrayBuffer });
  const md = htmlToMarkdown(result.value);
  const warnings: string[] = [];
  if (result.messages?.length) {
    const dropped = result.messages
      .filter((m) => m.type === "warning")
      .slice(0, 5)
      .map((m) => m.message);
    if (dropped.length) warnings.push(...dropped);
  }
  // mammoth doesn't preserve images by default — flag if there were any
  if (/<img/i.test(result.value)) {
    warnings.push(
      "Word 文档中的内嵌图片暂未导入；请用工具栏「上传图片」逐一补回。"
    );
  }
  return {
    markdown: md,
    title: pickTitle(md, baseTitle),
    warnings: warnings.length ? warnings : undefined,
  };
}
