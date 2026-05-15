"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Skeleton loader — a pulsing gray block standing in for not-yet-loaded
 * content. Use for lists, cards, blocks of text. For binary "loading vs not",
 * prefer this over a centered spinner: it preserves layout and feels faster.
 */
export function Skeleton({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={cn(
        "animate-pulse rounded bg-app-surface-hover",
        className
      )}
      style={style}
      aria-hidden
    />
  );
}

/** A row that looks like a document list item — used while LibraryPanel is loading. */
export function SkeletonRow() {
  return (
    <div className="flex items-start gap-2 px-3 py-2">
      <Skeleton className="w-3 h-3 mt-0.5 rounded-sm" />
      <div className="flex-1 min-w-0 space-y-1.5">
        <Skeleton className="h-3 w-3/4" />
        <Skeleton className="h-2 w-1/2" />
      </div>
    </div>
  );
}

export function SkeletonList({ count = 4 }: { count?: number }) {
  return (
    <div>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  );
}
