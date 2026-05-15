"use client";

import * as React from "react";
import { Check, AlertCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Minimal toast notification system. No external deps. Mount <ToastViewport />
 * once in the layout and call `toast.success / error / info` from anywhere.
 *
 * Why not pull in `sonner`? It's small (3 KB), but its CSS doesn't naturally
 * follow our token system and we'd need to override anyway. A 40-line custom
 * one stays on-brand and zero-dep.
 */

export type ToastKind = "success" | "error" | "info";

export type ToastInput = {
  kind?: ToastKind;
  title: string;
  description?: string;
  duration?: number; // ms, default 3000
};

type ToastRecord = ToastInput & { id: string; createdAt: number };

type Listener = (toasts: ToastRecord[]) => void;

const listeners = new Set<Listener>();
let toasts: ToastRecord[] = [];

function emit() {
  for (const l of listeners) l(toasts);
}

function push(input: ToastInput): string {
  const id = crypto.randomUUID();
  const rec: ToastRecord = { ...input, id, createdAt: Date.now() };
  toasts = [...toasts, rec];
  emit();
  const duration = input.duration ?? 3000;
  if (duration > 0) {
    setTimeout(() => dismiss(id), duration);
  }
  return id;
}

function dismiss(id: string) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export const toast = {
  success: (title: string, description?: string) =>
    push({ kind: "success", title, description }),
  error: (title: string, description?: string) =>
    push({ kind: "error", title, description, duration: 5000 }),
  info: (title: string, description?: string) =>
    push({ kind: "info", title, description }),
  show: push,
  dismiss,
};

/** Mount once near the app root. Renders the stack of active toasts. */
export function ToastViewport() {
  const [items, setItems] = React.useState<ToastRecord[]>([]);
  React.useEffect(() => {
    const fn: Listener = (next) => setItems(next);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);

  if (items.length === 0) return null;
  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {items.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
}

function ToastItem({ toast: t }: { toast: ToastRecord }) {
  return (
    <div
      role="status"
      className={cn(
        "pointer-events-auto flex items-start gap-2.5 min-w-[260px] max-w-[400px] px-3.5 py-2.5 rounded-lg border bg-app-surface shadow-lg animate-fade-in",
        t.kind === "success" && "border-emerald-300 dark:border-emerald-800",
        t.kind === "error" && "border-red-300 dark:border-red-800",
        t.kind === "info" && "border-app-border",
        !t.kind && "border-app-border"
      )}
    >
      <div
        className={cn(
          "shrink-0 mt-0.5",
          t.kind === "success" && "text-emerald-600",
          t.kind === "error" && "text-red-600",
          (t.kind === "info" || !t.kind) && "text-app-fg-muted"
        )}
      >
        {t.kind === "success" ? (
          <Check size={14} />
        ) : t.kind === "error" ? (
          <AlertCircle size={14} />
        ) : (
          <Info size={14} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-app-fg">{t.title}</div>
        {t.description && (
          <div className="text-[11px] text-app-fg-muted mt-0.5 leading-relaxed break-words">
            {t.description}
          </div>
        )}
      </div>
      <button
        onClick={() => toast.dismiss?.(t.id)}
        className="text-app-fg-subtle hover:text-app-fg p-0.5 -mt-0.5 -mr-1 shrink-0"
        aria-label="关闭"
      >
        <X size={12} />
      </button>
    </div>
  );
}

// Re-export `toast.dismiss` as a top-level fallback for the close button
// (it references the singleton on the same module).
(toast as unknown as { dismiss: typeof dismiss }).dismiss = dismiss;
