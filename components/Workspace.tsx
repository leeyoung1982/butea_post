"use client";

import * as React from "react";
import {
  FileText,
  FolderOpen,
  Sparkles,
  Send,
  Cog,
  Image as ImageIcon,
  BookOpen,
} from "lucide-react";
import { VisualEditor } from "@/components/editor/VisualEditor";
import { Drawer } from "@/components/ui/Drawer";
import { ChatPanel } from "@/components/ai/ChatPanel";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { CurrentDocPanel } from "@/components/sidebar/CurrentDocPanel";
import { LibraryPanel } from "@/components/sidebar/LibraryPanel";
import { AssetsPanel } from "@/components/sidebar/AssetsPanel";
import { ObsidianPanel } from "@/components/sidebar/ObsidianPanel";
import { PublishCenter } from "@/components/publish/PublishCenter";
import { DocSync } from "@/lib/docs/sync";
import { ButeaLogo } from "@/components/brand/ButeaLogo";
import { useWorkshop } from "@/lib/store";
import { cn } from "@/lib/utils";

export function Workspace() {
  const aiOpen = useWorkshop((s) => s.aiOpen);
  const setAiOpen = useWorkshop((s) => s.setAiOpen);
  const sidebarPanel = useWorkshop((s) => s.sidebarPanel);
  const setSidebarPanel = useWorkshop((s) => s.setSidebarPanel);
  const markdown = useWorkshop((s) => s.markdown);
  const saveStatus = useWorkshop((s) => s.saveStatus);
  const obsidianVaultConnected = useWorkshop((s) => s.obsidianVaultConnected);

  const [settingsOpen, setSettingsOpen] = React.useState(false);

  const wordCount = markdown.replace(/\s/g, "").length;
  const firstHeading = markdown.match(/^#\s+(.+)/m)?.[1] ?? "未命名文档";

  return (
    <div className="h-screen w-screen flex flex-col bg-app-bg text-app-fg overflow-hidden">
      {/* Top bar */}
      <header className="h-10 shrink-0 border-b border-app-border flex items-center justify-between px-2.5 bg-app-surface">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex items-center gap-1.5 px-1">
            <ButeaLogo
              size={18}
              leafColor="#EA580C"
              nibColor="#0A0A0A"
              className="shrink-0"
            />
            <span className="text-[13px] font-semibold tracking-tight">
              Butea
            </span>
          </div>
          <div className="h-3.5 w-px bg-app-border" />
          <div className="flex items-center gap-1 text-xs text-app-fg-subtle truncate max-w-[300px]">
            <FileText size={11} className="shrink-0 opacity-60" />
            <span className="truncate">{firstHeading}</span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <span className="text-[11px] text-app-fg-subtle tabular-nums mr-2">
            {wordCount.toLocaleString()} 字
            {saveStatus === "saving" && " · 保存中..."}
            {saveStatus === "saved" && " · 已保存"}
          </span>
          <button
            onClick={() =>
              setSidebarPanel(sidebarPanel === "publish" ? null : "publish")
            }
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors",
              sidebarPanel === "publish"
                ? "bg-app-fg text-app-bg"
                : "text-app-fg hover:bg-app-surface-hover border border-app-border"
            )}
          >
            <Send size={11} />
            发布
          </button>
          <button
            onClick={() => setAiOpen(true)}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs text-app-fg hover:bg-app-surface-hover border border-app-border transition-colors"
            title="AI 副驾驶"
          >
            <Sparkles size={11} />
            副驾驶
          </button>
        </div>
      </header>

      <DocSync />

      {/* Main area */}
      <div className="flex-1 flex min-h-0">
        {/* Icon rail */}
        <nav className="w-12 shrink-0 border-r border-app-border bg-app-surface flex flex-col items-center py-2">
          <div className="flex flex-col items-center gap-1">
            <RailButton
              icon={<FolderOpen size={15} />}
              active={sidebarPanel === "library"}
              onClick={() =>
                setSidebarPanel(
                  sidebarPanel === "library" ? null : "library"
                )
              }
              label="文档库"
            />
            <RailButton
              icon={<FileText size={15} />}
              active={sidebarPanel === "current"}
              onClick={() =>
                setSidebarPanel(
                  sidebarPanel === "current" ? null : "current"
                )
              }
              label="本篇"
            />
            {obsidianVaultConnected && (
              <RailButton
                icon={<BookOpen size={15} />}
                active={sidebarPanel === "obsidian"}
                onClick={() =>
                  setSidebarPanel(
                    sidebarPanel === "obsidian" ? null : "obsidian"
                  )
                }
                label="Obsidian"
              />
            )}
            <RailButton
              icon={<ImageIcon size={15} />}
              active={sidebarPanel === "assets"}
              onClick={() =>
                setSidebarPanel(
                  sidebarPanel === "assets" ? null : "assets"
                )
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
          <aside className="w-[320px] shrink-0 border-r border-app-border bg-app-surface flex flex-col">
            {sidebarPanel === "current" && <CurrentDocPanel />}
            {sidebarPanel === "library" && <LibraryPanel />}
            {sidebarPanel === "obsidian" && <ObsidianPanel />}
            {sidebarPanel === "assets" && <AssetsPanel />}
            {sidebarPanel === "publish" && <PublishCenter />}
          </aside>
        )}

        {/* Editor — full width, immersive */}
        <main className="flex-1 min-w-0">
          <VisualEditor />
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
        description="选题、大纲、扩写、改稿、合规预检"
      >
        <ChatPanel />
      </Drawer>

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
