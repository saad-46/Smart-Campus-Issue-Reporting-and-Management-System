import React from "react";
import { Banknote, CheckCircle2, CircleDashed, FilePlus2, Link2, Star, UserCheck, Wrench, XCircle } from "lucide-react";
import { IssueEventType } from "@/types";
import { DemoEvent } from "@/lib/viewer/demoData";
import { formatDate, formatTime } from "@/lib/dates";
import { cn } from "@/lib/cn";

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
  claim_approved: "text-success border-success-border bg-success-subtle",
  claim_rejected: "text-danger border-danger-border bg-danger-subtle",
};

/** Vertical timeline of the events an issue has recorded; the next expected step is shown as pending (never with an invented time). */
export function EventTimeline({ events, pending, label = "Issue timeline" }: { events: DemoEvent[]; pending?: string; label?: string }) {
  return (
    <ol aria-label={label} className="relative space-y-4 border-l border-glass-border pl-6">
      {events.map((e, i) => {
        const Icon = ICONS[e.type];
        return (
          <li key={`${e.type}-${i}`} className="relative">
            <span className={cn("absolute -left-[2.0625rem] top-0 flex h-6 w-6 items-center justify-center rounded-full border bg-surface text-fg-muted ring-4 ring-canvas", TONE[e.type])}>
              <Icon className="h-3 w-3" aria-hidden="true" />
            </span>
            <p className="text-sm text-fg">{e.text}</p>
            <p className="text-xs text-fg-subtle">
              {formatDate(e.at, { month: "short", day: "numeric" })} · {formatTime(e.at)}
            </p>
          </li>
        );
      })}
      {pending && (
        <li className="relative">
          <span className="absolute -left-[2.0625rem] top-0 flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-border-strong bg-surface text-fg-subtle ring-4 ring-canvas">
            <CircleDashed className="h-3 w-3" aria-hidden="true" />
          </span>
          <p className="text-sm text-fg-subtle">{pending}</p>
          <p className="text-xs text-fg-subtle">Pending</p>
        </li>
      )}
    </ol>
  );
}
