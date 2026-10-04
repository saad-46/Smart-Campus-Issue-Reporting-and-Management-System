"use client";

import React from "react";
import { Banknote, CheckCircle2, CircleDot, FilePlus2, Link2, Star, UserCheck, Wrench, XCircle } from "lucide-react";
import { IssueEventType } from "@/types";
import Dialog from "@/components/ui/Dialog";
import Button from "@/components/ui/Button";
import Badge, { PriorityBadge, StatusBadge } from "@/components/ui/Badge";
import { DescriptionList } from "@/components/ui/Data";
import { SlaBadgeView, SlaMeterView } from "@/components/issue/SlaBadge";
import { DEFAULT_SLA_CONFIG } from "@/lib/intelligence/sla";
import { DemoData, DemoIssue, demoTimeline, technicianLabel } from "@/lib/viewer/demoData";
import { formatDate, formatRelative, formatTime } from "@/lib/dates";
import { currency } from "@/components/admin/Kpi";

const ICONS: Partial<Record<IssueEventType, React.ElementType>> = {
  reported: FilePlus2,
  linked: Link2,
  assigned: UserCheck,
  started: Wrench,
  resolved: CheckCircle2,
  claim_approved: Banknote,
  claim_rejected: XCircle,
  feedback: Star,
};

export function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`Rated ${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={n <= rating ? "h-4 w-4 fill-warning text-warning" : "h-4 w-4 text-border-strong"} aria-hidden="true" />
      ))}
    </span>
  );
}

/** Read-only detail of one sample issue: no reporter or worker identity, no photos, receipts or comments. */
export default function SampleIssueDialog({ issue, data, onClose }: { issue: DemoIssue | null; data: DemoData | null; onClose: () => void }) {
  const now = data?.now ?? new Date();
  const master = issue?.duplicateOf ? data?.issues.find((i) => i.id === issue.duplicateOf) : undefined;
  const related = issue && data ? data.issues.filter((i) => i.duplicateOf === issue.id) : [];

  return (
    <Dialog
      open={!!issue}
      onClose={onClose}
      title={issue?.title ?? "Sample issue"}
      description="Sample issue from the Viewer dataset — not a real report."
      size="lg"
      footer={<Button variant="secondary" onClick={onClose}>Close</Button>}
    >
      {issue && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusBadge status={issue.status} />
            <PriorityBadge priority={issue.priority} />
            <SlaBadgeView issue={issue} config={DEFAULT_SLA_CONFIG} now={now} compact />
            {issue.escalated && <Badge tone="danger">Escalated</Badge>}
          </div>

          <p className="text-sm text-fg">{issue.description}</p>

          <DescriptionList
            columns={2}
            items={[
              { label: "Category", value: issue.category },
              { label: "Location", value: issue.location },
              { label: "Reported", value: formatRelative(issue.createdAt, now) },
              { label: "Assigned to", value: issue.assignedTo ? `${technicianLabel(issue.assignedTo)} (sample)` : "Not assigned yet" },
              { label: "Deadline", value: <SlaMeterView issue={issue} config={DEFAULT_SLA_CONFIG} now={now} /> },
              {
                label: "Incident",
                value: master
                  ? `Linked to “${master.title}”`
                  : related.length
                  ? `${related.length + 1} reports of the same problem`
                  : "No related reports",
              },
            ]}
          />

          <section aria-labelledby="sample-timeline">
            <h3 id="sample-timeline" className="mb-2 text-sm font-semibold text-fg">
              Timeline
            </h3>
            <ol className="space-y-2.5 border-l border-border pl-4">
              {demoTimeline(issue).map((e, i) => {
                const Icon = ICONS[e.type] ?? CircleDot;
                return (
                  <li key={`${e.type}-${i}`} className="relative">
                    <span className="absolute -left-[1.6rem] top-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-surface">
                      <Icon className="h-3 w-3 text-fg-subtle" aria-hidden="true" />
                    </span>
                    <p className="text-sm text-fg">{e.text}</p>
                    <p className="text-xs text-fg-subtle">
                      {formatDate(e.at, { month: "short", day: "numeric" })} · {formatTime(e.at)}
                    </p>
                  </li>
                );
              })}
            </ol>
          </section>

          {issue.status === "Resolved" && (
            <section aria-labelledby="sample-resolution" className="rounded-md border border-border bg-surface-2/50 p-3">
              <h3 id="sample-resolution" className="text-sm font-semibold text-fg">
                Resolution
              </h3>
              <p className="mt-1 text-sm text-fg-muted">{issue.resolutionSummary || "Marked resolved by the assigned technician."}</p>
              {issue.claim && (
                <p className="mt-2 text-[13px] text-fg-subtle">
                  Expense claim: {currency(issue.claim.amount)} · {issue.claim.description} · {issue.claim.status === "pending" ? "awaiting admin review" : issue.claim.status}
                </p>
              )}
              <div className="mt-3 border-t border-border pt-3">
                <p className="text-[13px] text-fg-subtle">Reporter feedback</p>
                {issue.feedback ? (
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <Stars rating={issue.feedback.rating} />
                    {issue.feedback.comment && <span className="text-sm text-fg">“{issue.feedback.comment}”</span>}
                  </div>
                ) : (
                  <p className="mt-1 text-sm text-fg-muted">Not rated yet.</p>
                )}
              </div>
            </section>
          )}
        </div>
      )}
    </Dialog>
  );
}
