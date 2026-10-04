// ============================================
// Badges — semantic, compact, consistent
// ============================================
// Colour carries meaning only: neutral (default), info (brand),
// success, warning, danger. Status and priority map onto these tones.

"use client";

import React from "react";
import { IssueStatus, Priority } from "@/types";
import { cn } from "@/lib/cn";

export type BadgeTone = "neutral" | "info" | "success" | "warning" | "danger";

const tones: Record<BadgeTone, string> = {
  neutral: "bg-surface-2 text-fg-muted border-border",
  info: "bg-brand-subtle text-brand-fg border-brand-subtle-border",
  success: "bg-success-subtle text-success border-success-border",
  warning: "bg-warning-subtle text-warning border-warning-border",
  danger: "bg-danger-subtle text-danger border-danger-border",
};

const dots: Record<BadgeTone, string> = {
  neutral: "bg-fg-subtle",
  info: "bg-brand-fg",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
};

interface BadgeProps {
  tone?: BadgeTone;
  /** Small leading dot — used for live states (status, SLA). */
  dot?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  title?: string;
}

export default function Badge({ tone = "neutral", dot, icon, children, className, title }: BadgeProps) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex h-[22px] items-center gap-1.5 whitespace-nowrap rounded-full border px-2 text-xs font-medium",
        "[&>svg]:h-3 [&>svg]:w-3",
        tones[tone],
        className
      )}
    >
      {dot && <span aria-hidden="true" className={cn("h-1.5 w-1.5 rounded-full", dots[tone])} />}
      {icon}
      {children}
    </span>
  );
}

const STATUS_TONE: Record<IssueStatus, BadgeTone> = {
  Open: "info",
  "In Progress": "warning",
  Resolved: "success",
};

export function StatusBadge({ status, className }: { status: IssueStatus; className?: string }) {
  return (
    <Badge tone={STATUS_TONE[status]} dot className={className}>
      {status}
    </Badge>
  );
}

const PRIORITY_TONE: Record<Priority, BadgeTone> = { High: "danger", Medium: "warning", Low: "neutral" };

/** Priority as a quiet signal-bar indicator rather than a loud pill. */
export function PriorityBadge({ priority, className }: { priority: Priority; className?: string }) {
  const bars = priority === "High" ? 3 : priority === "Medium" ? 2 : 1;
  return (
    <Badge tone={PRIORITY_TONE[priority]} className={className} title={`${priority} priority`}>
      <span aria-hidden="true" className="flex items-end gap-[2px]">
        {[1, 2, 3].map((n) => (
          <span key={n} className={cn("w-[3px] rounded-[1px] bg-current", n <= bars ? "opacity-100" : "opacity-25")} style={{ height: 3 + n * 2 }} />
        ))}
      </span>
      {priority}
      <span className="sr-only"> priority</span>
    </Badge>
  );
}
