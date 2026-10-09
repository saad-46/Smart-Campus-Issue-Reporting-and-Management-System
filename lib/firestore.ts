// ============================================
// Firestore CRUD Operations for Issues
// ============================================
// All database operations for the issues collection.
// Includes real-time listeners for live updates.
//
// Every write here is also validated by firestore.rules; the checks in
// this file exist to give the user a clear message before the round trip.

import {
  collection,
  doc,
  runTransaction,
  updateDoc,
  writeBatch,
  getDoc,
  getDocs,
  getCountFromServer,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  FirestoreError,
  Query,
  DocumentData,
  Transaction,
} from "firebase/firestore";
import { db } from "./firebase";
import { Issue, CreateIssueData, IssueImage, IssueSummary, Priority, IssueStatus, UserRole } from "@/types";
import { DEPARTMENTS, LIMITS, QUERY_LIMITS, UPVOTE_PRIORITY_THRESHOLD, canTransition } from "./constants";
import { toDate } from "./dates";
import { ValidationError, assertOnline, getErrorCode } from "./errors";
import { runProjectionQuery } from "./firestoreRest";
import { track } from "./listeners";
import { normalizeIssue, normalizeIssueSummary } from "./models";
import { queueNotification } from "./notifications";
import { queueEvent } from "./timeline";
import { assertRealId } from "./sharedRules";
import {
  isDisplayableImageUrl,
  isSafeImageDataUrl,
  normalizeCategory,
  normalizePriority,
  parseAmount,
  validateClaimDescription,
  validateImages,
  validateIssueInput,
} from "./validation";

const ISSUES_COLLECTION = "issues";
const IMAGES_SUBCOLLECTION = "images";
const RECEIPTS_SUBCOLLECTION = "receipts";
const RECEIPT_DOC_ID = "receipt";
const RATE_LIMITS_COLLECTION = "rateLimits";

/** How many issues the community feed loads. */
const EXPLORE_FEED_LIMIT = 100;

/**
 * How many of the newest issues the admin dashboard keeps live. Analytics
 * are computed over this window; totals come from server-side counts.
 */
export const ADMIN_ISSUE_WINDOW = 300;

export type ListenerErrorHandler = (error: FirestoreError) => void;

/**
 * Attach a real-time listener to an issues query.
 * `serverTimestamps: "estimate"` keeps dates valid while a write is still pending.
 */
function listenToIssues(
  q: Query<DocumentData>,
  callback: (issues: Issue[]) => void,
  onError?: ListenerErrorHandler
): () => void {
  return track(
    onSnapshot(
      q,
      (snapshot) => {
        callback(
          snapshot.docs.map((d) => normalizeIssue(d.id, d.data({ serverTimestamps: "estimate" })))
        );
      },
      (error) => onError?.(error)
    )
  );
}

/** Who is performing a change (recorded on the timeline; checked by the rules). */
export interface Actor {
  id: string;
  role: UserRole;
}

/** Fields of the lightweight projection (see IssueSummary). */
const SUMMARY_FIELDS = [
  "title", "category", "priority", "status", "location", "locationId",
  "assignedTo", "duplicateOf", "createdAt", "startedAt", "resolvedAt", "escalated",
];

/**
 * Lightweight issue rows for analytics, the map and search — newest first,
 * capped, and without descriptions or photos (field projection).
 */
export async function fetchIssueSummaries(options: {
  since?: Date;
  until?: Date;
  max?: number;
} = {}): Promise<{ issues: IssueSummary[]; capped: boolean }> {
  const max = options.max ?? QUERY_LIMITS.analytics;
  const where: Parameters<typeof runProjectionQuery>[0]["where"] = [];
  if (options.since) where.push({ field: "createdAt", op: "GREATER_THAN_OR_EQUAL", value: options.since });
  if (options.until) where.push({ field: "createdAt", op: "LESS_THAN_OR_EQUAL", value: options.until });
  const rows = await runProjectionQuery({
    collection: ISSUES_COLLECTION,
    select: SUMMARY_FIELDS,
    where,
    orderBy: { field: "createdAt", direction: "DESCENDING" },
    limit: max,
  });
  return { issues: rows.map(([id, fields]) => normalizeIssueSummary(id, fields)), capped: rows.length >= max };
}

