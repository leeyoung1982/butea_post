"use client";

import * as React from "react";
import * as Popover from "@radix-ui/react-popover";
import { Palette, Check } from "lucide-react";
import { THEMES } from "@/lib/themes/themes";
import { useWorkshop } from "@/lib/store";
import { cn } from "@/lib/utils";

export function ThemePicker() {
  const themeId = useWorkshop((s) => s.themeId);
  const setThemeId = useWorkshop((s) => s.setThemeId);
  const current = THEMES.find((t) => t.id === themeId) ?? THEMES[0];

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          className="flex items-center gap-1.5 px-2 py-1 rounded text-xs text-app-fg-muted hover:text-app-fg hover:bg-app-surface-hover transition-colors"
          title="切换文章主题"
        >
          <span
            className="w-3 h-3 rounded-full border border-app-border"
            style={{
              background: `linear-gradient(135deg, ${current.swatch[0]} 50%, ${current.swatch[1]} 50%)`,
            }}
          />
          <span className="hidden md:inline">{current.name}</span>
          <Palette size={11} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          className="z-50 w-[320px] bg-app-surface border border-app-border rounded-lg shadow-xl p-2 animate-fade-in"
        >
          <div className="px-2 py-1.5 text-[11px] text-app-fg-subtle uppercase tracking-wider">
            选择主题
          </div>
          <div className="grid grid-cols-1 gap-1">
            {THEMES.map((t) => {
              const active = t.id === themeId;
              return (
                <button
                  key={t.id}
                  onClick={() => setThemeId(t.id)}
                  className={cn(
                    "flex items-center gap-3 px-2.5 py-2 rounded-md text-left hover:bg-app-surface-hover transition-colors",
                    active && "bg-app-surface-hover"
                  )}
                >
                  <div className="flex -space-x-1">
                    {t.swatch.map((c, i) => (
                      <span
                        key={i}
                        className="w-5 h-5 rounded-full border border-app-border"
                        style={{ background: c }}
                      />
                    ))}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-app-fg">
                      {t.name}
                    </div>
                    <div className="text-[11px] text-app-fg-muted truncate">
                      {t.tagline}
                    </div>
                  </div>
                  {active && (
                    <Check size={14} className="text-app-fg shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
