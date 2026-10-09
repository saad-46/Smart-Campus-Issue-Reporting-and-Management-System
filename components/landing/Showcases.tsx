import React from "react";
import { Banknote, BellRing, CheckCircle2, CircleDashed, FilePlus2, Star, UserCheck, Wrench } from "lucide-react";
import CampusMap from "@/components/admin/CampusMap";
import Badge, { PriorityBadge, StatusBadge } from "@/components/ui/Badge";
import { BUILDINGS } from "@/lib/campus";
import type { Hotspot } from "@/lib/intelligence/analytics";
import { cn } from "@/lib/cn";

/** Each panel is a labelled, drawn illustration (sample data) of a real screen. */
function Panel({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <figure className={cn("glass depth-1 overflow-hidden rounded-2xl", className)}>
      <div role="img" aria-label={label}>
        <div aria-hidden="true">{children}</div>
      </div>
    </figure>
  );
}

export function IssuePanel() {
  const events = [
    { icon: FilePlus2, text: "Reported by a student · suggested Electrical, medium priority", at: "Yesterday 09:42" },
    { icon: UserCheck, text: "Assigned to Ramesh Kumar", at: "Yesterday 10:05" },
    { icon: Wrench, text: "Work started", at: "Yesterday 14:10" },
  ];
  return (
    <Panel label="An issue page showing status, a deadline meter that is nearly used up, and the timeline of recorded steps">
      <div className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-[11px] text-fg-subtle">SC-1136</span>
          <StatusBadge status="In Progress" />
          <PriorityBadge priority="Medium" />
          <Badge>Electrical</Badge>
        </div>
        <p className="text-base font-semibold text-fg">AC not cooling in the seminar hall</p>
        <div className="rounded-xl border border-glass-border bg-surface/60 p-3">
          <p className="flex items-center gap-1.5 text-xs font-medium text-warning">
            <CircleDashed className="h-3.5 w-3.5" />4h 0m left, due soon
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full w-[83%] rounded-full bg-warning" />
          </div>
          <p className="mt-1.5 text-[11px] text-fg-subtle">Target 24h for medium priority</p>
        </div>
        <ol className="space-y-3 border-l border-glass-border pl-5">
          {events.map(({ icon: Icon, text, at }) => (
            <li key={text} className="relative">
              <span className="absolute -left-[1.85rem] top-0 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-surface text-fg-muted">
                <Icon className="h-2.5 w-2.5" />
              </span>
              <p className="text-xs text-fg">{text}</p>
              <p className="text-[11px] text-fg-subtle">{at}</p>
            </li>
          ))}
        </ol>
      </div>
    </Panel>
  );
}

export function AnalyticsPanel() {
  const days = [4, 6, 5, 8, 7, 9, 6, 5, 9, 8, 11, 7, 10, 13];
  const cats = [
    ["Electrical", 34],
    ["Plumbing", 26],
    ["IT", 18],
    ["Infrastructure", 12],
  ] as const;
  return (
    <Panel label="Analytics: reports per day over two weeks and the share of reports by category">
      <div className="space-y-5 p-4 sm:p-5">
        <div>
          <p className="text-xs font-medium text-fg-muted">Reports per day</p>
          <div className="mt-2 flex h-28 items-end gap-1.5">
            {days.map((d, i) => (
              <span key={i} className="flex-1 rounded-t bg-gradient-to-t from-brand/50 to-accent" style={{ height: `${(d / 13) * 100}%` }} />
            ))}
          </div>
        </div>
        <div className="space-y-2.5">
          {cats.map(([name, pct]) => (
            <div key={name}>
              <div className="flex justify-between text-[11px]">
                <span className="text-fg">{name}</span>
                <span className="tabular text-fg-subtle">{pct}%</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
                <div className="h-full rounded-full bg-brand" style={{ width: `${pct * 2.4}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}

const SAMPLE_OPEN: Record<string, number> = { "blocks-1-2-5": 5, "blocks-3-4": 3, "ghulam-ahmed-hall": 1, "college-of-pharmacy": 2, "sports-grounds": 2, garden: 1 };

export function MapPanel() {
  const hotspots: Hotspot[] = BUILDINGS.map((b) => ({
    buildingId: b.id,
    name: b.name,
    total: (SAMPLE_OPEN[b.id] ?? 0) * 3,
    open: SAMPLE_OPEN[b.id] ?? 0,
    resolved: (SAMPLE_OPEN[b.id] ?? 0) * 2,
    topCategory: null,
    averageResolutionHours: null,
  }));
  return (
    <figure className="glass depth-1 rounded-2xl p-4 sm:p-5">
      <CampusMap hotspots={hotspots} unplaced={0} compact />
      <figcaption className="mt-3 text-center text-xs text-fg-subtle">The SUES campus at Mount Pleasant, drawn from OpenStreetMap, with sample counts</figcaption>
    </figure>
  );
}

export function AssignPanel() {
  const rows = [
    ["Ramesh Kumar", 95, "Resolved 5 Electrical issues · no active tasks"],
    ["Suresh Yadav", 75, "Resolved 4 Electrical issues · 1 active task"],
    ["Farhan Ali", 41, "No Electrical history yet · 2 active tasks"],
  ] as const;
  return (
    <Panel label="Ranked worker suggestions for an electrical issue, each with the reason for its score">
      <div className="space-y-2.5 p-4 sm:p-5">
        <p className="text-xs font-medium text-fg-muted">Suggested workers for Electrical</p>
        {rows.map(([name, score, reason], i) => (
          <div key={name} className={cn("rounded-xl border p-3", i === 0 ? "border-brand bg-brand-subtle" : "border-glass-border bg-surface/60")}>
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-fg">{name}</span>
              <span className="tabular text-fg-subtle">Match {score}%</span>
            </div>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full rounded-full bg-brand" style={{ width: `${score}%` }} />
            </div>
            <p className="mt-1.5 text-[11px] text-fg-subtle">{reason}</p>
          </div>
        ))}
      </div>
    </Panel>
  );
}

export function ActivityPanel() {
  const rows = [
    { icon: BellRing, title: "Work has started", body: "Projector not turning on in Room 104", at: "20 min ago", unread: true },
    { icon: CheckCircle2, title: "Your issue was resolved", body: "Leaking tap in the Hostel 2 washroom", at: "2 h ago", unread: true },
    { icon: Star, title: "How was the fix?", body: "Rate the resolution", at: "3 h ago", unread: false },
    { icon: Banknote, title: "Expense claim to review", body: "₹1,200 for wall brackets (sample)", at: "Yesterday", unread: false },
  ];
  return (
    <Panel label="A notification feed: work started, issue resolved, rating request and a claim awaiting review">
      <ul className="divide-y divide-border">
        {rows.map(({ icon: Icon, title, body, at, unread }) => (
          <li key={title} className={cn("flex items-start gap-3 px-4 py-3", unread && "bg-brand-subtle/50")}>
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-2 text-fg-muted">
              <Icon className="h-3.5 w-3.5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-medium text-fg">{title}</span>
              <span className="block truncate text-[11px] text-fg-subtle">{body}</span>
            </span>
            <span className="shrink-0 text-[11px] text-fg-subtle">{at}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
