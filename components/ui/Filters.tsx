"use client";

import React, { useState } from "react";
import { ChevronLeft, ChevronRight, Search, SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/cn";
import Button from "./Button";
import Drawer from "./Drawer";
import { controlBase } from "./Field";

export interface FilterChip {
  key: string;
  label: string;
  onRemove: () => void;
}

/**
 * One filtering pattern for every list: a search box and inline controls on
 * desktop, the same controls in a bottom sheet on phones, and removable
 * chips with "Clear all" for whatever is active.
 */
export function FilterBar({
  search,
  onSearch,
  searchLabel = "Search",
  placeholder = "Search…",
  children,
  chips = [],
  onClear,
  trailing,
  className,
  tour,
}: {
  search?: string;
  onSearch?: (value: string) => void;
  searchLabel?: string;
  placeholder?: string;
  /** The filter controls (Selects, segmented controls). */
  children?: React.ReactNode;
  chips?: FilterChip[];
  onClear?: () => void;
  /** Right-aligned extras (sort, export, view toggle). */
  trailing?: React.ReactNode;
  className?: string;
  tour?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={cn("space-y-2.5", className)} data-tour={tour}>
      <div className="flex flex-wrap items-center gap-2">
        {onSearch && (
          <div className="relative min-w-0 flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" aria-hidden="true" />
            <input
              type="search"
              value={search ?? ""}
              onChange={(e) => onSearch(e.target.value)}
              aria-label={searchLabel}
              placeholder={placeholder}
              maxLength={120}
              className={cn(controlBase, "h-9 border-border pl-8 pr-3")}
            />
          </div>
        )}
        {children && (
          <>
            <div className="hidden flex-wrap items-center gap-2 md:flex">{children}</div>
            <Button variant="secondary" className="md:hidden" onClick={() => setOpen(true)} icon={<SlidersHorizontal className="h-4 w-4" aria-hidden="true" />}>
              Filters
              {chips.length > 0 && <span className="tabular rounded-full bg-brand-subtle px-1.5 text-xs text-brand-fg">{chips.length}</span>}
            </Button>
          </>
        )}
        {trailing && <div className="ml-auto flex flex-wrap items-center gap-2">{trailing}</div>}
      </div>

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5" aria-label="Active filters">
          <span className="text-xs text-fg-subtle">
            Filters · {chips.length} active
          </span>
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={chip.onRemove}
              aria-label={`Remove filter: ${chip.label}`}
              className="inline-flex h-6 items-center gap-1 rounded-full border border-brand-subtle-border bg-brand-subtle pl-2 pr-1 text-xs font-medium text-brand-fg transition-colors hover:bg-surface-hover"
            >
              {chip.label}
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          ))}
          {onClear && (
            <button type="button" onClick={onClear} className="ml-1 text-xs font-medium text-fg-muted underline-offset-2 hover:text-fg hover:underline">
              Clear all
            </button>
          )}
        </div>
      )}

      {children && (
        <Drawer
          open={open}
          onClose={() => setOpen(false)}
          title="Filters"
          side="bottom"
          footer={
            <>
              {onClear && (
                <Button variant="secondary" className="flex-1" onClick={onClear}>
                  Clear all
                </Button>
              )}
              <Button className="flex-1" onClick={() => setOpen(false)}>
                Show results
              </Button>
            </>
          }
        >
          <div className="grid gap-3 p-4 [&_select]:w-full">{children}</div>
        </Drawer>
      )}
    </div>
  );
}

/** Page controls with a plain-language range ("21–40 of 129"). */
export function Pagination({ page, pageSize, total, onPage, className }: { page: number; pageSize: number; total: number; onPage: (page: number) => void; className?: string }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(page, pages);
  const from = total === 0 ? 0 : (current - 1) * pageSize + 1;
  const to = Math.min(total, current * pageSize);
  const nav = "inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-surface text-fg-muted transition-colors hover:bg-surface-hover hover:text-fg disabled:pointer-events-none disabled:opacity-40";
  return (
    <nav aria-label="Pagination" className={cn("flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-[13px] text-fg-subtle sm:px-5", className)}>
      <p className="tabular" aria-live="polite">
        {from}–{to} of {total}
      </p>
      <div className="flex items-center gap-1.5">
        <button type="button" className={nav} onClick={() => onPage(current - 1)} disabled={current <= 1} aria-label="Previous page">
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </button>
        <span className="tabular px-1">
          Page {current} of {pages}
        </span>
        <button type="button" className={nav} onClick={() => onPage(current + 1)} disabled={current >= pages} aria-label="Next page">
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}

/** Column header button for sortable tables (sets aria-sort on the th via the caller). */
export function SortButton({ label, active, direction, onClick }: { label: string; active: boolean; direction: "asc" | "desc"; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={cn("inline-flex items-center gap-1 rounded text-xs font-medium transition-colors hover:text-fg", active ? "text-fg" : "text-fg-subtle")}>
      {label}
      <span aria-hidden="true" className={cn("text-[10px]", !active && "opacity-40")}>
        {active ? (direction === "asc" ? "▲" : "▼") : "↕"}
      </span>
    </button>
  );
}
