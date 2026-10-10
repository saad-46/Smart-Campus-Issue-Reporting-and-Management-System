// ============================================
// Finance and Budget Operations
// ============================================
// Admin-only (enforced by firestore.rules), except that a worker may read
// their own transactions.

import {
  collection,
  doc,
  getDoc,
  setDoc,
  query,
  where,
  getDocs,
  onSnapshot,
  serverTimestamp,
  increment,
  limit as limitTo,
  orderBy,
  runTransaction,
} from "firebase/firestore";
import { db } from "./firebase";
import { Budget, LedgerEntry, LedgerHead, Transaction, User } from "@/types";
import { FundDetails, PaymentDetails } from "./financeRules";
import { LIMITS } from "./constants";
import { ValidationError } from "./errors";
import { ListenerErrorHandler } from "./firestore";
import { track } from "./listeners";
import { normalizeBudget, normalizeIssue, normalizeLedgerEntry, normalizeLedgerHead, normalizeTransaction, normalizeUser } from "./models";
import { queueNotification } from "./notifications";
import { queueEvent } from "./timeline";
import { parseAmount } from "./validation";
import { payoutNote } from "./claims";
import { assertRealId } from "./sharedRules";

const BUDGET_ID = "budget";
const FINANCE_COLLECTION = "finance";
const TRANSACTIONS_COLLECTION = "transactions";
const LEDGER_COLLECTION = "ledger";
const LEDGER_HEAD_COLLECTION = "ledgerHead";
const LEDGER_HEAD_ID = "state";
const USERS_COLLECTION = "users";
const ISSUES_COLLECTION = "issues";

/** Budget the system starts with the first time an admin opens the dashboard. */
const INITIAL_BUDGET = 500000; // 5 Lakhs

/**
 * Initializes or fetches the global budget.
 */
export async function getGlobalBudget(): Promise<Budget> {
  const docRef = doc(db, FINANCE_COLLECTION, BUDGET_ID);
  const snap = await getDoc(docRef);
  if (snap.exists()) return normalizeBudget(snap.id, snap.data());

  // Scaffold initial budget if none exists
  await setDoc(docRef, {
    totalAvailable: INITIAL_BUDGET,
    totalSpent: 0,
    updatedAt: serverTimestamp(),
  });
  return { id: BUDGET_ID, totalAvailable: INITIAL_BUDGET, totalSpent: 0, updatedAt: new Date() };
}

/** Subscribe to live budget updates */
export function subscribeToBudget(
  callback: (budget: Budget | null) => void,
  onError?: ListenerErrorHandler
) {
  return track(
    onSnapshot(
      doc(db, FINANCE_COLLECTION, BUDGET_ID),
      (snap) => {
        callback(
          snap.exists() ? normalizeBudget(snap.id, snap.data({ serverTimestamps: "estimate" })) : null
        );
      },
      (error) => onError?.(error)
    )
  );
}

/** Subscribe to live transaction updates globally (admin) or for one worker */
export function subscribeToTransactions(
  workerId: string | null,
  callback: (tx: Transaction[]) => void,
  onError?: ListenerErrorHandler
) {
  const coll = collection(db, TRANSACTIONS_COLLECTION);
  const q = workerId ? query(coll, where("workerId", "==", workerId)) : query(coll);

  return track(
    onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs
          .map((d) => normalizeTransaction(d.id, d.data({ serverTimestamps: "estimate" })))
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        callback(data);
      },
      (error) => onError?.(error)
    )
  );
}

