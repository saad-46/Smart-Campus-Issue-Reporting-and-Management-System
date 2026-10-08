"use client";

import React, { useEffect, useRef, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/cn";

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Counts up to `value` once when it first appears (about half a second) and
 * eases to new values afterwards. With reduced motion the number is simply shown.
 */
export function AnimatedNumber({ value, format = (n) => Math.round(n).toLocaleString("en-IN"), duration = 600 }: { value: number; format?: (n: number) => string; duration?: number }) {
  const [shown, setShown] = useState(value);
  const from = useRef(0);
  const started = useRef(false);

  useEffect(() => {
    if (prefersReducedMotion() || typeof requestAnimationFrame !== "function") {
      from.current = value;
      setShown(value);
      return;
    }
    const start = started.current ? from.current : 0;
    started.current = true;
    const t0 = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const current = start + (value - start) * eased;
      from.current = current;
      setShown(current);
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    // A hidden tab never runs animation frames: land on the final value anyway.
    const settle = window.setTimeout(() => {
      from.current = value;
      setShown(value);
    }, duration + 400);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(settle);
    };
  }, [value, duration]);

  return (
    <span className="tabular">
      <span aria-hidden="true">{format(shown)}</span>
      <span className="sr-only">{format(value)}</span>
    </span>
  );
}

/** Tiny trend line for a KPI card (decorative: the number beside it carries the meaning). */
export function Sparkline({ data, className, tone = "brand" }: { data: number[]; className?: string; tone?: "brand" | "success" | "warning" | "danger" }) {
  const id = React.useId();
  if (data.length < 2) return null;
  const w = 100;
  const h = 28;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const span = max - min || 1;
  const points = data.map((v, i) => [(i / (data.length - 1)) * w, h - 3 - ((v - min) / span) * (h - 6)] as const);
  const line = points.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const color = { brand: "var(--brand-fg)", success: "var(--success)", warning: "var(--warning)", danger: "var(--danger)" }[tone];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={cn("h-7 w-full", className)} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L${w} ${h} L0 ${h} Z`} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export interface KpiTrend {
  /** Percentage change against the previous period; null when there is nothing to compare. */
  pct: number | null;
  /** Whether a rise is good news (resolved ↑) or bad news (overdue ↑). */
  upIsGood?: boolean;
  label?: string;
}

/** "↑ 12.4% vs last week", coloured by whether the direction is good. */
export function TrendPill({ trend }: { trend: KpiTrend }) {
  if (trend.pct === null) return <span className="text-xs text-fg-subtle">{trend.label ?? "No earlier period to compare"}</span>;
  const flat = Math.abs(trend.pct) < 0.05;
  const up = trend.pct > 0;
  const good = flat ? null : up === (trend.upIsGood ?? true);
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-fg-subtle">
      <span
        className={cn(
          "tabular inline-flex items-center gap-0.5 rounded-full border px-1.5 py-px font-medium",
          good === null ? "border-border bg-surface-2 text-fg-muted" : good ? "border-success-border bg-success-subtle text-success" : "border-danger-border bg-danger-subtle text-danger"
        )}
      >
        <Icon className="h-3 w-3" aria-hidden="true" />
        <span className="sr-only">{flat ? "No change" : up ? "Up" : "Down"} </span>
        {Math.abs(trend.pct).toLocaleString("en-IN", { maximumFractionDigits: 1 })}%
      </span>
      {trend.label ?? "vs last week"}
    </span>
  );
}

export interface KpiCardProps {
  label: string;
  /** A number is counted up; anything else is shown as given. */
  value: number | string | null;
  format?: (n: number) => string;
  icon?: React.ReactNode;
  trend?: KpiTrend;
  hint?: React.ReactNode;
  spark?: number[];
  tone?: "brand" | "success" | "warning" | "danger";
  loading?: boolean;
  className?: string;
}

/** A glass KPI tile: label, large figure, trend against the previous period and an optional sparkline. */
export function KpiCard({ label, value, format, icon, trend, hint, spark, tone = "brand", loading, className }: KpiCardProps) {
  const iconTone = {
    brand: "border-brand-subtle-border bg-brand-subtle text-brand-fg",
    success: "border-success-border bg-success-subtle text-success",
    warning: "border-warning-border bg-warning-subtle text-warning",
    danger: "border-danger-border bg-danger-subtle text-danger",
  }[tone];
  return (
    <div className={cn("glass lift relative flex min-w-0 flex-col overflow-hidden rounded-xl p-4", className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-subtle">{label}</p>
        {icon && <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border [&>svg]:h-4 [&>svg]:w-4", iconTone)}>{icon}</span>}
      </div>
      <p className="mt-1 text-[1.7rem] font-semibold leading-tight tracking-tight text-fg">
        {loading ? <span className="skeleton inline-block h-8 w-20 align-middle" aria-label="Loading" /> : value === null ? "—" : typeof value === "number" ? <AnimatedNumber value={value} format={format} /> : value}
      </p>
      <div className="mt-1 min-h-5">{trend ? <TrendPill trend={trend} /> : hint ? <span className="text-xs text-fg-subtle">{hint}</span> : null}</div>
      {trend && hint && <p className="mt-0.5 text-xs text-fg-subtle">{hint}</p>}
      {spark && spark.length > 1 && <Sparkline data={spark} tone={tone} className="mt-2" />}
    </div>
  );
}

export function KpiGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6", className)}>{children}</div>;
}
