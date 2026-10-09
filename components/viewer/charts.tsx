"use client";

import React from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useChartTheme } from "@/hooks/useChartTheme";
import { cn } from "@/lib/cn";

/** Visually hidden table carrying the same numbers as a chart (charts themselves are hidden from assistive tech). */
export function DataTable({ caption, headers, rows }: { caption: string; headers: string[]; rows: (string | number)[][] }) {
  // sr-only goes on a wrapper: a table sizes itself to its content and would still widen the page.
  return (
    <div className="sr-only">
      <table>
        <caption>{caption}</caption>
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h} scope="col">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TrendChart({ data, caption, height = 224 }: { data: { label: string; reported: number; resolved: number }[]; caption: string; height?: number }) {
  const chart = useChartTheme();
  const totals = data.reduce((t, d) => ({ reported: t.reported + d.reported, resolved: t.resolved + d.resolved }), { reported: 0, resolved: 0 });
  return (
    <figure>
      <figcaption className="sr-only">
        {caption}: {totals.reported} reported and {totals.resolved} resolved in total.
      </figcaption>
      <div className="w-full" style={{ height }} aria-hidden="true">
        <ResponsiveContainer initialDimension={{ width: 320, height: 200 }}>
          <AreaChart accessibilityLayer={false} data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={chart.primary} stopOpacity={0.35} />
                <stop offset="100%" stopColor={chart.primary} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={chart.grid} vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: chart.axis }} tickLine={false} axisLine={{ stroke: chart.grid }} interval="preserveStartEnd" minTickGap={24} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: chart.axis }} tickLine={false} axisLine={false} width={40} />
            <Tooltip contentStyle={chart.tooltip} labelStyle={chart.tooltipLabel} itemStyle={chart.tooltipItem} cursor={{ stroke: chart.grid }} />
            <Legend iconType="plainline" wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
            <Area type="monotone" dataKey="reported" name="Reported" stroke={chart.primary} strokeWidth={2} fill="url(#trend-fill)" activeDot={{ r: 4 }} />
            <Area type="monotone" dataKey="resolved" name="Resolved" stroke={chart.secondary} strokeWidth={2} strokeDasharray="4 3" fill="transparent" activeDot={{ r: 4 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <DataTable caption={caption} headers={["Day", "Reported", "Resolved"]} rows={data.map((d) => [d.label, d.reported, d.resolved])} />
    </figure>
  );
}

/** Horizontal bar chart for a few labelled values (e.g. average hours per category). */
export function HorizontalBars({ data, caption, valueLabel, unit = "" }: { data: { name: string; value: number }[]; caption: string; valueLabel: string; unit?: string }) {
  const chart = useChartTheme();
  return (
    <figure>
      <figcaption className="sr-only">{caption}</figcaption>
      <div className="w-full" style={{ height: Math.max(140, data.length * 30 + 30) }} aria-hidden="true">
        <ResponsiveContainer initialDimension={{ width: 320, height: 200 }}>
          <BarChart accessibilityLayer={false} data={data} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={chart.grid} horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11, fill: chart.axis }} tickLine={false} axisLine={false} allowDecimals={false} unit={unit} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: chart.axis }} tickLine={false} axisLine={false} width={96} />
            <Tooltip contentStyle={chart.tooltip} labelStyle={chart.tooltipLabel} itemStyle={chart.tooltipItem} cursor={{ fill: chart.cursor }} />
            <Bar dataKey="value" name={valueLabel} fill={chart.primary} radius={[0, 4, 4, 0]} barSize={14} unit={unit} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <DataTable caption={caption} headers={["Item", valueLabel]} rows={data.map((d) => [d.name, `${d.value}${unit}`])} />
    </figure>
  );
}