/** Get all registered workers */
export async function getAllWorkers(): Promise<User[]> {
  const q = query(collection(db, USERS_COLLECTION), where("role", "==", "worker"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => normalizeUser(d.id, d.data()));
}

/** Subscribe to accounts that have asked for worker access (admin only). */
export function subscribeToWorkerRequests(
  callback: (users: User[]) => void,
  onError?: ListenerErrorHandler
) {
  const q = query(collection(db, USERS_COLLECTION), where("workerRequest", "==", "pending"));
  return track(
    onSnapshot(
      q,
      (snapshot) => callback(snapshot.docs.map((d) => normalizeUser(d.id, d.data()))),
      (error) => onError?.(error)
    )
  );
}

/**
 * Admin grants or removes worker access. The role lives in users/{uid}.role,
 * which firestore.rules lets only an admin change. The account holder is
 * notified in the same commit.
 */
export async function setWorkerAccess(
  userId: string,
  decision: "approve" | "reject" | "revoke",
  adminId: string
): Promise<void> {
  const approved = decision === "approve";
  await runTransaction(db, async (transaction) => {
    transaction.update(doc(db, USERS_COLLECTION, userId), {
      role: approved ? "worker" : "user",
      roles: approved ? ["user", "worker"] : ["user"],
      activeRole: approved ? "worker" : "user",
      workerRequest: approved ? "approved" : "rejected",
    });
    queueNotification(transaction, adminId, {
      type: "worker_access",
      recipientId: userId,
      decision: approved ? "approved" : "rejected",
    });
  });
}

/**
 * Admin records the payment of a worker's expense claim.
 * One atomic transaction: deducts from the budget, credits the worker,
 * records the payment (with how and when the administrator says it was made)
 * and marks the claim approved.
 *
 * UniFix does not move money. This writes the administrator's statement that
 * an external payment was made, flagged `verification: "manual"`; nothing here
 * confirms it with a bank or gateway.
 *
 * The amount and payee are read from the issue inside the transaction —
 * not taken from what the browser happens to be showing — and the claim
 * must still be pending, so a double click or two admins acting at once
 * can't pay the same claim twice.
 */
export async function approveClaim(issueId: string, workerName: string, adminId: string, payment: PaymentDetails): Promise<void> {
  assertRealId(issueId, "issue");
  const budgetRef = doc(db, FINANCE_COLLECTION, BUDGET_ID);
  const issueRef = doc(db, ISSUES_COLLECTION, issueId);
  const newTxRef = doc(collection(db, TRANSACTIONS_COLLECTION));

  await runTransaction(db, async (transaction) => {
    const [budgetSnap, issueSnap] = await Promise.all([
      transaction.get(budgetRef),
      transaction.get(issueRef),
    ]);
    if (!budgetSnap.exists()) throw new ValidationError("The budget hasn't been set up yet.");
    if (!issueSnap.exists()) throw new ValidationError("This issue no longer exists.");

    const issue = normalizeIssue(issueSnap.id, issueSnap.data());
    if (issue.claimStatus !== "pending") {
      throw new ValidationError("This claim has already been processed.");
    }
    if (!issue.assignedTo) {
      throw new ValidationError("This claim has no worker to pay.");
    }
    // Paid exactly as claimed (the rules require the ledger entry to match
    // the claim to the last decimal), so validate without re-rounding.
    const amount = issue.claimAmount ?? 0;
    if (!(amount > 0) || amount > LIMITS.maxClaimAmount) {
      throw new ValidationError("This claim's amount isn't valid. Reject it and ask the worker to resubmit.");
    }

    const budget = normalizeBudget(budgetSnap.id, budgetSnap.data());
    if (amount > budget.totalAvailable - budget.totalSpent) {
      throw new ValidationError("Not enough budget remaining to pay this claim. Add funds first.");
    }

    const workerRef = doc(db, USERS_COLLECTION, issue.assignedTo);
    const workerSnap = await transaction.get(workerRef);
    if (!workerSnap.exists()) throw new ValidationError("The worker's account no longer exists.");

    // 1. Update Global Budget
    transaction.update(budgetRef, {
      totalSpent: increment(amount),
      updatedAt: serverTimestamp(),
    });

    // 2. Add Earnings to Worker
    transaction.update(workerRef, { earnings: increment(amount) });

    // 3. Log the Transaction History
    transaction.set(newTxRef, {
      workerId: issue.assignedTo,
      workerName: workerName.slice(0, LIMITS.name),
      amount,
      type: "receipt",
      note: payoutNote(issue.title, issue.claimDescription),
      issueId,
      receiptUrl: "", // the receipt stays on the issue; don't duplicate the image
      status: "approved",
      method: payment.method,
      ...(payment.reference ? { reference: payment.reference } : {}),
      paidOn: payment.paidOn,
      verification: "manual",
      recordedBy: adminId,
      createdAt: serverTimestamp(),
    });

    // 4. Mark the claim approved
    transaction.update(issueRef, {
      claimStatus: "approved",
      updatedAt: serverTimestamp(),
    });

    // 5. Timeline + tell the worker
    queueEvent(transaction, issueId, "admin", { type: "claim_approved" });
    queueNotification(transaction, adminId, {
      type: "claim_decision",
      recipientId: issue.assignedTo,
      issueId,
      issueTitle: issue.title,
      decision: "approved",
      amount,
    });
  });
}

/** Reject a receipt claim */
export async function rejectReceipt(issueId: string, adminId: string): Promise<void> {
  assertRealId(issueId, "issue");
  const issueRef = doc(db, ISSUES_COLLECTION, issueId);

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(issueRef);
    if (!snap.exists()) throw new ValidationError("This issue no longer exists.");
    const issue = normalizeIssue(snap.id, snap.data());
    if (issue.claimStatus !== "pending") {
      throw new ValidationError("This claim has already been processed.");
    }
    transaction.update(issueRef, {
      claimStatus: "rejected",
      updatedAt: serverTimestamp(),
    });
    queueEvent(transaction, issueId, "admin", { type: "claim_rejected" });
    if (issue.assignedTo) {
      queueNotification(transaction, adminId, {
        type: "claim_decision",
        recipientId: issue.assignedTo,
        issueId,
        issueTitle: issue.title,
        decision: "rejected",
        amount: issue.claimAmount ?? 0,
      });
    }
  });
}

