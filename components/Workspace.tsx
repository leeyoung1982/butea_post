"use client";

import * as React from "react";
import {
  FileText,
  FolderOpen,
  Sparkles,
  Download,
  Cog,
  Image as ImageIcon,
} from "lucide-react";
import { Group, Panel, Separator } from "react-resizable-panels";
import { MarkdownEditor } from "@/components/editor/MarkdownEditor";
import { MediaToolbar } from "@/components/editor/MediaToolbar";
import { VisualEditor } from "@/components/editor/VisualEditor";
import { Preview } from "@/components/editor/Preview";
import { Drawer } from "@/components/ui/Drawer";
import { ChatPanel } from "@/components/ai/ChatPanel";
import { ExportDialog } from "@/components/publish/ExportDialog";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { CurrentDocPanel } from "@/components/sidebar/CurrentDocPanel";
import { LibraryPanel } from "@/components/sidebar/LibraryPanel";
import { AssetsPanel } from "@/components/sidebar/AssetsPanel";
import { DocSync } from "@/lib/docs/sync";
import { Button } from "@/components/ui/Button";
import { ButeaLogo } from "@/components/brand/ButeaLogo";
import { useWorkshop } from "@/lib/store";
import { cn } from "@/lib/utils";

export function Workspace() {
  const aiOpen = useWorkshop((s) => s.aiOpen);
  const setAiOpen = useWorkshop((s) => s.setAiOpen);
  const sidebarPanel = useWorkshop((s) => s.sidebarPanel);
  const setSidebarPanel = useWorkshop((s) => s.setSidebarPanel);
  const viewport = useWorkshop((s) => s.viewport);
  const setViewport = useWorkshop((s) => s.setViewport);
  const editorMode = useWorkshop((s) => s.editorMode);
  const setEditorMode = useWorkshop((s) => s.setEditorMode);
  const markdown = useWorkshop((s) => s.markdown);

  const [exportOpen, setExportOpen] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);

  const wordCount = markdown.replace(/\s/g, "").length;
  const firstHeading = markdown.match(/^#\s+(.+)/m)?.[1] ?? "未命名文档";

  return (
    <div className="h-screen w-screen flex flex-col bg-app-bg text-app-fg overflow-hidden">
      {/* Top bar — compact, low-chrome. Buttons default to ghost; only the
          editor pane keeps strong accent. */}
      <header className="h-10 shrink-0 border-b border-app-border flex items-center justify-between px-2.5 bg-app-surface">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex items-center gap-1.5 px-1">
            <ButeaLogo
              size={18}
              leafColor="#EA580C"
              nibColor="#0A0A0A"
              className="shrink-0"
            />
            <span className="text-[13px] font-semibold tracking-tight">Butea</span>
            <span className="text-[10px] text-app-fg-subtle hidden lg:inline italic">
              不负每一份灵感 · Live up to every inspiration
            </span>
          </div>
          <div className="h-3.5 w-px bg-app-border" />
          {/* Current-doc indicator — leading file icon makes it visually
              distinct from the brand slogan to its left. */}
          <div className="flex items-center gap-1 text-xs text-app-fg-subtle truncate max-w-[300px]">
            <FileText size={11} className="shrink-0 opacity-60" />
            <span className="truncate">{firstHeading}</span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Header keeps only the global actions; word count / viewport /
              theme moved into the preview pane where they belong. */}
          <button
            onClick={() => setExportOpen(true)}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs text-app-fg-muted hover:text-app-fg hover:bg-app-surface-hover transition-colors"
          >
            <Download size={11} />
            导出
          </button>
          <button
            onClick={() => setAiOpen(true)}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs text-app-fg hover:bg-app-surface-hover border border-app-border transition-colors"
            title="AI 副驾驶（对话型）"
          >
            <Sparkles size={11} />
            副驾驶
          </button>
        </div>
      </header>

      <DocSync />

      {/* Main */}
      <div className="flex-1 flex min-h-0">
        {/* Icon rail. Top: workflow icons. Bottom: global settings. */}
        <nav className="w-12 shrink-0 border-r border-app-border bg-app-surface flex flex-col items-center py-2">
          <div className="flex flex-col items-center gap-1">
            <RailButton
              icon={<FileText size={15} />}
              active={sidebarPanel === "current"}
              onClick={() =>
                setSidebarPanel(sidebarPanel === "current" ? null : "current")
              }
              label="本篇"
            />
            <RailButton
              icon={<FolderOpen size={15} />}
              active={sidebarPanel === "library"}
              onClick={() =>
                setSidebarPanel(sidebarPanel === "library" ? null : "library")
              }
              label="文档库"
            />
            <RailButton
              icon={<ImageIcon size={15} />}
              active={sidebarPanel === "assets"}
              onClick={() =>
                setSidebarPanel(sidebarPanel === "assets" ? null : "assets")
              }
              label="资产"
            />
          </div>
          <div className="flex-1" />
          <RailButton
            icon={<Cog size={15} />}
            active={settingsOpen}
            onClick={() => setSettingsOpen(true)}
            label="设置"
          />
        </nav>

        {/* Side panel */}
        {sidebarPanel && (
          <aside className="w-[280px] shrink-0 border-r border-app-border bg-app-surface flex flex-col">
            {sidebarPanel === "current" && <CurrentDocPanel />}
            {sidebarPanel === "library" && <LibraryPanel />}
            {sidebarPanel === "assets" && <AssetsPanel />}
          </aside>
        )}

        {/* Editor + Preview split — drag the divider to resize */}
        <main className="flex-1 min-w-0">
          <Group orientation="horizontal" id="butea-split" style={{ height: "100%" }}>
            <Panel defaultSize="50%" minSize="25%">
              <section className="h-full flex flex-col border-r border-app-border">
                <EditorPaneHeader
                  editorMode={editorMode}
                  setEditorMode={setEditorMode}
                />
                {editorMode === "markdown" && <MediaToolbar />}
                <div className="flex-1 min-h-0">
                  {editorMode === "markdown" ? <MarkdownEditor /> : <VisualEditor />}
                </div>
              </section>
            </Panel>
            <Separator className="w-1.5 bg-app-border hover:bg-app-fg-muted/40 transition-colors relative group cursor-col-resize">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-8 bg-app-fg-subtle/40 group-hover:bg-app-fg/40 rounded-full transition-colors" />
            </Separator>
            <Panel defaultSize="50%" minSize="25%">
              <section className="h-full flex flex-col">
                {/* Preview manages its own top bar (word count / viewport / theme) */}
                <div className="flex-1 min-h-0">
                  <Preview />
                </div>
              </section>
            </Panel>
          </Group>
        </main>
      </div>

      {/* AI drawer */}
      <Drawer
        open={aiOpen}
        onOpenChange={setAiOpen}
        side="right"
        width="420px"
        title={
          <span className="flex items-center gap-1.5">
            <Sparkles size={13} /> AI 副驾驶
          </span>
        }
        description="选题、大纲、扩写、改稿、合规预检 — 所有 skill 在下方折叠区。"
      >
        <ChatPanel />
      </Drawer>

      {/* Export dialog */}
      <ExportDialog open={exportOpen} onOpenChange={setExportOpen} />

      {/* Settings dialog */}
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}

