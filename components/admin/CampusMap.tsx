"use client";

import React from "react";
import { BUILDINGS, CAMPUS_GRID } from "@/lib/campus";
import { Hotspot } from "@/lib/intelligence/analytics";
import { cn } from "@/lib/cn";

type Metric = "open" | "total";

/** Sequential blue scale (theme-aware); 0 = neutral. */
function heatLevel(value: number, max: number): number {
  if (value <= 0 || max <= 0) return 0;
  return Math.max(1, Math.min(5, Math.ceil((value / max) * 5)));
}

/**
 * Schematic campus map (layout grid, not GPS) shaded by issue count per
 * building. Buildings are keyboard-focusable buttons; `highlight` dims
 * buildings that don't match a search.
 */
export default function CampusMap({
  hotspots,
  unplaced,
  selectedId,
  onSelect,
  metric = "open",
  highlight,
  compact = false,
  values,
  valueLabel,
}: {
  hotspots: Hotspot[];
  unplaced: number;
  selectedId?: string | null;
  onSelect?: (buildingId: string | null) => void;
  metric?: Metric;
  /** Building ids to emphasise (others are dimmed); undefined = all. */
  highlight?: Set<string>;
  compact?: boolean;
  /** Per-building values for a custom layer (overrides the open/total metric). */
  values?: Map<string, number>;
  /** What the values count, e.g. "overdue issue". Used in labels and the legend. */
  valueLabel?: string;
}) {
  const byId = new Map(hotspots.map((h) => [h.buildingId, h]));
  const valueOf = (h: Hotspot | undefined) => (values ? (h ? values.get(h.buildingId) ?? 0 : 0) : h ? (metric === "open" ? h.open : h.total) : 0);
  const max = Math.max(0, ...hotspots.map(valueOf));
  const metricLabel = valueLabel ?? (metric === "open" ? "open" : "total");

  return (
    <div>
      <svg
        viewBox={`0 0 ${CAMPUS_GRID.width} ${CAMPUS_GRID.height}`}
        className="h-auto w-full rounded-md border border-border bg-surface-2"
        role="group"
        aria-label={valueLabel ? `Campus map, buildings shaded by ${valueLabel}` : `Campus map — buildings shaded by ${metricLabel} issues`}
      >
        <g aria-hidden="true" stroke="var(--border)" strokeWidth="0.6">
          <line x1="2" y1="19" x2="98" y2="19" />
          <line x1="2" y1="39" x2="98" y2="39" />
        </g>
        {BUILDINGS.map((b) => {
          const h = byId.get(b.id);
          const value = valueOf(h);
          const level = heatLevel(value, max);
          const selected = selectedId === b.id;
          const dimmed = highlight && !highlight.has(b.id);
          const label = valueLabel
            ? `${b.name}: ${value} ${valueLabel}${value === 1 ? "" : "s"}`
            : `${b.name}: ${value} ${metricLabel} issue${value === 1 ? "" : "s"}${h?.topCategory ? `, mostly ${h.topCategory}` : ""}`;
          const interactive = !!onSelect;
          return (
            <g
              key={b.id}
              role={interactive ? "button" : "img"}
              tabIndex={interactive ? 0 : undefined}
              aria-label={label}
              aria-pressed={interactive ? selected : undefined}
              onClick={interactive ? () => onSelect(selected ? null : b.id) : undefined}
              onKeyDown={
                interactive
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelect(selected ? null : b.id);
                      }
                    }
                  : undefined
              }
              opacity={dimmed ? 0.35 : 1}
              className={cn("transition-opacity", interactive && "cursor-pointer outline-none [&:focus-visible>rect]:stroke-[var(--brand-fg)] [&:hover>rect]:stroke-[var(--border-strong)]")}
            >
              <title>{label}</title>
              <rect
                x={b.x}
                y={b.y}
                width={b.w}
                height={b.h}
                rx="1"
                fill={`var(--heat-${level})`}
                stroke={selected ? "var(--brand-fg)" : "var(--border)"}
                strokeWidth={selected ? 0.8 : 0.4}
                className="transition-[stroke] duration-150"
              />
              {!compact || b.w >= 14 ? (
                <text x={b.x + 1.5} y={b.y + 3.6} fontSize="2.4" fontWeight="500" fill={`var(--heat-ink-${level})`} aria-hidden="true">
                  {b.short}
                </text>
              ) : null}
              {value > 0 && (
                <text x={b.x + b.w - 1.5} y={b.y + b.h - 1.6} textAnchor="end" fontSize="3.4" fontWeight="600" fill={`var(--heat-ink-${level})`} aria-hidden="true">
                  {value}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-fg-subtle">
        <span className="flex items-center gap-2">
          <span>Fewer</span>
          <span aria-hidden="true" className="flex overflow-hidden rounded-sm border border-border">
            {[1, 2, 3, 4, 5].map((l) => (
              <span key={l} className="h-2.5 w-5" style={{ background: `var(--heat-${l})` }} />
            ))}
          </span>
          <span>More {valueLabel ? `${valueLabel}s` : `${metricLabel} issues`}</span>
        </span>
        <span>Schematic layout — not to scale</span>
      </div>
      {unplaced > 0 && (
        <p className="mt-1 text-xs text-fg-subtle">
          {unplaced} issue{unplaced === 1 ? "" : "s"} couldn&apos;t be placed — the location text didn&apos;t match a building.
        </p>
      )}
    </div>
  );
}