/** Vertical stacked bars: one stack per item, one colour per series. */
export function StackedBars({
  data,
  series,
  caption,
  height = 240,
}: {
  data: Record<string, string | number>[];
  series: { key: string; name: string; color: string }[];
  caption: string;
  height?: number;
}) {
  const chart = useChartTheme();
  return (
    <figure>
      <figcaption className="sr-only">{caption}</figcaption>
      <div className="w-full" style={{ height }} aria-hidden="true">
        <ResponsiveContainer initialDimension={{ width: 320, height: 200 }}>
          <BarChart accessibilityLayer={false} data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid stroke={chart.grid} vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: chart.axis }} tickLine={false} axisLine={{ stroke: chart.grid }} interval={0} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: chart.axis }} tickLine={false} axisLine={false} width={40} />
            <Tooltip contentStyle={chart.tooltip} labelStyle={chart.tooltipLabel} itemStyle={chart.tooltipItem} cursor={{ fill: chart.cursor }} />
            <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
            {series.map((s, i) => (
              <Bar key={s.key} dataKey={s.key} name={s.name} stackId="a" fill={s.color} radius={i === series.length - 1 ? [4, 4, 0, 0] : 0} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <DataTable caption={caption} headers={["Item", ...series.map((s) => s.name)]} rows={data.map((d) => [String(d.name), ...series.map((s) => Number(d[s.key] ?? 0))])} />
    </figure>
  );
}

/** Donut with the share written next to every slice (colour is never the only cue). */
export function Donut({ data, caption, centerLabel, colors }: { data: { name: string; value: number }[]; caption: string; centerLabel?: string; colors?: string[] }) {
  const chart = useChartTheme();
  const palette = colors ?? chart.categorical;
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <figure className="flex flex-col items-center gap-4 sm:flex-row">
      <figcaption className="sr-only">{caption}</figcaption>
      <div className="relative h-44 w-44 shrink-0" aria-hidden="true">
        <ResponsiveContainer initialDimension={{ width: 320, height: 200 }}>
          <PieChart accessibilityLayer={false}>
            <Tooltip contentStyle={chart.tooltip} labelStyle={chart.tooltipLabel} itemStyle={chart.tooltipItem} />
            <Pie rootTabIndex={-1} data={data} dataKey="value" nameKey="name" innerRadius={52} outerRadius={78} paddingAngle={data.length > 1 ? 2 : 0} stroke="none">
              {data.map((d, i) => (
                <Cell key={d.name} fill={palette[i % palette.length]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="tabular text-xl font-semibold text-fg">{total}</span>
          {centerLabel && <span className="text-[11px] text-fg-subtle">{centerLabel}</span>}
        </div>
      </div>
      <ul className="min-w-0 flex-1 space-y-1.5 text-[13px]">
        {data.map((d, i) => (
          <li key={d.name} className="flex items-center gap-2">
            <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: palette[i % palette.length] }} />
            <span className="min-w-0 flex-1 truncate text-fg">{d.name}</span>
            <span className="tabular text-fg-muted">
              {d.value} <span className="text-fg-subtle">({total ? Math.round((d.value / total) * 100) : 0}%)</span>
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

/** Weekday × time-of-day grid; darker cells have more reports. Every cell states its count. */
export function Heatmap({ days, blocks, grid, max, caption }: { days: string[]; blocks: string[]; grid: number[][]; max: number; caption: string }) {
  const level = (v: number) => (v <= 0 || max <= 0 ? 0 : Math.max(1, Math.min(5, Math.ceil((v / max) * 5))));
  return (
    <figure>
      <figcaption className="sr-only">{caption}</figcaption>
      <div className="relative overflow-x-auto" role="region" aria-label={caption} tabIndex={0}>
        <table className="w-full min-w-[22rem] border-separate border-spacing-1 text-center text-xs">
          <thead>
            <tr>
              <td />
              {blocks.map((b) => (
                <th key={b} scope="col" className="pb-1 font-normal text-fg-subtle">
                  {b}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map((d, r) => (
              <tr key={d}>
                <th scope="row" className="pr-1 text-right font-normal text-fg-subtle">
                  {d}
                </th>
                {grid[r].map((v, c) => (
                  <td
                    key={c}
                    title={`${d} ${blocks[c]}: ${v} report${v === 1 ? "" : "s"}`}
                    className={cn("tabular h-8 rounded-md border border-glass-border text-[11px] font-medium")}
                    style={{ background: `var(--heat-${level(v)})`, color: `var(--heat-ink-${level(v)})` }}
                  >
                    {v || ""}
                    <span className="sr-only">
                      {" "}
                      {v} reports
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}

/** Labelled share bars: the number is always written next to the bar. */
export function ShareList({ items, label }: { items: { name: string; value: number; tone?: "brand" | "warning" | "danger" | "success" | "neutral" }[]; label: string }) {
  const total = items.reduce((s, i) => s + i.value, 0);
  const bar = { brand: "bg-brand", warning: "bg-warning", danger: "bg-danger", success: "bg-success", neutral: "bg-border-strong" };
  return (
    <ul aria-label={label} className="space-y-2.5">
      {items.map((i) => {
        const pct = total ? Math.round((i.value / total) * 100) : 0;
        return (
          <li key={i.name}>
            <div className="flex items-baseline justify-between gap-3 text-[13px]">
              <span className="text-fg">{i.name}</span>
              <span className="tabular text-fg-muted">
                {i.value} <span className="text-fg-subtle">({pct}%)</span>
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
              <div className={`h-full rounded-full ${bar[i.tone ?? "brand"]}`} style={{ width: `${Math.max(pct ? 2 : 0, pct)}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
