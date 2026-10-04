"use client";

import React from "react";
import Link from "next/link";
import { Info, MapPin } from "lucide-react";
import Card from "@/components/ui/Card";
import { PriorityBadge, StatusBadge } from "@/components/ui/Badge";
import { Skeleton, SkeletonRows } from "@/components/ui/States";
import { SlaBadgeView } from "@/components/issue/SlaBadge";
import { DEFAULT_SLA_CONFIG } from "@/lib/intelligence/sla";
import { DemoIssue } from "@/lib/viewer/demoData";
import { formatRelative } from "@/lib/dates";
import { cn } from "@/lib/cn";
import { useViewer } from "./ViewerProvider";

/** States clearly that a page shows the fixed sample dataset. */
export function SampleNote({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <p className={cn("mb-6 flex items-start gap-2 rounded-md border border-border bg-surface px-3 py-2 text-[13px] text-fg-muted", className)}>
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-fg" aria-hidden="true" />
      <span>{children ?? "Sample data for exploring the product. Figures are computed from this sample, not from real campus records."}</span>
    </p>
  );
}

export function ViewerLoading() {
  return (
    <div aria-busy="true">
      <span className="sr-only" role="status">
        Loading the sample dataset
      </span>
      <Skeleton className="mb-2 h-7 w-56" />
      <Skeleton className="mb-6 h-4 w-80 max-w-full" />
      <Skeleton className="mb-6 h-24 w-full" />
      <SkeletonRows rows={4} />
    </div>
  );
}

/** One sample issue in a list; the title opens the read-only detail. */
export function DemoIssueRow({ issue, now, showAssignee, action }: { issue: DemoIssue; now: Date; showAssignee?: string; action?: React.ReactNode }) {
  const { openIssue } = useViewer();
  return (
    // Container query: rows sit in full-width lists and in narrow side cards, so lay out by the row's own width.
    <li className="@container relative px-4 py-3 transition-colors hover:bg-surface-hover sm:px-5">
      <div className="flex flex-col gap-2 @md:flex-row @md:items-start @md:justify-between">
        <div className="min-w-0">
          <h3 className="text-sm font-medium text-fg">
            <button
              type="button"
              onClick={() => openIssue(issue.id)}
              className="text-left after:absolute after:inset-0 after:content-[''] hover:text-brand-fg focus-visible:outline-none focus-visible:after:rounded-md focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:outline-brand"
            >
              {issue.title}
            </button>
          </h3>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[13px] text-fg-subtle">
            <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span>{issue.location}</span>
            <span aria-hidden="true">·</span>
            <span>{issue.category}</span>
            <span aria-hidden="true">·</span>
            <span>{formatRelative(issue.createdAt, now)}</span>
            {showAssignee && (
              <>
                <span aria-hidden="true">·</span>
                <span>{showAssignee}</span>
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 @md:shrink-0">
          <SlaBadgeView issue={issue} config={DEFAULT_SLA_CONFIG} now={now} compact />
          <PriorityBadge priority={issue.priority} />
          <StatusBadge status={issue.status} />
        </div>
      </div>
      {/* Above the row's stretched button so it stays clickable. */}
      {action && <div className="relative z-10 mt-2.5">{action}</div>}
    </li>
  );
}

export function DemoIssueList({
  issues,
  now,
  label,
  assigneeFor,
  actionFor,
}: {
  issues: DemoIssue[];
  now: Date;
  label: string;
  assigneeFor?: (i: DemoIssue) => string | undefined;
  actionFor?: (i: DemoIssue) => React.ReactNode;
}) {
  return (
    <ul aria-label={label} className="divide-y divide-border">
      {issues.map((i) => (
        <DemoIssueRow key={i.id} issue={i} now={now} showAssignee={assigneeFor?.(i)} action={actionFor?.(i)} />
      ))}
    </ul>
  );
}

/** Numbered steps of a workflow (wraps on small screens). */
export function WorkflowSteps({ steps, label }: { steps: { title: string; text?: string }[]; label: string }) {
  return (
    <ol aria-label={label} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(9rem,1fr))]">
      {steps.map((s, i) => (
        <li key={s.title} className="flex gap-3 rounded-md border border-border bg-surface p-3">
          <span className="tabular flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-subtle text-xs font-semibold text-brand-fg" aria-hidden="true">
            {i + 1}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-fg">{s.title}</p>
            {s.text && <p className="mt-0.5 text-[13px] text-fg-subtle">{s.text}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Low-key invitation to sign in for real actions. */
export function SignInHint({ children }: { children: React.ReactNode }) {
  return (
    <Card className="mt-6 flex flex-col gap-2 p-4 text-sm text-fg-muted sm:flex-row sm:items-center sm:justify-between">
      <span>{children}</span>
      <Link href="/login" className="font-medium text-brand-fg hover:underline">
        Sign in
      </Link>
    </Card>
  );
}
