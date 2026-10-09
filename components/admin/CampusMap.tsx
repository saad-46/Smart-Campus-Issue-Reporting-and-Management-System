"use client";

import React, { useMemo, useRef, useState } from "react";
import { Minus, Plus, RotateCcw } from "lucide-react";
import geometry from "@/data/campuses/sues-hyderabad/geometry.json";
import { BUILDINGS, CAMPUS_GRID, project, VERIFICATION_LABELS } from "@/lib/campus";
import { Hotspot } from "@/lib/intelligence/analytics";
import { cn } from "@/lib/cn";
import { layoutLabels } from "@/lib/mapLabels";

type Metric = "open" | "total";

/** Which parts of the base map are drawn. Every toggle changes what is rendered. */
export interface MapLayers {
  /** Building footprints inside the mapped college outline (names and uses unverified). */
  footprints: boolean;
  /** Roads and paths. */
  roads: boolean;
  /** Mapped gates (not confirmed as official entrances). */
  gates: boolean;
  /** Neighbouring buildings, for orientation. */
  surroundings: boolean;
  /** Markers for the researched campus places. */
  places: boolean;
}

export const DEFAULT_LAYERS: MapLayers = { footprints: true, roads: true, gates: true, surroundings: true, places: true };

interface Feature {
  properties: { kind: string; osm?: string; name?: string; label?: string; access?: string; highway?: string };
  geometry: { type: string; coordinates: unknown };
}

const FEATURES = (geometry as unknown as { features: Feature[] }).features;

function ring(points: number[][]): string {
  return points.map(([lon, lat], i) => `${i ? "L" : "M"}${project(lon, lat).map((n) => n.toFixed(1)).join(" ")}`).join("");
}

/** Pre-projected SVG paths for each kind of feature (computed once). */
const SHAPES = FEATURES.map((f) => {
  const g = f.geometry;
  if (g.type === "Polygon") {
    const pts = (g.coordinates as number[][][])[0];
    const [cx, cy] = project(pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length);
    return { ...f.properties, d: `${ring(pts)}Z`, cx, cy };
  }
  if (g.type === "LineString") {
    const pts = g.coordinates as number[][];
    const mid = pts[Math.floor(pts.length / 2)];
    const [cx, cy] = project(mid[0], mid[1]);
    return { ...f.properties, d: ring(pts), cx, cy };
  }
  const [lon, lat] = g.coordinates as number[];
  const [cx, cy] = project(lon, lat);
  return { ...f.properties, d: "", cx, cy };
});

const of = (kind: string) => SHAPES.filter((s) => s.kind === kind);

/** Sequential indigo scale (theme-aware); 0 = neutral. */
function heatLevel(value: number, max: number): number {
  if (value <= 0 || max <= 0) return 0;
  return Math.max(1, Math.min(5, Math.ceil((value / max) * 5)));
}

const W = CAMPUS_GRID.width;
const H = CAMPUS_GRID.height;

