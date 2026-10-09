// ============================================
// Data display: KPI strip, tables, description lists, tooltips
// ============================================

import React from "react";
import { cn } from "@/lib/cn";
import { AnimatedNumber } from "./Kpi";

export interface Stat {
  label: string;
  value: React.ReactNode;
  /** Context line under the value (period, comparison, "not enough data"). */
  hint?: React.ReactNode;
  tone?: "default" | "warning" | "danger" | "success";
  loading?: boolean;
}

/**
 * KPIs as a row of glass tiles. Numbers count up once when they appear
 * (instantly with reduced motion). Wraps to a 2-column grid on phones.
 */
export function StatStrip({ stats, className }: { stats: Stat[]; className?: string }) {
  const cols = { 2: "lg:grid-cols-2", 3: "lg:grid-cols-3", 4: "lg:grid-cols-4", 5: "lg:grid-cols-5", 6: "lg:grid-cols-6" }[
    Math.min(6, Math.max(2, stats.length)) as 2 | 3 | 4 | 5 | 6
  ];
  return (
    <dl className={cn("grid grid-cols-2 gap-3 sm:grid-cols-3", cols, className)}>
      {stats.map((s) => (
        <div key={s.label} className="glass lift min-w-0 rounded-xl px-4 py-3.5 sm:px-5 sm:py-4">
          <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-subtle">{s.label}</dt>
          <dd
            className={cn(
              "tabular mt-1 text-xl font-semibold tracking-tight sm:text-2xl",
              s.tone === "danger" ? "text-danger" : s.tone === "warning" ? "text-warning" : s.tone === "success" ? "text-success" : "text-fg"
            )}
          >
            {s.loading ? (
              <span className="skeleton inline-block h-7 w-12 align-middle" aria-label="Loading" />
            ) : typeof s.value === "number" ? (
              <AnimatedNumber value={s.value} />
            ) : (
              s.value ?? "—"
            )}
          </dd>
          {s.hint && <p className="mt-0.5 text-xs text-fg-subtle">{s.hint}</p>}
        </div>
      ))}
    </dl>
  );
}

/** Table wrapper: horizontal scroll inside the card, never the page. */
export function TableWrap({ children, className, label }: { children: React.ReactNode; className?: string; label?: string }) {
  return (
    <div className={cn("relative overflow-x-auto", className)} role={label ? "region" : undefined} aria-label={label} tabIndex={label ? 0 : undefined}>
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  );
}

export const th = "h-9 whitespace-nowrap border-b border-border bg-surface-2/60 px-4 text-left text-xs font-medium text-fg-subtle";
export const td = "border-b border-border px-4 py-3 align-middle text-fg";
export const trHover = "transition-colors hover:bg-surface-hover";

/** Label/value pairs in a compact grid (issue details, claim details). */
export function DescriptionList({ items, className, columns = 1 }: { items: { label: string; value: React.ReactNode }[]; className?: string; columns?: 1 | 2 }) {
  return (
    <dl className={cn("grid gap-x-6 gap-y-3", columns === 2 && "sm:grid-cols-2", className)}>
      {items.map((item) => (
        <div key={item.label} className="flex items-baseline justify-between gap-4 sm:block">
          <dt className="text-[13px] text-fg-subtle">{item.label}</dt>
          <dd className="text-right text-sm text-fg sm:mt-0.5 sm:text-left">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Hover/focus tooltip for short explanations. The trigger keeps its own
 * accessible name; the tip text is also exposed via aria-describedby.
 */
export function Tooltip({ content, children, side = "top", className }: { content: string; children: React.ReactElement; side?: "top" | "bottom" | "right"; className?: string }) {
  const id = React.useId();
  return (
    <span className={cn("group/tip relative inline-flex", className)}>
      {React.cloneElement(children as React.ReactElement<{ "aria-describedby"?: string }>, { "aria-describedby": id })}
      <span
        role="tooltip"
        id={id}
        className={cn(
          "pointer-events-none absolute z-[70] w-max max-w-[16rem] rounded-md bg-fg px-2 py-1 text-xs text-canvas opacity-0 shadow-md transition-opacity duration-150",
          "group-hover/tip:opacity-100 group-focus-within/tip:opacity-100",
          side === "right" ? "left-full top-1/2 ml-2 -translate-y-1/2" : side === "top" ? "bottom-full left-1/2 mb-1.5 -translate-x-1/2" : "left-1/2 top-full mt-1.5 -translate-x-1/2"
        )}
      >
        {content}
      </span>
    </span>
  );
}