/** A fresh id for one funds entry. Keep it for as long as the same entry is being submitted, so a retry is recognised. */
export function newLedgerEntryId(): string {
  return doc(collection(db, LEDGER_COLLECTION)).id;
}

/**
 * Records funds made available to the budget. One atomic commit:
 *   1. raises the budget's totalAvailable by `amount` (the budget document
 *      keeps its original shape),
 *   2. writes an immutable ledger entry naming who recorded it, why, from what
 *      source and on which date,
 *   3. moves ledgerHead/state to that entry and counts it.
 * The rules accept the entry only with the head that names it, and the head
 * only with the entry it names, so none of the three can be written alone and
 * one increase can never be recorded twice.
 *
 * Idempotent per `entryId`: if that entry already exists (a retry after a
 * network failure, or a double submit) nothing is written and nothing changes.
 *
 * This is the administrator's record of an allocation, not proof of a deposit.
 */
export async function addFundsToBudget(amount: number, details: FundDetails, adminId: string, entryId: string = newLedgerEntryId()): Promise<void> {
  const funds = parseAmount(amount, LIMITS.maxFundsAmount);
  if (!/^[A-Za-z0-9]{1,40}$/.test(entryId)) throw new ValidationError("That funds entry id isn't valid.");
  const budgetRef = doc(db, FINANCE_COLLECTION, BUDGET_ID);
  const entryRef = doc(db, LEDGER_COLLECTION, entryId);
  const headRef = doc(db, LEDGER_HEAD_COLLECTION, LEDGER_HEAD_ID);

  try {
    await runTransaction(db, async (transaction) => {
      const [budgetSnap, headSnap, entrySnap] = await Promise.all([transaction.get(budgetRef), transaction.get(headRef), transaction.get(entryRef)]);
      // Already recorded (a retry, or a second click): the first write stands.
      if (entrySnap.exists()) return;
      if (!budgetSnap.exists()) throw new ValidationError("The budget hasn't been set up yet. Reload the page and try again.");

      const count = headSnap.exists() ? normalizeLedgerHead(headSnap.data())?.entryCount ?? 0 : 0;
      if (headSnap.exists() && count < 1) throw new ValidationError("The funds ledger's counter is unreadable. Ask a developer to check ledgerHead/state before adding funds.");

      transaction.update(budgetRef, {
        totalAvailable: increment(funds),
        updatedAt: serverTimestamp(),
      });
      transaction.set(entryRef, {
        type: "funds_added",
        amount: funds,
        source: details.source,
        ...(details.reference ? { reference: details.reference } : {}),
        description: details.description,
        receivedOn: details.receivedOn,
        createdBy: adminId,
        createdAt: serverTimestamp(),
      });
      const head = { lastEntryId: entryId, entryCount: count + 1, updatedAt: serverTimestamp() };
      if (headSnap.exists()) transaction.update(headRef, head);
      else transaction.set(headRef, head);
    });
  } catch (error) {
    // Two submissions of the same entry at once: the loser's commit meets an
    // entry that now exists and the rules refuse to rewrite it. If the entry is
    // there, the first submission stands and this one is a no-op, not a failure.
    if (error instanceof ValidationError) throw error;
    const recorded = await getDoc(entryRef).then((snap) => snap.exists(), () => false);
    if (!recorded) throw error;
  }
}

/** The ledger head (newest entry and count), or null before the first entry. Admin only. */
export function subscribeToLedgerHead(callback: (head: LedgerHead | null) => void, onError?: ListenerErrorHandler) {
  return track(
    onSnapshot(
      doc(db, LEDGER_HEAD_COLLECTION, LEDGER_HEAD_ID),
      (snap) => callback(snap.exists() ? normalizeLedgerHead(snap.data()) : null),
      (error) => onError?.(error)
    )
  );
}

/** The funds ledger, newest first (bounded). Admin only. */
export function subscribeToLedger(callback: (entries: LedgerEntry[]) => void, onError?: ListenerErrorHandler) {
  const q = query(collection(db, LEDGER_COLLECTION), orderBy("createdAt", "desc"), limitTo(200));
  return track(
    onSnapshot(
      q,
      (snapshot) => callback(snapshot.docs.map((d) => normalizeLedgerEntry(d.id, d.data({ serverTimestamps: "estimate" })))),
      (error) => onError?.(error)
    )
  );
}