function RailButton({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={cn(
        "w-9 h-9 rounded-md flex items-center justify-center transition-colors",
        active
          ? "bg-app-surface-hover text-app-fg"
          : "text-app-fg-muted hover:text-app-fg hover:bg-app-surface-hover"
      )}
    >
      {icon}
    </button>
  );
}

function PaneHeader({ label }: { label: string }) {
  return (
    <div className="h-7 shrink-0 px-3 flex items-center border-b border-app-border bg-app-surface text-[10px] tracking-[0.15em] text-app-fg-subtle uppercase">
      {label}
    </div>
  );
}

/** Editor pane header — includes the MD ↔ 可视 mode toggle (moved out of
 *  the top app bar so it sits next to the thing it actually controls). */
function EditorPaneHeader({
  editorMode,
  setEditorMode,
}: {
  editorMode: "markdown" | "visual";
  setEditorMode: (m: "markdown" | "visual") => void;
}) {
  return (
    <div className="h-7 shrink-0 px-2 flex items-center border-b border-app-border bg-app-surface">
      <div className="flex items-center bg-app-bg border border-app-border rounded p-0.5">
        <button
          onClick={() => setEditorMode("markdown")}
          className={cn(
            "px-2 py-0 rounded text-[11px] transition-colors",
            editorMode === "markdown"
              ? "bg-app-surface text-app-fg font-medium"
              : "text-app-fg-muted hover:text-app-fg"
          )}
          title="Markdown 源码模式"
        >
          MD
        </button>
        <button
          onClick={() => setEditorMode("visual")}
          className={cn(
            "px-2 py-0 rounded text-[11px] transition-colors",
            editorMode === "visual"
              ? "bg-app-surface text-app-fg font-medium"
              : "text-app-fg-muted hover:text-app-fg"
          )}
          title="可视编辑模式（适合不熟悉 Markdown 的用户）"
        >
          可视
        </button>
      </div>
    </div>
  );
}