/** Reports linked to an incident (issues with duplicateOf == masterId). */
export async function fetchIncidentMembers(masterId: string): Promise<IssueSummary[]> {
  const rows = await runProjectionQuery({
    collection: ISSUES_COLLECTION,
    select: SUMMARY_FIELDS,
    where: [{ field: "duplicateOf", op: "EQUAL", value: masterId }],
    limit: 200,
  });
  return rows.map(([id, fields]) => normalizeIssueSummary(id, fields)).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

export interface ReportExtras {
  /** Output of the analysis layer (suggestions only). */
  analysis?: { summary: string; confidence: number; department: string };
  /** campusLocations id from a QR code. */
  locationId?: string;
  /** "Same problem as" an existing issue. */
  duplicateOf?: string;
}

function byNewest(a: Issue, b: Issue): number {
  return b.createdAt.getTime() - a.createdAt.getTime();
}

/**
 * Create a new issue in Firestore.
 * `category` and `priority` come from the AI suggestion layer and are
 * treated as untrusted: unknown values fall back to safe defaults.
 */
export async function createIssue(
  issueData: CreateIssueData,
  userId: string,
  userName: string,
  category: string,
  priority: Priority,
  issueImages: IssueImage[] = [],
  extras: ReportExtras = {}
): Promise<string> {
  if (!userId) throw new ValidationError("Your session has expired. Please sign in again.");
  assertOnline();

  const input = validateIssueInput(issueData);
  const images = validateImages(issueImages);
  const finalCategory = normalizeCategory(category);
  const finalPriority = normalizePriority(priority);

  // Optional fields: only written when valid, so a bad suggestion can
  // never block the report itself.
  const optional: Record<string, string | number> = {};
  const analysis = extras.analysis;
  let confidence: number | null = null;
  if (analysis) {
    if (analysis.summary) optional.aiSummary = analysis.summary.slice(0, 300);
    if (Number.isFinite(analysis.confidence) && analysis.confidence >= 0 && analysis.confidence <= 1) {
      confidence = Math.round(analysis.confidence * 100) / 100;
      optional.aiConfidence = confidence;
    }
    if (DEPARTMENTS.includes(analysis.department)) optional.aiDepartment = analysis.department;
  }
  if (extras.locationId && /^[a-z0-9-]{1,60}$/.test(extras.locationId)) optional.locationId = extras.locationId;
  if (extras.duplicateOf && /^[A-Za-z0-9]{1,64}$/.test(extras.duplicateOf)) optional.duplicateOf = extras.duplicateOf;

  const issueRef = doc(collection(db, ISSUES_COLLECTION));
  const rateRef = doc(db, RATE_LIMITS_COLLECTION, userId);
  const tooSoon = new ValidationError(
    "You've just reported an issue. Please wait a few seconds before reporting another."
  );

  // A transaction (rather than a plain write) for two reasons: the issue,
  // its photos and the rate-limit stamp are committed atomically, and a
  // transaction is never queued offline — if the server can't be reached
  // it fails, so the user is never left with an invisible pending write.
  try {
    await runTransaction(db, async (transaction) => {
      const rateSnap = await transaction.get(rateRef);
      const last = toDate(rateSnap.data()?.lastIssueAt);
      if (last && Date.now() - last.getTime() < LIMITS.issueCooldownSeconds * 1000) throw tooSoon;

      transaction.set(issueRef, {
        title: input.title,
        description: input.description,
        location: input.location,
        category: finalCategory,
        priority: finalPriority,
        status: "Open" as IssueStatus,
        createdBy: userId,
        createdByName: userName.trim().slice(0, LIMITS.name) || "Unknown",
        assignedTo: "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        upvotes: 0,
        upvotedBy: [],
        escalated: false,
        imageUrl: "", // legacy fields, kept empty
        imageUrls: [],
        thumbnails: images.map((image) => image.thumb),
        imageCount: images.length,
        ...optional,
      });

      queueEvent(transaction, issueRef.id, "user", {
        type: "reported",
        category: finalCategory,
        priority: finalPriority,
        confidence,
      });

      images.forEach((image, index) => {
        transaction.set(doc(issueRef, IMAGES_SUBCOLLECTION, String(index)), {
          data: image.full,
          index,
          createdBy: userId,
          createdAt: serverTimestamp(),
        });
      });

      // firestore.rules only accepts the issue if this stamp moves in the
      // same commit, and only lets it move once per cooldown window.
      transaction.set(rateRef, { lastIssueAt: serverTimestamp() });
    });
  } catch (err) {
    // The server's clock is authoritative for the cooldown; if ours was
    // ahead, the rules reject what the check above let through.
    if (getErrorCode(err) === "permission-denied") {
      throw new ValidationError(
        "This report couldn't be submitted. If you reported an issue in the last 30 seconds, wait a moment and try again."
      );
    }
    throw err;
  }

  return issueRef.id;
}

/**
 * Load the full-size photos of an issue (on demand: lists only carry thumbnails).
 */
export async function getIssueImages(issue: Issue): Promise<string[]> {
  if (!issue.hasImageDocs) return issue.imageUrls ?? [];

  const snapshot = await getDocs(
    collection(db, ISSUES_COLLECTION, issue.id, IMAGES_SUBCOLLECTION)
  );
  return snapshot.docs
    .map((d) => ({ index: Number(d.data().index) || 0, data: d.data().data as unknown }))
    .filter((image): image is { index: number; data: string } => isDisplayableImageUrl(image.data))
    .sort((a, b) => a.index - b.index)
    .map((image) => image.data);
}

/**
 * Load the receipt photo of an expense claim. Only the worker who filed it
 * and admins are allowed to (firestore.rules). Returns "" when there is none.
 */
export async function getReceiptImage(issue: Issue): Promise<string> {
  if (issue.receiptUrl) return issue.receiptUrl; // legacy: stored on the issue
  if (!issue.hasReceipt) return "";

  const snap = await getDoc(
    doc(db, ISSUES_COLLECTION, issue.id, RECEIPTS_SUBCOLLECTION, RECEIPT_DOC_ID)
  );
  const data = snap.data()?.data;
  return isDisplayableImageUrl(data) ? data : "";
}

/**
 * Subscribe to the most recent issues in real-time: the community
 * "Explore" feed and the admin dashboard's analytics window.
 * Always capped, so no browser downloads the entire collection.
 */
export function subscribeToRecentIssues(
  callback: (issues: Issue[]) => void,
  onError?: ListenerErrorHandler,
  maxIssues: number = EXPLORE_FEED_LIMIT
): () => void {
  const q = query(
    collection(db, ISSUES_COLLECTION),
    orderBy("createdAt", "desc"),
    limit(maxIssues)
  );
  return listenToIssues(q, callback, onError);
}

/**
 * Subscribe to every expense claim awaiting a decision, regardless of age
 * (a claim on an old issue must not fall out of the admin's view).
 */
export function subscribeToPendingClaims(
  callback: (issues: Issue[]) => void,
  onError?: ListenerErrorHandler
): () => void {
  const q = query(collection(db, ISSUES_COLLECTION), where("claimStatus", "==", "pending"));
  return listenToIssues(q, (issues) => callback(issues.sort(byNewest)), onError);
}

/**
 * Exact totals, computed by the server without downloading the documents.
 */
export async function getIssueCounts(): Promise<{ total: number; unresolved: number }> {
  const issues = collection(db, ISSUES_COLLECTION);
  const [total, unresolved] = await Promise.all([
    getCountFromServer(issues),
    getCountFromServer(query(issues, where("status", "in", ["Open", "In Progress"]))),
  ]);
  return { total: total.data().count, unresolved: unresolved.data().count };
}

/**
 * Subscribe to a SINGLE issue in real-time (for issue detail page).
 * Returns an unsubscribe function.
 */
export function subscribeToSingleIssue(
  issueId: string,
  callback: (issue: Issue | null) => void,
  onError?: ListenerErrorHandler
): () => void {
  const docRef = doc(db, ISSUES_COLLECTION, issueId);
  return track(
    onSnapshot(
      docRef,
      (snapshot) => {
        callback(
          snapshot.exists()
            ? normalizeIssue(snapshot.id, snapshot.data({ serverTimestamps: "estimate" }))
            : null
        );
      },
      (error) => onError?.(error)
    )
  );
}

/** One-off read of an issue (e.g. an incident's master report). */
export async function getIssue(issueId: string): Promise<Issue | null> {
  const snap = await getDoc(doc(db, ISSUES_COLLECTION, issueId));
  return snap.exists() ? normalizeIssue(snap.id, snap.data()) : null;
}

/**
 * Subscribe to issues created by a specific user (for user dashboard).
 * Sorts in memory to avoid requiring a composite Firestore index.
 * Returns an unsubscribe function.
 */
export function subscribeToUserIssues(
  userId: string,
  callback: (issues: Issue[]) => void,
  onError?: ListenerErrorHandler
): () => void {
  const q = query(collection(db, ISSUES_COLLECTION), where("createdBy", "==", userId));
  return listenToIssues(q, (issues) => callback(issues.sort(byNewest)), onError);
}

/**
 * Subscribe to the issues assigned to a worker.
 */
export function subscribeToAssignedIssues(
  workerId: string,
  callback: (issues: Issue[]) => void,
  onError?: ListenerErrorHandler
): () => void {
  const q = query(collection(db, ISSUES_COLLECTION), where("assignedTo", "==", workerId));
  return listenToIssues(q, (issues) => callback(issues.sort(byNewest)), onError);
}

/**
 * Subscribe to the pool of open issues nobody has taken yet.
 * Two equality filters are served by Firestore's built-in single-field
 * indexes, so no composite index is required.
 */
export function subscribeToOpenPool(
  callback: (issues: Issue[]) => void,
  onError?: ListenerErrorHandler
): () => void {
  const q = query(
    collection(db, ISSUES_COLLECTION),
    where("status", "==", "Open"),
    where("assignedTo", "==", "")
  );
  return listenToIssues(q, (issues) => callback(issues.sort(byNewest)), onError);
}

/**
 * Move an issue one step along its lifecycle (Open → In Progress → Resolved).
 * Runs in a transaction so the transition is checked against the latest state.
 */
export async function updateIssueStatus(
  issueId: string,
  status: IssueStatus,
  actor: Actor
): Promise<void> {
  assertRealId(issueId, "issue");
  const issueRef = doc(db, ISSUES_COLLECTION, issueId);

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(issueRef);
    if (!snap.exists()) throw new ValidationError("This issue no longer exists.");

    const current = normalizeIssue(snap.id, snap.data());
    if (current.status === status) return; // already there — nothing to do
    if (!canTransition(current.status, status)) {
      throw new ValidationError(`An issue can't move from "${current.status}" to "${status}".`);
    }

    transaction.update(issueRef, {
      status,
      updatedAt: serverTimestamp(),
      ...(status === "In Progress" ? { startedAt: serverTimestamp() } : {}),
      ...(status === "Resolved" ? { resolvedAt: serverTimestamp() } : {}),
    });
    queueEvent(transaction, issueId, actor.role, { type: status === "In Progress" ? "started" : "resolved" });
    notifyReporter(transaction, current, status, actor);
  });
}

