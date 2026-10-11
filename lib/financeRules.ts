// ============================================
// Finance: shared definitions, validation and the summary
// ============================================
// Pure (no Firebase). Used by the admin Finance page, the Firestore data
// layer and the tests, so the meaning of every figure is defined in one
// place.
//
// ACCOUNTING POLICY (what each number means)
// ------------------------------------------
// The budget is one running balance, finance/budget:
//   totalAvailable  all funds ever recorded as available (opening balance
//                   plus every "funds added" entry in the ledger)
//   totalSpent      the sum of payments recorded in `transactions`
//   available       totalAvailable - totalSpent
// A claim is paid when an administrator RECORDS a payment: the claim leaves
// "pending", one `transactions` entry is written, totalSpent rises by exactly
// that amount, and the worker's earnings rise by the same amount, all in one
// atomic commit. There is no separate reservation: a pending claim does not
// reduce `available`; it is shown beside it ("available after pending
// claims") so an administrator can see a shortfall before approving.
// UniFix does not move money and has no bank or payment-gateway connection.
// A recorded payment is the administrator's statement that an external
// payment was made; it is labelled "recorded by an administrator, not
// verified" everywhere it is shown.
// Rejected claims create no entry and no expenditure. Posted entries are
// never edited or deleted; a correction would be a new, referenced entry.

import { Transaction } from "@/types";

export const PAYMENT_METHODS = ["cash", "bank_transfer", "upi", "cheque", "other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Cash",
  bank_transfer: "Bank transfer",
  upi: "UPI",
  cheque: "Cheque",
  other: "Other",
};
/** Methods that leave a reference number the payer can quote. */
export const METHODS_NEEDING_REFERENCE: PaymentMethod[] = ["bank_transfer", "upi", "cheque"];

export const FUND_SOURCES = ["management_allocation", "donation", "grant", "budget_transfer", "other"] as const;
export type FundSource = (typeof FUND_SOURCES)[number];
export const FUND_SOURCE_LABELS: Record<FundSource, string> = {
  management_allocation: "Management allocation",
  donation: "Donation",
  grant: "Grant",
  budget_transfer: "Budget transfer",
  other: "Other",
};

export const FINANCE_LIMITS = { reference: 60, description: 300, minDescription: 3 } as const;

/** A calendar date as yyyy-mm-dd (what <input type="date"> produces). */
export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export class FinanceInputError extends Error {}

function checkDate(value: string, label: string, now: Date): string {
  if (!ISO_DATE.test(value)) throw new FinanceInputError(`Choose the ${label}.`);
  const [y, m, day] = value.split("-").map(Number);
  const d = new Date(y, m - 1, day);
  // Rolled-over dates (30 February) change the month or day when rebuilt.
  if (d.getFullYear() !== y || d.getMonth() !== m - 1 || d.getDate() !== day) throw new FinanceInputError(`The ${label} isn't a real date.`);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (d.getTime() > today) throw new FinanceInputError(`The ${label} can't be in the future.`);
  return value;
}

export interface PaymentDetails {
  method: PaymentMethod;
  reference: string;
  paidOn: string;
}

/** What an administrator must say when recording that a claim was paid outside UniFix. */
export function validatePaymentDetails(input: { method: unknown; reference: unknown; paidOn: unknown }, now: Date = new Date()): PaymentDetails {
  const method = input.method;
  if (typeof method !== "string" || !(PAYMENT_METHODS as readonly string[]).includes(method)) throw new FinanceInputError("Choose how the payment was made.");
  const reference = typeof input.reference === "string" ? input.reference.replace(/\s+/g, " ").trim() : "";
  if (reference.length > FINANCE_LIMITS.reference) throw new FinanceInputError(`Keep the reference to ${FINANCE_LIMITS.reference} characters or fewer.`);
  if ((METHODS_NEEDING_REFERENCE as string[]).includes(method) && reference.length < 3) {
    throw new FinanceInputError("Enter the reference number the payer can quote (transaction, UPI or cheque number).");
  }
  const paidOn = checkDate(typeof input.paidOn === "string" ? input.paidOn : "", "payment date", now);
  return { method: method as PaymentMethod, reference, paidOn };
}

export interface FundDetails {
  source: FundSource;
  reference: string;
  description: string;
  receivedOn: string;
}

