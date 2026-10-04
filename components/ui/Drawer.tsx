"use client";

import React, { useId, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useOverlay } from "@/hooks/useOverlay";
import { cn } from "@/lib/cn";
import { IconButton } from "./Button";
import { usePortalReady } from "./Dialog";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  side?: "left" | "right" | "bottom";
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Visually hide the title row (still announced) — e.g. navigation drawers with their own header. */
  hideHeader?: boolean;
  className?: string;
}

/**
 * Side panel / bottom sheet for navigation, filters and contextual detail.
 * Same keyboard behaviour as Dialog (focus trap, Escape, focus return).
 */
export default function Drawer({ open, onClose, title, side = "right", children, footer, hideHeader, className }: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const ready = usePortalReady();
  useOverlay(open, panelRef, onClose);

  if (!open || !ready) return null;

  const position = {
    left: "inset-y-0 left-0 w-[min(20rem,86vw)] border-r animate-drawer-in-left",
    right: "inset-y-0 right-0 w-[min(26rem,92vw)] border-l animate-drawer-in-right",
    bottom: "inset-x-0 bottom-0 max-h-[85dvh] rounded-t-xl border-t animate-sheet-in",
  }[side];

  return createPortal(
    <div className="fixed inset-0 z-[70]">
      <div aria-hidden="true" className="absolute inset-0 bg-overlay animate-fade-in" onMouseDown={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn("absolute flex flex-col border-border bg-surface shadow-lg outline-none", position, className)}
      >
        {side === "bottom" && <div aria-hidden="true" className="mx-auto mt-2 h-1 w-10 rounded-full bg-border-strong" />}
        {hideHeader ? (
          <>
            <h2 id={titleId} className="sr-only">
              {title}
            </h2>
            <IconButton label="Close" size="sm" onClick={onClose} className="absolute right-2 top-3 z-10">
              <X className="h-4 w-4" aria-hidden="true" />
            </IconButton>
          </>
        ) : (
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <h2 id={titleId} className="text-[15px] font-semibold text-fg">
              {title}
            </h2>
            <IconButton label="Close" size="sm" onClick={onClose}>
              <X className="h-4 w-4" aria-hidden="true" />
            </IconButton>
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        {footer && <div className="flex gap-2 border-t border-border px-4 py-3">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}