/** Tell the reporter their issue moved on (unless they made the change themselves). */
function notifyReporter(transaction: Transaction, issue: Issue, status: IssueStatus, actor: Actor): void {
  if (!issue.createdBy || issue.createdBy === actor.id) return;
  queueNotification(transaction, actor.id, {
    type: "status_changed",
    recipientId: issue.createdBy,
    issueId: issue.id,
    issueTitle: issue.title,
    status,
  });
}

/**
 * Admin assigns (or reassigns / unassigns with "") an issue. The rules
 * only accept approved workers or admins as assignees.
 */
export async function adminAssignIssue(issueId: string, workerId: string, admin: Actor): Promise<void> {
  assertRealId(issueId, "issue");
  const issueRef = doc(db, ISSUES_COLLECTION, issueId);
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(issueRef);
    if (!snap.exists()) throw new ValidationError("This issue no longer exists.");
    const current = normalizeIssue(snap.id, snap.data());
    if (current.status === "Resolved") throw new ValidationError("A resolved issue can't be reassigned.");
    if (current.assignedTo === workerId) return;

    transaction.update(issueRef, { assignedTo: workerId, updatedAt: serverTimestamp() });
    if (workerId) {
      queueEvent(transaction, issueId, admin.role, { type: "assigned" });
      queueNotification(transaction, admin.id, {
        type: "issue_assigned",
        recipientId: workerId,
        issueId,
        issueTitle: current.title,
      });
    }
  });
}

