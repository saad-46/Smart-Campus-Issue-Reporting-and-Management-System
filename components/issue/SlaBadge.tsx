"use client";

import React from "react";
import { AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { IssueStatus, Priority, SlaConfig, SlaState } from "@/types";
import { useSlaConfig } from "@/hooks/useSlaConfig";
import { useNow } from "@/hooks/useNow";
import { computeSla, describeSla } from "@/lib/intelligence/sla";
import Badge, { BadgeTone } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";

type SlaInput = { createdAt: Date; priority: Priority; status: IssueStatus; resolvedAt?: Date };

const TONE: Record<SlaState, BadgeTone> = {
  "on-track": "neutral",
  approaching: "warning",
  breached: "danger",
  met: "success",
  missed: "neutral",
};

const SHORT: Record<SlaState, string> = {
  "on-track": "On track",
  approaching: "Due soon",
  breached: "Overdue",
  met: "Met target",
  missed: "Missed target",
};

/**
 * SLA state computed live from the issue's timestamps and the configured
 * targets (never stored). `compact` shows the state only; otherwise the
 * time left / overdue is included.
 */
export default function SlaBadge({ issue, compact = false }: { issue: SlaInput; compact?: boolean }) {
  const config = useSlaConfig();
  const now = useNow();
  return <SlaBadgeView issue={issue} config={config} now={now} compact={compact} />;
}

/** Presentational SLA badge for a given config and clock (no data access). */
export function SlaBadgeView({ issue, config, now, compact = false }: { issue: SlaInput; config: SlaConfig; now: Date; compact?: boolean }) {
  if (issue.createdAt.getTime() <= 0) return null;
  const sla = computeSla(issue, config, now);
  const detail = describeSla(sla);
  const icon =
    sla.state === "breached" || sla.state === "approaching" ? <AlertTriangle aria-hidden="true" /> : sla.state === "met" ? <CheckCircle2 aria-hidden="true" /> : <Clock aria-hidden="true" />;
  return (
    <Badge tone={TONE[sla.state]} icon={icon} title={`Target ${config.hours[issue.priority]}h for ${issue.priority} priority · ${detail}`}>
      <span className="sr-only">Deadline: </span>
      {compact || sla.state === "met" || sla.state === "missed" ? SHORT[sla.state] : detail}
    </Badge>
  );
}

/** Deadline panel: time left (or overdue) with a progress bar of the window used. */
export function SlaMeter({ issue }: { issue: SlaInput }) {
  const config = useSlaConfig();
  const now = useNow();
  return <SlaMeterView issue={issue} config={config} now={now} />;
}

/** Presentational deadline panel for a given config and clock (no data access). */
export function SlaMeterView({ issue, config, now }: { issue: SlaInput; config: SlaConfig; now: Date }) {
  if (issue.createdAt.getTime() <= 0) return null;
  const sla = computeSla(issue, config, now);
  const pct = Math.round(Math.min(1, sla.elapsedFraction) * 100);
  const bar =
    sla.state === "breached" || sla.state === "missed"
      ? "bg-danger"
      : sla.state === "approaching"
      ? "bg-warning"
      : sla.state === "met"
      ? "bg-success"
      : "bg-brand";
  const label =
    sla.state === "breached"
      ? `Overdue by ${describeSla(sla).replace(" overdue", "")}`
      : sla.state === "approaching"
      ? `${describeSla(sla)} — due soon`
      : describeSla(sla);
  return (
    <div>
      <p className={cn("flex items-center gap-1.5 text-sm font-medium", sla.state === "breached" ? "text-danger" : sla.state === "approaching" ? "text-warning" : "text-fg")}>
        {(sla.state === "breached" || sla.state === "approaching") && <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />}
        {label}
      </p>
      <div
        role="progressbar"
        aria-label="Share of the deadline used"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2"
      >
        <div className={cn("h-full rounded-full transition-[width] duration-300", bar)} style={{ width: `${Math.max(3, pct)}%` }} />
      </div>
      <p className="mt-1.5 text-xs text-fg-subtle">
        Target {config.hours[issue.priority]}h for {issue.priority.toLowerCase()} priority
        {issue.status !== "Resolved" && ` · due ${sla.deadline.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`}
      </p>
    </div>
  );
}
