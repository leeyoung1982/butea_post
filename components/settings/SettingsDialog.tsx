"use client";

import * as React from "react";
import { Cog, Sparkles, Image as ImageIcon, Info } from "lucide-react";
import { AppDialog } from "@/components/ui/Dialog";
import { SettingsForm } from "@/components/ai/SettingsForm";
import { ImageHostPanel } from "@/components/publish/ImageHostPanel";
import {
  loadSettings,
  saveSettings,
  type LLMSettings,
} from "@/lib/llm/providers";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

type Section = "llm" | "image" | "about";

/**
 * Global settings — opened from the rail-bottom cog icon. Houses anything
 * that's not document- or platform-specific: LLM provider, image host,
 * About info. Future home for theme + locale + keyboard map etc.
 */
export function SettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [section, setSection] = React.useState<Section>("llm");
  const [llmSettings, setLlmSettings] = React.useState<LLMSettings | null>(
    null
  );

  React.useEffect(() => {
    if (open) setLlmSettings(loadSettings());
  }, [open]);

  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      title={
        <span className="flex items-center gap-2">
          <Cog size={14} /> 设置
        </span>
      }
      description="LLM 配置 · 图床 · 关于"
    >
      <div className="flex min-h-[440px]">
        {/* Sidebar */}
        <nav className="w-[160px] shrink-0 border-r border-app-border bg-app-bg py-3">
          <NavItem active={section === "llm"} onClick={() => setSection("llm")}>
            <Sparkles size={13} /> LLM 配置
          </NavItem>
          <NavItem
            active={section === "image"}
            onClick={() => setSection("image")}
          >
            <ImageIcon size={13} /> 图床
          </NavItem>
          <NavItem
            active={section === "about"}
            onClick={() => setSection("about")}
          >
            <Info size={13} /> 关于
          </NavItem>
        </nav>

        {/* Body */}
        <div className="flex-1 p-5 overflow-auto">
          {section === "llm" && (
            <SettingsForm
              initial={llmSettings}
              onSave={(s) => {
                saveSettings(s);
                setLlmSettings(s);
                toast.success(
                  "LLM 配置已保存",
                  `${s.providerId} · ${s.model}`
                );
                onOpenChange(false);
              }}
            />
          )}
          {section === "image" && <ImageHostPanel />}
          {section === "about" && <AboutSection />}
        </div>
      </div>
    </AppDialog>
  );
}

function NavItem({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-2 px-4 py-2 text-sm transition-colors text-left",
        active
          ? "bg-app-surface text-app-fg border-r-2 border-app-fg"
          : "text-app-fg-muted hover:text-app-fg hover:bg-app-surface-hover"
      )}
    >
      {children}
    </button>
  );
}

function AboutSection() {
  return (
    <div className="text-sm space-y-3 text-app-fg-muted leading-relaxed">
      <div>
        <div className="text-base font-semibold text-app-fg">Butea</div>
        <div className="text-xs text-app-fg-muted italic">
          Rooted ideas, Branching out.
        </div>
      </div>
      <p>
        AI 原生的开源内容创作 OS。一稿写完，AI 把它原生化到每个平台 ——
        改结构、改语气、改排版，不动语言。
      </p>
      <div className="border-t border-app-border pt-3 text-xs space-y-1">
        <div>
          <span className="text-app-fg-subtle">版本:</span> v0.4 (Phase 2)
        </div>
        <div>
          <span className="text-app-fg-subtle">License:</span> MIT
        </div>
        <div>
          <span className="text-app-fg-subtle">模式:</span> BYOK ·
          数据存在你浏览器或自托管服务器
        </div>
      </div>
    </div>
  );
}