/**
 * Admin flags (or clears) an issue for attention. Escalation uses the
 * existing admin-only `escalated` field; it changes no roles or permissions.
 */
export async function setIssueEscalation(issueId: string, escalated: boolean): Promise<void> {
  assertRealId(issueId, "issue");
  await updateDoc(doc(db, ISSUES_COLLECTION, issueId), { escalated, updatedAt: serverTimestamp() });
}

/** Admin links a report into an incident (masterId) or removes the link (""). */
export async function linkIssueToIncident(issueId: string, masterId: string, admin: Actor): Promise<void> {
  assertRealId(issueId, "issue");
  if (masterId === issueId) throw new ValidationError("An issue can't be linked to itself.");
  const issueRef = doc(db, ISSUES_COLLECTION, issueId);
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(issueRef);
    if (!snap.exists()) throw new ValidationError("This issue no longer exists.");
    if (masterId) {
      const master = await transaction.get(doc(db, ISSUES_COLLECTION, masterId));
      if (!master.exists()) throw new ValidationError("The incident's main report no longer exists.");
      if (normalizeIssue(master.id, master.data()).duplicateOf) {
        throw new ValidationError("Link to the incident's main report, not to another linked report.");
      }
    }
    if (normalizeIssue(snap.id, snap.data()).duplicateOf === masterId) return;
    transaction.update(issueRef, { duplicateOf: masterId, updatedAt: serverTimestamp() });
    queueEvent(transaction, issueId, admin.role, { type: "linked", duplicateOf: masterId });
  });
}

