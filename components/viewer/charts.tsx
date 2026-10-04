"use client";

import React from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useChartTheme } from "@/hooks/useChartTheme";

/** Visually hidden table carrying the same numbers as a chart (charts themselves are hidden from assistive tech). */
function DataTable({ caption, headers, rows }: { caption: string; headers: string[]; rows: (string | number)[][] }) {
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

export function TrendChart({ data, caption }: { data: { label: string; reported: number; resolved: number }[]; caption: string }) {
  const chart = useChartTheme();
  const totals = data.reduce((t, d) => ({ reported: t.reported + d.reported, resolved: t.resolved + d.resolved }), { reported: 0, resolved: 0 });
  return (
    <figure>
      <figcaption className="sr-only">
        {caption}: {totals.reported} reported and {totals.resolved} resolved in total.
      </figcaption>
      <div className="h-56 w-full" aria-hidden="true">
        <ResponsiveContainer>
          <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid stroke={chart.grid} vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: chart.axis }} tickLine={false} axisLine={{ stroke: chart.grid }} interval="preserveStartEnd" minTickGap={24} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: chart.axis }} tickLine={false} axisLine={false} width={40} />
            <Tooltip contentStyle={chart.tooltip} labelStyle={chart.tooltipLabel} itemStyle={chart.tooltipItem} cursor={{ stroke: chart.grid }} />
            <Legend iconType="plainline" wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
            <Area type="monotone" dataKey="reported" name="Reported" stroke={chart.primary} strokeWidth={2} fill={chart.primarySoft} activeDot={{ r: 4 }} />
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
        <ResponsiveContainer>
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={chart.grid} horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11, fill: chart.axis }} tickLine={false} axisLine={false} allowDecimals={false} unit={unit} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: chart.axis }} tickLine={false} axisLine={false} width={96} />
            <Tooltip contentStyle={chart.tooltip} labelStyle={chart.tooltipLabel} itemStyle={chart.tooltipItem} cursor={{ fill: chart.cursor }} />
            <Bar dataKey="value" name={valueLabel} fill={chart.primary} radius={[0, 3, 3, 0]} barSize={14} unit={unit} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <DataTable caption={caption} headers={["Item", valueLabel]} rows={data.map((d) => [d.name, `${d.value}${unit}`])} />
    </figure>
  );
}

/** Labelled share bars — the number is always written next to the bar, so colour is never the only cue. */
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
