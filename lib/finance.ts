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
  runTransaction,
} from "firebase/firestore";
import { db } from "./firebase";
import { Budget, Transaction, User } from "@/types";
import { LIMITS } from "./constants";
import { ValidationError } from "./errors";
import { ListenerErrorHandler } from "./firestore";
import { track } from "./listeners";
import { normalizeBudget, normalizeIssue, normalizeTransaction, normalizeUser } from "./models";
import { queueNotification } from "./notifications";
import { queueEvent } from "./timeline";
import { parseAmount } from "./validation";
import { payoutNote } from "./claims";
import { assertRealId } from "./sharedRules";

const BUDGET_ID = "budget";
const FINANCE_COLLECTION = "finance";
const TRANSACTIONS_COLLECTION = "transactions";
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
 * Admin approves a worker's expense claim and pays it out.
 * One atomic transaction: deducts from the budget, credits the worker,
 * records the payment and marks the claim approved.
 *
 * The amount and payee are read from the issue inside the transaction —
 * not taken from what the browser happens to be showing — and the claim
 * must still be pending, so a double click or two admins acting at once
 * can't pay the same claim twice.
 */
export async function approveClaim(issueId: string, workerName: string, adminId: string): Promise<void> {
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

/** Add funds to global budget */
export async function addFundsToBudget(amount: number): Promise<void> {
  const funds = parseAmount(amount, LIMITS.maxFundsAmount);
  const budgetRef = doc(db, FINANCE_COLLECTION, BUDGET_ID);

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(budgetRef);
    if (snap.exists()) {
      transaction.update(budgetRef, {
        totalAvailable: increment(funds),
        updatedAt: serverTimestamp(),
      });
    } else {
      transaction.set(budgetRef, {
        totalAvailable: funds,
        totalSpent: 0,
        updatedAt: serverTimestamp(),
      });
    }
  });
}
