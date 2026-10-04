// ============================================
// Notifications
// ============================================
// Stored notifications are written by whoever makes a change, inside the
// same transaction as the change (firestore.rules only accepts them
// there). They carry no free text — renderNotification() builds the
// wording from the type and the rule-checked fields.

import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Transaction,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import { AppNotification, IssueStatus } from "@/types";
import { QUERY_LIMITS } from "./constants";
import { ListenerErrorHandler } from "./firestore";
import { track } from "./listeners";
import { normalizeNotification } from "./models";

const NOTIFICATIONS = "notifications";

export type NewNotification =
  | { type: "issue_assigned"; recipientId: string; issueId: string; issueTitle: string }
  | { type: "status_changed"; recipientId: string; issueId: string; issueTitle: string; status: IssueStatus }
  | { type: "claim_decision"; recipientId: string; issueId: string; issueTitle: string; decision: "approved" | "rejected"; amount: number }
  | { type: "worker_access"; recipientId: string; decision: "approved" | "rejected" };

/** Add a notification to a transaction that is making the matching change. */
export function queueNotification(transaction: Transaction, senderId: string, notification: NewNotification): void {
  transaction.set(doc(collection(db, NOTIFICATIONS)), {
    ...notification,
    senderId,
    createdAt: serverTimestamp(),
    readAt: null,
  });
}

/** The newest notifications for the signed-in user, live. */
export function subscribeToNotifications(
  userId: string,
  callback: (items: AppNotification[]) => void,
  onError?: ListenerErrorHandler
): () => void {
  const q = query(
    collection(db, NOTIFICATIONS),
    where("recipientId", "==", userId),
    orderBy("createdAt", "desc"),
    limit(QUERY_LIMITS.notifications)
  );
  return track(
    onSnapshot(
      q,
      (snapshot) =>
        callback(
          snapshot.docs
            .map((d) => normalizeNotification(d.id, d.data({ serverTimestamps: "estimate" })))
            .filter((n): n is AppNotification => n !== null)
        ),
      (error) => onError?.(error)
    )
  );
}

export async function markNotificationRead(id: string): Promise<void> {
  await updateDoc(doc(db, NOTIFICATIONS, id), { readAt: serverTimestamp() });
}

export async function markAllNotificationsRead(ids: string[]): Promise<void> {
  // A batch holds at most 500 writes; the list is capped at 50 anyway.
  const batch = writeBatch(db);
  for (const id of ids.slice(0, 450)) batch.update(doc(db, NOTIFICATIONS, id), { readAt: serverTimestamp() });
  await batch.commit();
}

export interface RenderedNotification {
  title: string;
  message: string;
  /** Where "Open" takes the user. */
  href: string;
}

const STATUS_TEXT: Record<IssueStatus, string> = {
  Open: "was reopened",
  "In Progress": "is now being worked on",
  Resolved: "has been resolved — tell us how it went",
};

/** Fixed wording per type. Titles come from the issue (checked by the rules) and render as text. */
export function renderNotification(n: AppNotification): RenderedNotification {
  const issueHref = n.issueId ? `/issues/${n.issueId}` : "/dashboard";
  switch (n.type) {
    case "issue_assigned":
      return { title: "New task assigned", message: `You were assigned "${n.issueTitle}".`, href: issueHref };
    case "status_changed":
      return {
        title: n.status === "Resolved" ? "Issue resolved" : "Issue updated",
        message: `"${n.issueTitle}" ${n.status ? STATUS_TEXT[n.status] : "was updated"}.`,
        href: issueHref,
      };
    case "claim_decision":
      return n.decision === "approved"
        ? {
            title: "Expense claim paid",
            message: `Your claim for "${n.issueTitle}" was approved${typeof n.amount === "number" ? ` and ₹${n.amount.toLocaleString()} paid` : ""}.`,
            href: "/worker",
          }
        : { title: "Expense claim rejected", message: `Your claim for "${n.issueTitle}" was not approved.`, href: "/worker" };
    case "worker_access":
      return n.decision === "approved"
        ? { title: "Worker access approved", message: "You can now take and resolve maintenance tasks.", href: "/worker" }
        : { title: "Worker access not granted", message: "Your worker access was declined or removed. Contact an administrator if this is unexpected.", href: "/dashboard" };
  }
}
