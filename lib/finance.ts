// ============================================
// Finance and Budget Operations
// ============================================

import { collection, doc, getDoc, setDoc, updateDoc, addDoc, query, where, getDocs, onSnapshot, Timestamp, increment, runTransaction } from "firebase/firestore";
import { db } from "./firebase";
import { Budget, Transaction, User, Issue } from "@/types";

const BUDGET_ID = "budget";
const TRANSACTIONS_COLLECTION = "transactions";
const USERS_COLLECTION = "users";

/**
 * Initializes or fetches the global budget.
 */
export async function getGlobalBudget(): Promise<Budget> {
  const docRef = doc(db, "finance", BUDGET_ID);
  const snap = await getDoc(docRef);
  if (snap.exists()) {
    return { id: snap.id, ...snap.data() } as Budget;
  } else {
    // Scaffold initial budget if none exists
    const initial: Omit<Budget, 'id'> = {
      totalAvailable: 500000, // 5 Lakhs default
      totalSpent: 0,
      updatedAt: new Date(),
    };
    await setDoc(docRef, initial);
    return { id: BUDGET_ID, ...initial };
  }
}

/** Subscribe to live budget updates */
export function subscribeToBudget(callback: (budget: Budget | null) => void) {
  return onSnapshot(doc(db, "finance", BUDGET_ID), (snap) => {
    if (snap.exists()) {
      callback({ id: snap.id, ...snap.data() } as Budget);
    } else {
      callback(null);
    }
  });
}

/** Subscribe to live transaction updates globally or per worker */
export function subscribeToTransactions(workerId: string | null, callback: (tx: Transaction[]) => void) {
  const coll = collection(db, TRANSACTIONS_COLLECTION);
  const q = workerId ? query(coll, where("workerId", "==", workerId)) : query(coll);
  
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map(doc => {
      const d = doc.data();
      return {
        id: doc.id,
        ...d,
        createdAt: d.createdAt instanceof Timestamp ? d.createdAt.toDate() : new Date(),
      } as Transaction;
    }).sort((a,b) => b.createdAt.getTime() - a.createdAt.getTime());
    callback(data);
  });
}

/** Get all registered workers */
export async function getAllWorkers(): Promise<User[]> {
  const q = query(collection(db, USERS_COLLECTION), where("role", "==", "worker"));
  const snap = await getDocs(q);
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
}

/** 
 * Admin creates a direct payment transaction or approves a receipt.
 * This runs a transaction batch: Deducts from budget, increments worker earnings, and records transaction.
 */
export async function executePayment(
  workerId: string,
  workerName: string,
  amount: number,
  type: "receipt" | "direct",
  note?: string,
  issueId?: string,
  receiptUrl?: string
): Promise<void> {
  const budgetRef = doc(db, "finance", BUDGET_ID);
  const workerRef = doc(db, USERS_COLLECTION, workerId);
  const newTxRef = doc(collection(db, TRANSACTIONS_COLLECTION));
  const issueRef = issueId ? doc(db, "issues", issueId) : null;

  await runTransaction(db, async (transaction) => {
    const budgetSnap = await transaction.get(budgetRef);
    if (!budgetSnap.exists()) throw new Error("Budget does not exist!");

    // 1. Update Global Budget
    transaction.update(budgetRef, {
      totalSpent: increment(amount),
      updatedAt: Timestamp.now()
    });

    // 2. Add Earnings to Worker
    transaction.update(workerRef, {
      earnings: increment(amount)
    });

    // 3. Log the Transaction History
    transaction.set(newTxRef, {
      workerId,
      workerName,
      amount,
      type,
      note: note || "",
      issueId: issueId || "",
      receiptUrl: receiptUrl || "",
      status: "approved",
      createdAt: Timestamp.now()
    });

    // 4. Update the Issue claim status if applicable
    if (issueRef) {
      transaction.update(issueRef, {
        claimStatus: "approved"
      });
    }
  });
}

/** Reject a receipt claim */
export async function rejectReceipt(issueId: string): Promise<void> {
  const issueRef = doc(db, "issues", issueId);
  await updateDoc(issueRef, {
    claimStatus: "rejected"
  });
}

/** Add funds to global budget */
export async function addFundsToBudget(amount: number): Promise<void> {
  const budgetRef = doc(db, "finance", BUDGET_ID);
  await setDoc(budgetRef, {
    totalAvailable: increment(amount),
    updatedAt: Timestamp.now()
  }, { merge: true });
}
