"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Empty state — a structured placeholder for "nothing here yet" spots.
 *
 * Pattern: large icon · short title · explanation · optional CTA · optional tip.
 * Every empty surface in the app should use this for consistent voice.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  tip,
  className,
  density = "comfortable",
}: {
  icon: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  tip?: React.ReactNode;
  className?: string;
  density?: "compact" | "comfortable";
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center text-app-fg-muted",
        density === "compact" ? "px-4 py-6" : "px-6 py-10",
        className
      )}
    >
      <div
        className={cn(
          "rounded-full bg-app-surface-hover/60 flex items-center justify-center mb-3 text-app-fg-subtle",
          density === "compact" ? "w-9 h-9" : "w-12 h-12"
        )}
      >
        {icon}
      </div>
      <div
        className={cn(
          "font-medium text-app-fg",
          density === "compact" ? "text-xs" : "text-sm"
        )}
      >
        {title}
      </div>
      {description && (
        <div
          className={cn(
            "mt-1 leading-relaxed max-w-[260px]",
            density === "compact" ? "text-[10px]" : "text-[11px]"
          )}
        >
          {description}
        </div>
      )}
      {action && <div className="mt-3">{action}</div>}
      {tip && (
        <div
          className={cn(
            "mt-3 text-app-fg-subtle leading-relaxed max-w-[260px]",
            density === "compact" ? "text-[10px]" : "text-[11px]"
          )}
        >
          💡 {tip}
        </div>
      )}
    </div>
  );
}
