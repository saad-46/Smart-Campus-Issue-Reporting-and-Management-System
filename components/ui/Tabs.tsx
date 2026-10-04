"use client";

import React, { useRef } from "react";
import { cn } from "@/lib/cn";

interface Option<T extends string> {
  value: T;
  label: React.ReactNode;
  count?: number;
}

/** id of the tab button for `value` (pair with Tabs' panelId). */
export function tabId(panelId: string, value: string): string {
  return `${panelId}-tab-${value}`;
}

/**
 * Underline tabs for switching views of the same page (role="tablist"
 * with arrow-key navigation). Scrolls horizontally on narrow screens.
 */
export function Tabs<T extends string>({
  value,
  onChange,
  options,
  label,
  panelId,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: Option<T>[];
  label: string;
  /** id of the element showing the active view; give it role="tabpanel" and aria-labelledby={tabId(panelId, value)}. */
  panelId?: string;
  className?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: React.KeyboardEvent, index: number) => {
    let next = -1;
    if (e.key === "ArrowRight") next = (index + 1) % options.length;
    if (e.key === "ArrowLeft") next = (index - 1 + options.length) % options.length;
    if (next >= 0) {
      e.preventDefault();
      refs.current[next]?.focus();
      onChange(options[next].value);
    }
  };
  return (
    <div role="tablist" aria-label={label} className={cn("no-scrollbar -mx-1 flex gap-1 overflow-x-auto border-b border-border px-1", className)}>
      {options.map((o, i) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={panelId ? tabId(panelId, o.value) : undefined}
            aria-controls={panelId && active ? panelId : undefined}
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKey(e, i)}
            className={cn(
              "relative -mb-px flex h-10 shrink-0 items-center gap-2 border-b-2 px-2.5 text-sm font-medium transition-colors",
              active ? "border-brand text-fg" : "border-transparent text-fg-subtle hover:text-fg hover:border-border-strong"
            )}
          >
            {o.label}
            {o.count !== undefined && (
              <span className={cn("tabular rounded-full px-1.5 text-xs", active ? "bg-brand-subtle text-brand-fg" : "bg-surface-2 text-fg-subtle")}>
                {o.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Compact segmented control for small option sets (view toggles, presets). */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  size = "md",
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: Option<T>[];
  label: string;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={cn("inline-flex rounded-md border border-border bg-surface-2 p-0.5", className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-[5px] font-medium transition-[background-color,color,box-shadow] duration-150",
              size === "sm" ? "h-7 px-2.5 text-[13px]" : "h-8 px-3 text-sm",
              active ? "bg-surface text-fg shadow-xs" : "text-fg-subtle hover:text-fg"
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