/**
 * The SUES campus drawn from OpenStreetMap geometry (real footprints, roads and
 * gates; © OpenStreetMap contributors) with a marker for each researched place,
 * shaded by its issue count. Positions come from the dataset in
 * data/campuses/sues-hyderabad; a dashed ring shows how uncertain each one is.
 * No tiles or network requests: the geometry ships with the app.
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
  layers = DEFAULT_LAYERS,
}: {
  hotspots: Hotspot[];
  unplaced: number;
  selectedId?: string | null;
  onSelect?: (buildingId: string | null) => void;
  metric?: Metric;
  /** Place ids to emphasise (others are dimmed); undefined = all. */
  highlight?: Set<string>;
  compact?: boolean;
  /** Per-place values for a custom layer (overrides the open/total metric). */
  values?: Map<string, number>;
  /** What the values count, e.g. "overdue issue". Used in labels and the legend. */
  valueLabel?: string;
  layers?: MapLayers;
}) {
  const byId = useMemo(() => new Map(hotspots.map((h) => [h.buildingId, h])), [hotspots]);
  const valueOf = (h: Hotspot | undefined) => (values ? (h ? values.get(h.buildingId) ?? 0 : 0) : h ? (metric === "open" ? h.open : h.total) : 0);
  const max = Math.max(0, ...hotspots.map(valueOf));
  const metricLabel = valueLabel ?? (metric === "open" ? "open" : "total");
  const interactive = !!onSelect;

  // Zoom and pan by changing the viewBox; nothing is re-projected.
  const [view, setView] = useState({ k: 1, x: W / 2, y: H / 2 });
  const drag = useRef<{ px: number; py: number; x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const clamp = (v: { k: number; x: number; y: number }) => {
    const k = Math.min(5, Math.max(1, v.k));
    const hw = W / k / 2;
    const hh = H / k / 2;
    return { k, x: Math.min(W - hw, Math.max(hw, v.x)), y: Math.min(H - hh, Math.max(hh, v.y)) };
  };
  const zoom = (factor: number) => setView((v) => clamp({ ...v, k: v.k * factor }));
  const vw = W / view.k;
  const vh = H / view.k;
  const fontScale = 1 / Math.sqrt(view.k);

  const onPointerDown = (e: React.PointerEvent) => {
    if (compact || view.k === 1) return;
    drag.current = { px: e.clientX, py: e.clientY, x: view.x, y: view.y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    const el = svgRef.current;
    if (!d || !el) return;
    const scale = vw / el.clientWidth;
    setView((v) => clamp({ ...v, x: d.x - (e.clientX - d.px) * scale, y: d.y - (e.clientY - d.py) * scale }));
  };
  const endDrag = () => {
    drag.current = null;
  };
  // Keyboard: + and - zoom, 0 resets, arrow keys pan a zoomed map (focus is on a marker or the zoom buttons).
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (compact || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === "+" || e.key === "=") zoom(1.5);
    else if (e.key === "-") zoom(1 / 1.5);
    else if (e.key === "0") setView({ k: 1, x: W / 2, y: H / 2 });
    else if (view.k > 1 && e.key.startsWith("Arrow")) {
      const step = vw / 6;
      setView((v) => clamp({ ...v, x: v.x + (e.key === "ArrowRight" ? step : e.key === "ArrowLeft" ? -step : 0), y: v.y + (e.key === "ArrowDown" ? step : e.key === "ArrowUp" ? -step : 0) }));
    } else return;
    e.preventDefault();
  };

  const roadNames = of("road").filter((r) => r.name === "Road No. 3").slice(0, 1);

  // Marker sizes and collision-free label positions (see lib/mapLabels.ts).
  const radiusOf = (id: string) => ((compact ? 9 : 10) + (max > 0 ? (valueOf(byId.get(id)) / max) * 9 : 0)) * fontScale;
  const labelSize = 8.5 * fontScale;
  const labels = new Map(
    layoutLabels(
      BUILDINGS.map((b) => ({
        id: b.id,
        x: b.x,
        y: b.y,
        r: radiusOf(b.id),
        text: b.short,
        pinned: selectedId === b.id,
        priority: (highlight?.has(b.id) ? 1000 : 0) + valueOf(byId.get(b.id)),
      })),
      labelSize,
      { width: W, height: H }
    ).map((l) => [l.id, l])
  );

  return (
    <div>
      <div className="relative" onKeyDown={onKeyDown}>
        <svg
          ref={svgRef}
          viewBox={`${(view.x - vw / 2).toFixed(1)} ${(view.y - vh / 2).toFixed(1)} ${vw.toFixed(1)} ${vh.toFixed(1)}`}
          className={cn("h-auto w-full touch-pan-y rounded-lg border border-border bg-surface-2", view.k > 1 && !compact && "cursor-grab active:cursor-grabbing")}
          role="group"
          aria-label={valueLabel ? `SUES campus map, places shaded by ${valueLabel}` : `SUES campus map, places shaded by ${metricLabel} issues`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerLeave={endDrag}
        >
          <g aria-hidden="true" data-layer="base">
            {of("water").map((s) => (
              <path key={s.osm} d={s.d} fill="var(--info)" fillOpacity="0.14" />
            ))}
            {[...of("grass"), ...of("garden")].map((s) => (
              <path key={s.osm} d={s.d} fill="var(--success)" fillOpacity="0.1" stroke="var(--success)" strokeOpacity="0.25" strokeWidth="0.6" />
            ))}
            {layers.surroundings && (
              <g data-layer="surroundings">
                {of("building-context").map((s) => (
                  <path key={s.osm} d={s.d} fill="var(--border)" fillOpacity="0.55" />
                ))}
              </g>
            )}
            {layers.roads && (
              <g data-layer="roads" fill="none" strokeLinecap="round" strokeLinejoin="round">
                {of("road").map((s) => (
                  <path key={s.osm} d={s.d} stroke="var(--border-strong)" strokeWidth={s.highway === "primary" ? 7 : 3.2} />
                ))}
                {of("service-road").map((s) => (
                  <path key={s.osm} d={s.d} stroke="var(--border-strong)" strokeWidth="2" strokeOpacity="0.9" />
                ))}
                {of("path").map((s) => (
                  <path key={s.osm} d={s.d} stroke="var(--fg-subtle)" strokeWidth="1" strokeDasharray="3 3" />
                ))}
                {!compact &&
                  roadNames.map((s) => (
                    <text key={s.osm} x={s.cx} y={s.cy + 12 * fontScale} fontSize={8 * fontScale} textAnchor="middle" fill="var(--fg-subtle)">
                      Road No. 3
                    </text>
                  ))}
              </g>
            )}
            {of("campus-outline").map((s) => (
              <path key={s.osm} d={s.d} fill="var(--brand)" fillOpacity="0.05" stroke="var(--brand-fg)" strokeOpacity="0.55" strokeWidth="1.2" strokeDasharray="5 4" />
            ))}
            {of("institution-outline").map((s) => (
              <path key={s.osm} d={s.d} fill="none" stroke="var(--accent)" strokeOpacity="0.6" strokeWidth="1" strokeDasharray="2 3" />
            ))}
            {layers.footprints && (
              <g data-layer="footprints">
                {of("building").map((s) => (
                  <g key={s.osm}>
                    <path d={s.d} fill="var(--surface)" stroke="var(--fg-subtle)" strokeWidth="1" />
                    {!compact && (
                      <text x={s.cx} y={s.cy + 3 * fontScale} fontSize={8 * fontScale} textAnchor="middle" fill="var(--fg-subtle)" fontWeight="600">
                        {s.label?.replace("Mapped building ", "")}
                      </text>
                    )}
                  </g>
                ))}
              </g>
            )}
            {layers.gates && (
              <g data-layer="gates">
                {of("gate").map((s) => (
                  <rect key={s.osm} x={s.cx - 3} y={s.cy - 3} width="6" height="6" rx="1" transform={`rotate(45 ${s.cx} ${s.cy})`} fill="var(--warning)" stroke="var(--surface)" strokeWidth="1" />
                ))}
              </g>
            )}
          </g>

          {layers.places && (
            <g data-layer="places">
              {BUILDINGS.map((b) => {
                const h = byId.get(b.id);
                const value = valueOf(h);
                const level = heatLevel(value, max);
                const selected = selectedId === b.id;
                const dimmed = highlight && !highlight.has(b.id);
                const r = radiusOf(b.id);
                const placed = labels.get(b.id)!;
                const label = valueLabel
                  ? `${b.name}: ${value} ${valueLabel}${value === 1 ? "" : "s"}. ${VERIFICATION_LABELS[b.verificationStatus]}.`
                  : `${b.name}: ${value} ${metricLabel} issue${value === 1 ? "" : "s"}${h?.topCategory ? `, mostly ${h.topCategory}` : ""}. ${VERIFICATION_LABELS[b.verificationStatus]}.`;
                return (
                  <g
                    key={b.id}
                    role={interactive ? "button" : "img"}
                    tabIndex={interactive ? 0 : undefined}
                    aria-label={label}
                    aria-pressed={interactive ? selected : undefined}
                    data-place={b.id}
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
                    opacity={dimmed ? 0.3 : 1}
                    className={cn("group/place transition-opacity", interactive && "cursor-pointer outline-none [&:focus-visible>circle.marker]:stroke-[var(--fg)] [&:hover>circle.marker]:stroke-[var(--fg)]")}
                  >
                    <title>{label}</title>
                    {/* How far the true position may be from the marker. */}
                    <circle cx={b.x} cy={b.y} r={b.precisionMeters} fill="var(--brand)" fillOpacity={selected ? 0.12 : 0.04} stroke="var(--brand-fg)" strokeOpacity="0.35" strokeWidth="0.8" strokeDasharray="3 3" />
                    <circle
                      className="marker transition-[stroke]"
                      cx={b.x}
                      cy={b.y}
                      r={r}
                      fill={`var(--heat-${level})`}
                      stroke={selected ? "var(--fg)" : "var(--brand-fg)"}
                      strokeWidth={selected ? 2.2 : 1}
                    />
                    <text x={b.x} y={b.y + 4 * fontScale} textAnchor="middle" fontSize={11 * fontScale} fontWeight="700" fill={`var(--heat-ink-${level})`} aria-hidden="true">
                      {value > 0 ? value : ""}
                    </text>
                    {!compact && (
                      <text
                        x={placed.x}
                        y={placed.y}
                        textAnchor={placed.anchor}
                        fontSize={labelSize}
                        fontWeight={selected ? "700" : "600"}
                        fill="var(--fg)"
                        stroke="var(--surface-2)"
                        strokeWidth={2.4 * fontScale}
                        paintOrder="stroke"
                        aria-hidden="true"
                        data-label={b.id}
                        data-label-visible={placed.visible}
                        // A label with no free position is shown on hover or keyboard focus instead of on top of its neighbours.
                        className={placed.visible ? undefined : "opacity-0 transition-opacity group-hover/place:opacity-100 group-focus-visible/place:opacity-100"}
                      >
                        {b.short}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          )}
        </svg>

        {!compact && (
          <div className="glass-blur absolute right-2 top-2 flex flex-col overflow-hidden rounded-lg">
            {[
              { label: "Zoom in", icon: Plus, run: () => zoom(1.5), off: view.k >= 5 },
              { label: "Zoom out", icon: Minus, run: () => zoom(1 / 1.5), off: view.k <= 1 },
              { label: "Reset the map view", icon: RotateCcw, run: () => setView({ k: 1, x: W / 2, y: H / 2 }), off: view.k === 1 },
            ].map(({ label, icon: Icon, run, off }) => (
              <button
                key={label}
                type="button"
                aria-label={label}
                title={label}
                onClick={run}
                disabled={off}
                className="flex h-8 w-8 items-center justify-center text-fg-muted transition-colors hover:bg-surface-hover hover:text-fg disabled:opacity-35"
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-fg-subtle">
        <span className="flex items-center gap-2">
          <span>Fewer</span>
          <span aria-hidden="true" className="flex overflow-hidden rounded-sm border border-border">
            {[1, 2, 3, 4, 5].map((l) => (
              <span key={l} className="h-2.5 w-5" style={{ background: `var(--heat-${l})` }} />
            ))}
          </span>
          <span>More {valueLabel ? `${valueLabel}s` : `${metricLabel} issues`}</span>
        </span>
        {!compact && (
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="flex items-center gap-1">
              <span aria-hidden="true" className="h-3 w-3 rounded-full border border-dashed border-brand-fg" />
              Possible position
            </span>
            <span className="flex items-center gap-1">
              <span aria-hidden="true" className="h-2 w-2 rotate-45 bg-warning" />
              Mapped gate
            </span>
            <span>A–F: building, use not verified</span>
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-fg-subtle">
        Map data ©{" "}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-fg">
          OpenStreetMap contributors
        </a>{" "}
        (ODbL). Place positions are approximate.
      </p>
      {unplaced > 0 && (
        <p className="mt-1 text-xs text-fg-subtle">
          {unplaced} issue{unplaced === 1 ? "" : "s"} not placed: the location&apos;s position on campus isn&apos;t known, or the text didn&apos;t match a place.
        </p>
      )}
    </div>
  );
}
