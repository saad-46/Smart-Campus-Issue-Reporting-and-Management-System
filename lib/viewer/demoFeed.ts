// ============================================
// Viewer Mode activity: notifications and the campus timeline
// ============================================
// Both are derived from the demo issues, so they always agree with the
// lists, the charts and the issue pages.

import { IssueEventType } from "@/types";
import { computeSla, DEFAULT_SLA_CONFIG } from "@/lib/intelligence/sla";
import { DEMO_PERSONA, DEMO_WORKER_REQUESTS, DemoData, DemoIssue, DemoRole, demoTimeline } from "./demoData";

const HOUR = 3_600_000;

export type DemoNotificationKind = "assigned" | "status" | "claim" | "access" | "deadline" | "feedback" | "report";

export interface DemoNotification {
  id: string;
  kind: DemoNotificationKind;
  title: string;
  body: string;
  /** Issue to open, when the notification is about one. */
  issueId?: string;
  at: Date;
  read: boolean;
}

export interface DemoActivity {
  id: string;
  type: IssueEventType;
  at: Date;
  text: string;
  issue: DemoIssue;
}

/** Every recorded event across the campus, newest first. */
export function demoActivity(data: DemoData, limit = 400, nameOf?: (workerId: string) => string): DemoActivity[] {
  return data.issues
    .flatMap((issue) => demoTimeline(issue, data.now, nameOf).map((e, k) => ({ id: `${issue.id}-${k}`, type: e.type, at: e.at, text: e.text, issue })))
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, limit);
}

/** The notifications each perspective would have received, newest first. The newest few are unread. */
export function seedNotifications(data: DemoData, role: DemoRole): DemoNotification[] {
  const list: Omit<DemoNotification, "read">[] = [];
  const { now, issues } = data;

  if (role === "student") {
    for (const i of issues.filter((x) => x.mine)) {
      if (i.startedAt) list.push({ id: `n-${i.id}-s`, kind: "status", title: "Work has started", body: `"${i.title}" is now in progress.`, issueId: i.id, at: i.startedAt });
      if (i.resolvedAt) {
        list.push({ id: `n-${i.id}-r`, kind: "status", title: "Your issue was resolved", body: `"${i.title}" has been marked resolved.`, issueId: i.id, at: i.resolvedAt });
        if (!i.feedback) list.push({ id: `n-${i.id}-f`, kind: "feedback", title: "How was the fix?", body: `Rate the resolution of "${i.title}".`, issueId: i.id, at: new Date(i.resolvedAt.getTime() + HOUR) });
      }
      if (i.duplicateOf) list.push({ id: `n-${i.id}-l`, kind: "report", title: "Linked to an existing report", body: `"${i.title}" was linked to ${i.duplicateOf}, so both are fixed together.`, issueId: i.id, at: new Date(i.createdAt.getTime() + 5 * 60_000) });
    }
  }

  if (role === "worker") {
    const me = DEMO_PERSONA.worker.id;
    for (const i of issues.filter((x) => x.assignedTo === me)) {
      list.push({ id: `n-${i.id}-a`, kind: "assigned", title: "New task assigned to you", body: `"${i.title}" at ${i.location}.`, issueId: i.id, at: new Date(i.createdAt.getTime() + HOUR / 2) });
      if (i.claim && i.resolvedAt && i.claim.status !== "pending") {
        list.push({
          id: `n-${i.id}-c`,
          kind: "claim",
          title: i.claim.status === "approved" ? "Expense claim paid" : "Expense claim rejected",
          body: i.claim.status === "approved" ? `₹${i.claim.amount.toLocaleString("en-IN")} for "${i.title}" was approved and paid.` : `The claim for "${i.title}" was not approved.`,
          issueId: i.id,
          at: new Date(i.resolvedAt.getTime() + 2 * HOUR),
        });
      }
      if (i.status !== "Resolved" && computeSla(i, DEFAULT_SLA_CONFIG, now).state !== "on-track") {
        list.push({ id: `n-${i.id}-d`, kind: "deadline", title: "Deadline approaching", body: `"${i.title}" is close to or past its target.`, issueId: i.id, at: new Date(now.getTime() - 20 * 60_000) });
      }
    }
  }

  if (role === "admin") {
    for (const i of issues) {
      if (i.status !== "Resolved") {
        const sla = computeSla(i, DEFAULT_SLA_CONFIG, now);
        if (sla.state === "breached") list.push({ id: `n-${i.id}-d`, kind: "deadline", title: "Deadline missed", body: `"${i.title}" is past its ${i.priority.toLowerCase()}-priority target.`, issueId: i.id, at: sla.deadline });
        if (i.priority === "High" && !i.duplicateOf) list.push({ id: `n-${i.id}-h`, kind: "report", title: "High-priority report", body: `"${i.title}" at ${i.location}.`, issueId: i.id, at: i.createdAt });
      }
      if (i.claim?.status === "pending" && i.resolvedAt) {
        list.push({ id: `n-${i.id}-c`, kind: "claim", title: "Expense claim to review", body: `₹${i.claim.amount.toLocaleString("en-IN")} for "${i.title}".`, issueId: i.id, at: i.resolvedAt });
      }
    }
    for (const r of DEMO_WORKER_REQUESTS) {
      list.push({ id: `n-${r.id}`, kind: "access", title: "Worker access requested", body: `${r.name} asked to join ${r.team}.`, at: new Date(now.getTime() - r.requestedHoursAgo * HOUR) });
    }
  }

  return list
    .filter((n) => n.at.getTime() <= now.getTime())
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 24)
    .map((n, index) => ({ ...n, read: index >= 4 }));
}