/** What an administrator must say when recording funds made available to the budget. */
export function validateFundDetails(input: { source: unknown; reference: unknown; description: unknown; receivedOn: unknown }, now: Date = new Date()): FundDetails {
  const source = input.source;
  if (typeof source !== "string" || !(FUND_SOURCES as readonly string[]).includes(source)) throw new FinanceInputError("Choose where the funds come from.");
  const reference = typeof input.reference === "string" ? input.reference.replace(/\s+/g, " ").trim() : "";
  if (reference.length > FINANCE_LIMITS.reference) throw new FinanceInputError(`Keep the reference to ${FINANCE_LIMITS.reference} characters or fewer.`);
  const description = typeof input.description === "string" ? input.description.replace(/\s+/g, " ").trim() : "";
  if (description.length < FINANCE_LIMITS.minDescription) throw new FinanceInputError("Say briefly why the funds are being added.");
  if (description.length > FINANCE_LIMITS.description) throw new FinanceInputError(`Keep the reason to ${FINANCE_LIMITS.description} characters or fewer.`);
  const receivedOn = checkDate(typeof input.receivedOn === "string" ? input.receivedOn : "", "date", now);
  return { source: source as FundSource, reference, description, receivedOn };
}

// ---------- the summary ----------

export interface LedgerFundEntry {
  id: string;
  amount: number;
  createdAt: Date;
}

export interface FinanceSummary {
  /** Everything recorded as available, including the opening balance. */
  totalFunds: number;
  /** Of totalFunds, what the ledger accounts for as "funds added". */
  fundsAdded: number;
  /** totalFunds - fundsAdded: the opening balance and any additions made before the ledger existed. */
  openingBalance: number;
  /** Payments recorded (sum of transactions). */
  paidOut: number;
  /** totalFunds - the budget's own totalSpent. */
  available: number;
  pendingClaimsCount: number;
  pendingClaimsAmount: number;
  /** available - pending claims; negative means the pending claims would overspend the budget. */
  availableAfterPending: number;
  shortfall: number;
  paymentCount: number;
  reconciliation: {
    ok: boolean;
    /** budget.totalSpent - sum of recorded payments. 0 when consistent. */
    spentDifference: number;
    message: string;
  };
  /** The ledger's entry count agrees with ledgerHead/state. */
  ledgerCount: { ok: boolean; entries: number; head: number | null; message: string };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function summarizeFinance(input: {
  budget: { totalAvailable: number; totalSpent: number } | null;
  transactions: Pick<Transaction, "amount" | "status">[];
  ledger: LedgerFundEntry[];
  pendingClaimAmounts: number[];
  /** ledgerHead/state; null when the ledger has no entries yet. */
  ledgerHead?: { entryCount: number } | null;
  /** How many entries the ledger query is capped at, so a full page isn't read as a mismatch. */
  ledgerPageSize?: number;
}): FinanceSummary {
  const totalFunds = round2(input.budget?.totalAvailable ?? 0);
  const totalSpent = round2(input.budget?.totalSpent ?? 0);
  // Only posted payments count: a pending, rejected or failed entry is not expenditure.
  const paidOut = round2(input.transactions.filter((t) => t.status === "approved").reduce((s, t) => s + t.amount, 0));
  const fundsAdded = round2(input.ledger.reduce((s, e) => s + e.amount, 0));
  const pendingClaimsAmount = round2(input.pendingClaimAmounts.filter((a) => a > 0).reduce((s, a) => s + a, 0));
  const available = round2(totalFunds - totalSpent);
  const availableAfterPending = round2(available - pendingClaimsAmount);
  const spentDifference = round2(totalSpent - paidOut);
  const ok = Math.abs(spentDifference) < 0.005;

  // The ledger is read newest-first up to a page; only compare when the whole ledger was read.
  const pageSize = input.ledgerPageSize ?? 200;
  const entries = input.ledger.length;
  const head = input.ledgerHead === undefined ? undefined : input.ledgerHead ? input.ledgerHead.entryCount : 0;
  const comparable = head !== undefined && entries < pageSize;
  const countOk = !comparable || head === entries;
  return {
    totalFunds,
    fundsAdded,
    openingBalance: round2(totalFunds - fundsAdded),
    paidOut,
    available,
    pendingClaimsCount: input.pendingClaimAmounts.filter((a) => a > 0).length,
    pendingClaimsAmount,
    availableAfterPending,
    shortfall: availableAfterPending < 0 ? round2(-availableAfterPending) : 0,
    paymentCount: input.transactions.filter((t) => t.status === "approved").length,
    reconciliation: {
      ok,
      spentDifference,
      message: ok
        ? "The budget's spent total matches the recorded payments."
        : spentDifference > 0
          ? "The budget shows more spent than the recorded payments add up to. Do not pay further claims until this is explained."
          : "The recorded payments add up to more than the budget shows as spent. Do not pay further claims until this is explained.",
    },
    ledgerCount: {
      ok: countOk,
      entries,
      head: head ?? null,
      message: countOk
        ? "The funds ledger's entry count matches its counter."
        : `The funds ledger has ${entries} entr${entries === 1 ? "y" : "ies"} but its counter says ${head}. Do not add funds until this is explained.`,
    },
  };
}