/**
 * Submit an expense claim and resolve the issue.
 */
export async function submitBill(
  issueId: string,
  worker: Actor,
  amount: number,
  receiptImage: string,
  description = ""
): Promise<void> {
  assertRealId(issueId, "issue");
  const workerId = worker.id;
  const claimAmount = parseAmount(amount, LIMITS.maxClaimAmount);
  const claimDescription = validateClaimDescription(description);
  if (receiptImage && !isSafeImageDataUrl(receiptImage, LIMITS.receiptChars)) {
    throw new ValidationError("The receipt image couldn't be processed. Please attach it again.");
  }

  const issueRef = doc(db, ISSUES_COLLECTION, issueId);

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(issueRef);
    if (!snap.exists()) throw new ValidationError("This issue no longer exists.");

    const current = normalizeIssue(snap.id, snap.data());
    if (!canTransition(current.status, "Resolved")) {
      throw new ValidationError("Only an issue that is in progress can be resolved.");
    }

    transaction.update(issueRef, {
      status: "Resolved" as IssueStatus,
      resolvedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      claimAmount,
      claimStatus: "pending",
      hasReceipt: receiptImage !== "",
      // Only written when given, so the rules can keep the field optional.
      ...(claimDescription ? { claimDescription } : {}),
    });

    // The receipt is its own document so that only the worker and admins
    // can read it (issues themselves are visible to every signed-in user).
    if (receiptImage) {
      transaction.set(doc(issueRef, RECEIPTS_SUBCOLLECTION, RECEIPT_DOC_ID), {
        data: receiptImage,
        createdBy: workerId,
        createdAt: serverTimestamp(),
      });
    }
    queueEvent(transaction, issueId, worker.role, { type: "resolved" });
    notifyReporter(transaction, current, "Resolved", worker);
  });
}

/**
 * Take an unassigned issue from the pool.
 * Transactional, so two workers can't both claim the same issue.
 */
export async function assignIssue(
  issueId: string,
  assigneeId: string,
  role: UserRole = "worker"
): Promise<void> {
  assertRealId(issueId, "issue");
  const issueRef = doc(db, ISSUES_COLLECTION, issueId);

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(issueRef);
    if (!snap.exists()) throw new ValidationError("This issue no longer exists.");

    const current = normalizeIssue(snap.id, snap.data());
    if (current.assignedTo === assigneeId) return;
    if (current.assignedTo || current.status !== "Open") {
      throw new ValidationError("Someone else has already taken this task.");
    }

    transaction.update(issueRef, {
      assignedTo: assigneeId,
      updatedAt: serverTimestamp(),
    });
    queueEvent(transaction, issueId, role, { type: "claimed" });
  });
}

/**
 * Delete an issue. Allowed for the author while the issue is still open
 * and unassigned, and for admins (enforced by firestore.rules).
 */
export async function deleteIssue(issueId: string): Promise<void> {
  assertRealId(issueId, "issue");
  const issueRef = doc(db, ISSUES_COLLECTION, issueId);
  // Firestore doesn't cascade deletes: remove the photo documents too.
  const images = await getDocs(collection(issueRef, IMAGES_SUBCOLLECTION));

  const batch = writeBatch(db);
  images.docs.forEach((image) => batch.delete(image.ref));
  batch.delete(issueRef);
  await batch.commit();
}

/**
 * Upvote or remove upvote for an issue by a user.
 * Uses a transaction to ensure atomicity.
 */
export async function toggleUpvote(issueId: string, userId: string): Promise<void> {
  assertRealId(issueId, "issue");
  const issueRef = doc(db, ISSUES_COLLECTION, issueId);
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(issueRef);
    if (!snap.exists()) throw new ValidationError("This issue no longer exists.");

    const current = normalizeIssue(snap.id, snap.data());
    const voters = new Set(current.upvotedBy);
    if (voters.has(userId)) {
      voters.delete(userId);
    } else {
      voters.add(userId);
    }

    const upvotedBy = [...voters];
    const updates: { upvotes: number; upvotedBy: string[]; priority?: Priority } = {
      upvotes: upvotedBy.length,
      upvotedBy,
    };
    // Auto-promote priority once enough of the community has upvoted.
    if (upvotedBy.length >= UPVOTE_PRIORITY_THRESHOLD && current.priority !== "High") {
      updates.priority = "High";
    }
    transaction.update(issueRef, updates);
  });
}
