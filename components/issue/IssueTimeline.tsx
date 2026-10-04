"use client";

import React, { useEffect, useRef, useState } from "react";
import { Banknote, CheckCircle2, CircleDot, FilePlus2, Link2, Star, UserCheck, Wrench, XCircle } from "lucide-react";
import { Issue, IssueEvent, IssueEventType } from "@/types";
import { buildTimeline, describeEvent, subscribeToIssueEvents } from "@/lib/timeline";
import { formatDate, formatTime } from "@/lib/dates";
import { logError } from "@/lib/errors";
import { cn } from "@/lib/cn";
import { SkeletonLines } from "@/components/ui/States";
import Panel from "./Panel";

const ICONS: Record<IssueEventType, React.ElementType> = {
  reported: FilePlus2,
  claimed: UserCheck,
  assigned: UserCheck,
  started: Wrench,
  resolved: CheckCircle2,
  claim_approved: Banknote,
  claim_rejected: XCircle,
  linked: Link2,
  feedback: Star,
};

const TONE: Partial<Record<IssueEventType, string>> = {
  resolved: "text-success border-success-border bg-success-subtle",
  claim_rejected: "text-danger border-danger-border bg-danger-subtle",
};

interface Entry {
  key: string;
  icon: React.ElementType;
  label: string;
  detail?: string;
  at?: Date;
  tone?: string;
  pending?: boolean;
  isNew?: boolean;
}

/**
 * Vertical timeline of real, recorded events. Lifecycle steps that haven't
 * happened yet are listed as "Pending" (never with invented times). Older
 * issues fall back to their own timestamps, labelled as such.
 */
export default function IssueTimeline({ issue }: { issue: Issue }) {
  const [events, setEvents] = useState<IssueEvent[] | null>(null);
  const [error, setError] = useState(false);
  const seen = useRef<Set<string> | null>(null);

  useEffect(() => {
    setEvents(null);
    setError(false);
    seen.current = null;
    return subscribeToIssueEvents(issue.id, setEvents, (err) => {
      logError("subscribeToIssueEvents", err);
      setError(true);
      setEvents([]);
    });
  }, [issue.id]);

  // Remember what was there on first load, so only later arrivals are highlighted.
  useEffect(() => {
    if (events && seen.current === null) seen.current = new Set(events.map((e) => e.id));
  }, [events]);

  const entries: Entry[] = [];
  let derived = false;
  if (events && events.length > 0) {
    for (const e of events) {
      const [label, ...rest] = describeEvent(e);
      entries.push({
        key: e.id,
        icon: ICONS[e.type],
        label,
        detail: rest.join(" "),
        at: e.createdAt,
        tone: TONE[e.type],
        isNew: seen.current !== null && !seen.current.has(e.id),
      });
    }
  } else if (events) {
    derived = true;
    for (const t of buildTimeline(issue, [])) {
      entries.push({ key: t.key, icon: t.key === "resolved" ? CheckCircle2 : t.key === "started" ? Wrench : FilePlus2, label: t.label, at: t.at });
    }
  }

  // Lifecycle steps still to come.
  if (events && issue.status !== "Resolved") {
    const hasAssignEvent = (events ?? []).some((e) => e.type === "assigned" || e.type === "claimed");
    if (!issue.assignedTo && !hasAssignEvent) entries.push({ key: "p-assign", icon: CircleDot, label: "Assigned to a worker", pending: true });
    if (issue.status === "Open") entries.push({ key: "p-start", icon: CircleDot, label: "Work started", pending: true });
    entries.push({ key: "p-resolve", icon: CircleDot, label: "Resolved", pending: true });
  }

  return (
    <Panel title="Timeline" description={derived ? "Reported before detailed history was recorded — showing the issue's own timestamps." : undefined}>
      {error && <p role="alert" className="mb-2 text-[13px] text-danger">The full timeline couldn&apos;t be loaded.</p>}
      {events === null ? (
        <SkeletonLines lines={4} />
      ) : (
        <ol className="relative">
          {entries.map((entry, i) => {
            const Icon = entry.icon;
            const last = i === entries.length - 1;
            return (
              <li key={entry.key} className={cn("relative flex gap-3 rounded-md pb-4 last:pb-0", entry.isNew && "animate-highlight")}>
                {!last && <span aria-hidden="true" className={cn("absolute left-[13px] top-7 bottom-0 w-px", entry.pending ? "border-l border-dashed border-border-strong" : "bg-border")} />}
                <span
                  aria-hidden="true"
                  className={cn(
                    "relative z-[1] flex h-7 w-7 shrink-0 items-center justify-center rounded-full border",
                    entry.pending ? "border-dashed border-border-strong bg-surface text-fg-subtle" : entry.tone ?? "border-border bg-surface-2 text-fg-muted"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 pt-1">
                  <p className={cn("text-sm", entry.pending ? "text-fg-subtle" : "text-fg")}>{entry.label}</p>
                  {entry.detail && <p className="text-[13px] text-fg-subtle">{entry.detail}</p>}
                  <p className="text-xs text-fg-subtle">
                    {entry.pending ? "Pending" : entry.at && <time dateTime={entry.at.toISOString()}>{formatDate(entry.at)} · {formatTime(entry.at)}</time>}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Panel>
  );
}
