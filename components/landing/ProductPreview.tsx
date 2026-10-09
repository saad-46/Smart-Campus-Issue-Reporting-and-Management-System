import React from "react";
import { AlarmClock, BarChart3, ListChecks, LayoutDashboard, Map as MapIcon, Users, UserCheck } from "lucide-react";
import { PriorityBadge, StatusBadge } from "@/components/ui/Badge";

const NAV = [
  { icon: LayoutDashboard, label: "Overview", active: true },
  { icon: ListChecks, label: "Issues" },
  { icon: BarChart3, label: "Analytics" },
  { icon: MapIcon, label: "Campus map" },
  { icon: Users, label: "Workers" },
];

const KPIS = [
  { label: "Open", value: "15", tone: "text-warning" },
  { label: "In progress", value: "5", tone: "text-brand-fg" },
  { label: "Resolved", value: "109", tone: "text-success" },
  { label: "SLA met", value: "86%", tone: "text-fg" },
];

const REPORTED = [3, 5, 4, 7, 6, 9, 5, 4, 8, 7, 10, 6, 9, 12];
const RESOLVED = [2, 4, 4, 5, 6, 7, 5, 4, 6, 8, 8, 6, 8, 10];

function line(values: number[], w: number, h: number, max: number) {
  return values.map((v, i) => `${i ? "L" : "M"}${((i / (values.length - 1)) * w).toFixed(1)} ${(h - 4 - (v / max) * (h - 10)).toFixed(1)}`).join(" ");
}

/**
 * A drawn, responsive stand-in for the product's admin overview (sample figures
 * that match the demo dataset's scale). It is decorative: the real thing is one
 * click away in the Viewer.
 */
export default function ProductPreview() {
  const w = 320;
  const h = 96;
  const max = 14;
  const reported = line(REPORTED, w, h, max);
  const resolved = line(RESOLVED, w, h, max);
  return (
    <figure className="stage-3d relative">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(closest-side,var(--glow),transparent)] lg:-inset-8" />
      <div role="img" aria-label="Preview of the Smart Campus administrator overview: open and resolved issue counts, a 14-day trend chart and the issues closest to their deadline" className="tilt-3d glass-blur depth-2 overflow-hidden rounded-2xl">
        <div className="flex items-center gap-1.5 border-b border-glass-border px-4 py-2.5" aria-hidden="true">
          <span className="h-2.5 w-2.5 rounded-full bg-danger/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-warning/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-success/70" />
          <span className="ml-3 hidden h-5 w-44 items-center rounded-md bg-surface-2/80 px-2 text-[10px] text-fg-subtle sm:flex">Search the demo…</span>
        </div>
        <div aria-hidden="true" className="grid grid-cols-[3rem_1fr] sm:grid-cols-[9.5rem_1fr]">
          <div className="space-y-1 border-r border-glass-border p-2 sm:p-3">
            {NAV.map(({ icon: Icon, label, active }) => (
              <div key={label} className={`flex h-8 items-center gap-2 rounded-lg px-2 text-[11px] ${active ? "bg-brand-subtle font-medium text-brand-fg ring-1 ring-brand-subtle-border" : "text-fg-subtle"}`}>
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden sm:inline">{label}</span>
              </div>
            ))}
          </div>
          <div className="min-w-0 space-y-3 p-3 sm:p-4">
            <div>
              <p className="text-[10px] text-fg-subtle">Estate Office</p>
              <p className="text-sm font-semibold text-fg">Campus operations</p>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {KPIS.map((k) => (
                <div key={k.label} className="rounded-lg border border-glass-border bg-surface/60 px-2 py-1.5 sm:px-2.5 sm:py-2">
                  <p className="truncate text-[8px] font-semibold uppercase tracking-wider text-fg-subtle sm:text-[9px]">{k.label}</p>
                  <p className={`mt-0.5 text-base font-semibold sm:text-lg ${k.tone}`}>{k.value}</p>
                </div>
              ))}
            </div>
            <div className="rounded-lg border border-glass-border bg-surface/50 p-2.5">
              <div className="flex items-center justify-between text-[10px] text-fg-subtle">
                <span className="font-medium text-fg-muted">Reported and resolved · 14 days</span>
                <span className="hidden gap-2 sm:flex">
                  <span className="flex items-center gap-1"><i className="h-1.5 w-3 rounded-full bg-brand" />Reported</span>
                  <span className="flex items-center gap-1"><i className="h-1.5 w-3 rounded-full bg-success" />Resolved</span>
                </span>
              </div>
              <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="mt-1.5 h-20 w-full sm:h-24">
                <defs>
                  <linearGradient id="pv-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="var(--brand)" stopOpacity="0.32" />
                    <stop offset="1" stopColor="var(--brand)" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {[24, 48, 72].map((y) => (
                  <line key={y} x1="0" x2={w} y1={y} y2={y} stroke="var(--chart-grid)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                ))}
                <path d={`${reported} L${w} ${h} L0 ${h} Z`} fill="url(#pv-fill)" />
                <path d={reported} fill="none" stroke="var(--brand)" strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                <path d={resolved} fill="none" stroke="var(--success)" strokeWidth="2" strokeDasharray="4 3" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
              </svg>
            </div>
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-fg-subtle">Closest to deadline</p>
              {[
                ["Water leaking near the ground-floor washroom", "Open", "High"],
                ["AC not cooling in the seminar hall", "In Progress", "Medium"],
              ].map(([title, status, priority]) => (
                <div key={title} className="flex items-center justify-between gap-2 rounded-lg border border-glass-border bg-surface/60 px-2.5 py-1.5">
                  <span className="min-w-0 truncate text-[11px] font-medium text-fg">{title}</span>
                  <span className="hidden shrink-0 gap-1 md:flex">
                    <StatusBadge status={status as "Open" | "In Progress"} />
                    <PriorityBadge priority={priority as "High" | "Medium"} />
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Two selective glass annotations, kept inside the frame on small screens. */}
      <div aria-hidden="true" className="glass-blur depth-2 absolute -bottom-5 left-3 hidden w-60 items-center gap-2.5 rounded-xl p-2.5 sm:flex lg:-left-6">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-success-border bg-success-subtle text-success">
          <UserCheck className="h-4 w-4" />
        </span>
        <span className="min-w-0 text-[11px] leading-tight">
          <span className="block font-semibold text-fg">Suggested worker · 95% match</span>
          <span className="block truncate text-fg-subtle">Resolved 5 similar issues, no active tasks</span>
        </span>
      </div>
      <div aria-hidden="true" className="glass-blur depth-2 absolute -right-2 -top-4 hidden items-center gap-2 rounded-xl px-3 py-2 sm:flex lg:-right-5">
        <AlarmClock className="h-4 w-4 text-warning" />
        <span className="text-[11px] font-semibold text-fg">4h 0m left · due soon</span>
      </div>
      <figcaption className="mt-8 text-center text-xs text-fg-subtle sm:text-right">Illustration with sample data. Open the live demo to use the real interface.</figcaption>
    </figure>
  );
}
