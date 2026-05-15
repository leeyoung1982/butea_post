"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export type DrawerSide = "right" | "left" | "bottom";

interface DrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  side?: DrawerSide;
  width?: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
}

export function Drawer({
  open,
  onOpenChange,
  side = "right",
  width = "440px",
  title,
  description,
  children,
}: DrawerProps) {
  const sideClasses: Record<DrawerSide, string> = {
    right: "top-0 right-0 h-full border-l",
    left: "top-0 left-0 h-full border-r",
    bottom: "bottom-0 left-0 right-0 border-t",
  };
  const animClasses: Record<DrawerSide, string> = {
    right:
      "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
    left:
      "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left",
    bottom:
      "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/20 z-40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          className={cn(
            "fixed bg-app-surface text-app-fg border-app-border shadow-xl z-50 flex flex-col",
            sideClasses[side],
            animClasses[side],
            "transition-transform duration-200 ease-out"
          )}
          style={
            side === "bottom"
              ? { height: width }
              : { width }
          }
        >
          {(title || description) && (
            <div className="px-5 py-4 border-b border-app-border flex items-start justify-between">
              <div>
                {title && (
                  <Dialog.Title className="text-sm font-semibold text-app-fg">
                    {title}
                  </Dialog.Title>
                )}
                {description && (
                  <Dialog.Description className="text-xs text-app-fg-muted mt-0.5">
                    {description}
                  </Dialog.Description>
                )}
              </div>
              <Dialog.Close asChild>
                <button
                  className="text-app-fg-subtle hover:text-app-fg p-1 rounded transition-colors"
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              </Dialog.Close>
            </div>
          )}
          <div className="flex-1 overflow-auto">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
