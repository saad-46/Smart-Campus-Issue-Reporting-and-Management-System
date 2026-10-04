// ============================================
// Issue timeline
// ============================================
// Events are written in the same transaction as the change they record
// (firestore.rules enforces this). Issues created before the timeline
// existed get a fallback built only from timestamps they actually have.

import { collection, doc, onSnapshot, orderBy, query, serverTimestamp, Transaction } from "firebase/firestore";
import { db } from "./firebase";
import { Issue, IssueEvent, IssueEventType, Priority, UserRole } from "@/types";
import { ListenerErrorHandler } from "./firestore";
import { track } from "./listeners";
import { normalizeIssueEvent } from "./models";

type EventData =
  | { type: "reported"; category: string; priority: Priority; confidence: number | null }
  | { type: "claimed" | "assigned" | "started" | "resolved" | "claim_approved" | "claim_rejected" }
  | { type: "linked"; duplicateOf: string }
  | { type: "feedback"; rating: number };

/** Document id per event type: single-occurrence types use the type, repeatable ones get a timestamp. */
function eventId(type: IssueEventType): string {
  if (type === "claimed" || type === "assigned" || type === "linked") return `${type}-${Date.now()}`;
  if (type === "claim_approved" || type === "claim_rejected") return "claim";
  return type;
}

export function queueEvent(transaction: Transaction, issueId: string, actorRole: UserRole, event: EventData): void {
  const data: Record<string, unknown> = { ...event, actorRole, createdAt: serverTimestamp() };
  if (event.type === "reported" && event.confidence === null) delete data.confidence;
  transaction.set(doc(db, "issues", issueId, "events", eventId(event.type)), data);
}

export function subscribeToIssueEvents(
  issueId: string,
  callback: (events: IssueEvent[]) => void,
  onError?: ListenerErrorHandler
): () => void {
  const q = query(collection(db, "issues", issueId, "events"), orderBy("createdAt", "asc"));
  return track(
    onSnapshot(
      q,
      (snapshot) =>
        callback(
          snapshot.docs
            .map((d) => normalizeIssueEvent(d.id, d.data({ serverTimestamps: "estimate" })))
            .filter((e): e is IssueEvent => e !== null)
        ),
      (error) => onError?.(error)
    )
  );
}

export interface TimelineEntry {
  key: string;
  at: Date;
  label: string;
  /** True for entries rebuilt from an older issue's timestamps rather than recorded events. */
  derived: boolean;
}

const ROLE_LABEL: Record<UserRole, string> = { user: "the reporter", worker: "a worker", admin: "an administrator" };

export function describeEvent(e: IssueEvent): string[] {
  switch (e.type) {
    case "reported": {
      const lines = ["Issue reported"];
      if (e.category) {
        lines.push(`Suggested category: ${e.category} · ${e.priority ?? "Low"} priority`);
      }
      return lines;
    }
    case "claimed":
      return ["A worker took the task"];
    case "assigned":
      return ["Assigned to a worker by an administrator"];
    case "started":
      return [`Work started by ${ROLE_LABEL[e.actorRole]}`];
    case "resolved":
      return [`Marked resolved by ${ROLE_LABEL[e.actorRole]}`];
    case "claim_approved":
      return ["Expense claim approved and paid"];
    case "claim_rejected":
      return ["Expense claim rejected"];
    case "linked":
      return [e.duplicateOf ? "Linked to an incident with related reports" : "Removed from an incident"];
    case "feedback":
      return [`Reporter rated the resolution${typeof e.rating === "number" ? ` ${e.rating}/5` : ""}`];
  }
}

/**
 * Timeline entries: recorded events when there are any; otherwise the
 * timestamps the issue itself carries (marked derived). Nothing is invented.
 */
export function buildTimeline(issue: Pick<Issue, "createdAt" | "startedAt" | "resolvedAt">, events: IssueEvent[]): TimelineEntry[] {
  if (events.length > 0) {
    return events.flatMap((e) =>
      describeEvent(e).map((label, i) => ({ key: `${e.id}-${i}`, at: e.createdAt, label, derived: false }))
    );
  }
  const entries: TimelineEntry[] = [];
  if (issue.createdAt.getTime() > 0) entries.push({ key: "created", at: issue.createdAt, label: "Issue reported", derived: true });
  if (issue.startedAt) entries.push({ key: "started", at: issue.startedAt, label: "Work started", derived: true });
  if (issue.resolvedAt) entries.push({ key: "resolved", at: issue.resolvedAt, label: "Marked resolved", derived: true });
  return entries;
}
