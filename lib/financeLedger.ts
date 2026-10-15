// The one place that turns the finance collections into figures and rows.
//
// Pure functions, no Firebase: the signed-in Transactions page, the dashboard's
// "Total money available" card and Explore Mode's demo all go through here, so
// a balance can never be computed two different ways.
//
// What the collections mean (see docs/CHAT_AI_FINANCE.md):
//   finance/budget  totalAvailable = opening balance + every funds addition
//                   totalSpent     = every payment recorded
//   ledger/{id}     one immutable entry per funds addition (incoming)
//   transactions    one immutable entry per recorded payment (outgoing)
// Nothing here invents a field. A pending claim is not a transaction and is
// never counted as money that moved.

import { FUND_SOURCE_LABELS, FundSource, PAYMENT_METHOD_LABELS, PaymentMethod } from "./financeRules";

const round2 = (n: number) => Math.round(n * 100) / 100;
const finiteNonNegative = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0;

// ---------- available funds ----------

export type AvailableFunds =
  | { state: "ok"; amount: number; totalFunds: number; totalSpent: number }
  | { state: "unavailable"; reason: "missing" | "invalid" };

/**
 * Funds available right now: everything recorded as available minus
 * everything recorded as spent. This is the same subtraction summarizeFinance
 * uses; it is defined once here. A missing budget or unreadable numbers give
 * an explicit "unavailable" rather than a made-up amount.
 */
export function availableFunds(budget: { totalAvailable: unknown; totalSpent: unknown } | null | undefined): AvailableFunds {
  if (!budget) return { state: "unavailable", reason: "missing" };
  if (!finiteNonNegative(budget.totalAvailable) || !finiteNonNegative(budget.totalSpent)) return { state: "unavailable", reason: "invalid" };
  const totalFunds = round2(budget.totalAvailable);
  const totalSpent = round2(budget.totalSpent);
  return { state: "ok", amount: round2(totalFunds - totalSpent), totalFunds, totalSpent };
}

/** Indian digit grouping with two decimals: ₹1,25,000.00 */
export function formatInr(amount: number): string {
  if (!Number.isFinite(amount)) return "—";
  const sign = amount < 0 ? "-" : "";
  return `${sign}₹${Math.abs(amount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export interface FundsTile {
  value: string;
  hint: string;
  tone: "default" | "danger";
}

/** What the dashboard's "Total money available" tile says for each state. */
export function fundsTile(funds: AvailableFunds, opts: { loadFailed?: boolean } = {}): FundsTile {
  if (opts.loadFailed) return { value: "Unavailable", hint: "The budget couldn't be loaded. Open Finance or refresh to try again.", tone: "default" };
  if (funds.state === "unavailable") {
    return funds.reason === "missing"
      ? { value: "Not set up", hint: "No budget has been created yet. Add funds on the Finance page.", tone: "default" }
      : { value: "Unavailable", hint: "The budget record couldn't be read, so no figure is shown.", tone: "default" };
  }
  return {
    value: formatInr(funds.amount),
    hint: `${formatInr(funds.totalFunds)} recorded as available, ${formatInr(funds.totalSpent)} paid out`,
    tone: funds.amount < 0 ? "danger" : "default",
  };
}

// ---------- rows ----------

export type Direction = "in" | "out";
export type RowKind = "payment" | "funds_added";
/** posted = money moved as recorded; the others are never counted in totals. */
export type RowStatus = "posted" | "pending" | "rejected";

export interface LedgerRow {
  /** Unique within the list: "<kind>:<document id>". */
  key: string;
  /** The document id (shown as the transaction ID). */
  id: string;
  kind: RowKind;
  direction: Direction;
  /** Always positive; the direction says which way it moved. */
  amount: number;
  at: Date;
  status: RowStatus;
  /** One line: what this entry is. */
  title: string;
  /** Who was paid, or where the funds came from. */
  party?: string;
  issueId?: string;
  workerId?: string;
  method?: string;
  reference?: string;
  /** The date the administrator stated, yyyy-mm-dd (paid on / received on). */
  statedDate?: string;
  recordedBy?: string;
  /** Recorded by an administrator; UniFix has no bank or gateway to confirm it. */
  manual: boolean;
  note?: string;
}

export interface PaymentInput {
  id: string;
  workerId?: string;
  workerName?: string;
  amount: number;
  status?: "pending" | "approved" | "rejected" | string;
  issueId?: string;
  note?: string;
  method?: string;
  reference?: string;
  paidOn?: string;
  verification?: string;
  recordedBy?: string;
  createdAt: Date;
}

export interface FundsInput {
  id: string;
  amount: number;
  source?: string;
  reference?: string;
  description?: string;
  receivedOn?: string;
  createdBy?: string;
  createdAt: Date;
}

const STATUS: Record<string, RowStatus> = { approved: "posted", pending: "pending", rejected: "rejected" };

export function paymentRow(t: PaymentInput): LedgerRow {
  const method = t.method && t.method in PAYMENT_METHOD_LABELS ? PAYMENT_METHOD_LABELS[t.method as PaymentMethod] : undefined;
  return {
    key: `payment:${t.id}`,
    id: t.id,
    kind: "payment",
    direction: "out",
    amount: finiteNonNegative(t.amount) ? round2(t.amount) : 0,
    at: t.createdAt,
    status: STATUS[t.status ?? "approved"] ?? "posted",
    title: t.note?.trim() || "Payment",
    party: t.workerName?.trim() || undefined,
    issueId: t.issueId || undefined,
    workerId: t.workerId || undefined,
    method,
    reference: t.reference || undefined,
    statedDate: t.paidOn || undefined,
    recordedBy: t.recordedBy || undefined,
    manual: t.verification === "manual",
    note: t.note?.trim() || undefined,
  };
}

export function fundsRow(e: FundsInput): LedgerRow {
  const source = e.source && e.source in FUND_SOURCE_LABELS ? FUND_SOURCE_LABELS[e.source as FundSource] : undefined;
  return {
    key: `funds_added:${e.id}`,
    id: e.id,
    kind: "funds_added",
    direction: "in",
    amount: finiteNonNegative(e.amount) ? round2(e.amount) : 0,
    at: e.createdAt,
    status: "posted",
    title: e.description?.trim() || "Funds added",
    party: source,
    reference: e.reference || undefined,
    statedDate: e.receivedOn || undefined,
    recordedBy: e.createdBy || undefined,
    manual: true,
    note: e.description?.trim() || undefined,
  };
}

/** One list, newest first. A document id is listed once even if a source repeats it. */
export function buildRows(payments: PaymentInput[], funds: FundsInput[]): LedgerRow[] {
  const seen = new Set<string>();
  const rows: LedgerRow[] = [];
  for (const row of [...payments.map(paymentRow), ...funds.map(fundsRow)]) {
    if (seen.has(row.key)) continue;
    seen.add(row.key);
    rows.push(row);
  }
  return sortRows(rows, "at", "desc");
}

// ---------- filter, sort, paginate ----------

export interface RowFilters {
  query: string;
  direction: "all" | Direction;
  kind: "all" | RowKind;
  status: "all" | RowStatus;
  /** yyyy-mm-dd, inclusive, in the viewer's local time. */
  from: string;
  to: string;
  /** Rows tied to one issue (claim). */
  issueId: string;
}

export const NO_FILTERS: RowFilters = { query: "", direction: "all", kind: "all", status: "all", from: "", to: "", issueId: "" };

export function activeFilterCount(f: RowFilters): number {
  return [f.query.trim(), f.direction !== "all", f.kind !== "all", f.status !== "all", f.from, f.to, f.issueId.trim()].filter(Boolean).length;
}

function localDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function filterRows(rows: LedgerRow[], f: RowFilters): LedgerRow[] {
  const q = f.query.trim().toLowerCase();
  const issue = f.issueId.trim().toLowerCase();
  return rows.filter((r) => {
    if (f.direction !== "all" && r.direction !== f.direction) return false;
    if (f.kind !== "all" && r.kind !== f.kind) return false;
    if (f.status !== "all" && r.status !== f.status) return false;
    if (issue && (r.issueId ?? "").toLowerCase() !== issue) return false;
    if (f.from || f.to) {
      const day = localDay(r.at);
      if (f.from && day < f.from) return false;
      if (f.to && day > f.to) return false;
    }
    if (q) {
      const haystack = [r.id, r.reference, r.issueId, r.party, r.title, r.method, r.statedDate, r.recordedBy].filter(Boolean).join(" ").toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

export type SortKey = "at" | "amount" | "kind" | "status";
const STATUS_ORDER: Record<RowStatus, number> = { posted: 0, pending: 1, rejected: 2 };

export function sortRows(rows: LedgerRow[], key: SortKey, dir: "asc" | "desc"): LedgerRow[] {
  const sign = dir === "asc" ? 1 : -1;
  const cmp = (a: LedgerRow, b: LedgerRow): number => {
    switch (key) {
      case "amount":
        return a.amount - b.amount;
      case "kind":
        return a.kind.localeCompare(b.kind);
      case "status":
        return STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
      default:
        return a.at.getTime() - b.at.getTime();
    }
  };
  // Ties fall back to time then id so the order never shuffles between renders.
  return [...rows].sort((a, b) => sign * cmp(a, b) || b.at.getTime() - a.at.getTime() || a.key.localeCompare(b.key));
}

export function paginate<T>(rows: T[], page: number, pageSize: number): { items: T[]; page: number; pages: number } {
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(Math.max(1, Math.floor(page) || 1), pages);
  return { items: rows.slice((current - 1) * pageSize, current * pageSize), page: current, pages };
}

// ---------- totals ----------

export interface RowTotals {
  /** Posted incoming funds. */
  incoming: number;
  /** Posted outgoing payments. */
  outgoing: number;
  /** incoming - outgoing: movement within the rows given, not a balance. */
  net: number;
  /** Rows given, whatever their status. */
  count: number;
  postedCount: number;
  /** Rows that are not posted and so are left out of the amounts above. */
  excludedCount: number;
}

export function summarizeRows(rows: LedgerRow[]): RowTotals {
  let incoming = 0;
  let outgoing = 0;
  let postedCount = 0;
  for (const r of rows) {
    if (r.status !== "posted") continue;
    postedCount++;
    if (r.direction === "in") incoming += r.amount;
    else outgoing += r.amount;
  }
  incoming = round2(incoming);
  outgoing = round2(outgoing);
  return { incoming, outgoing, net: round2(incoming - outgoing), count: rows.length, postedCount, excludedCount: rows.length - postedCount };
}

export const ROW_STATUS_LABELS: Record<RowStatus, string> = { posted: "Posted", pending: "Pending", rejected: "Rejected" };
export const ROW_KIND_LABELS: Record<RowKind, string> = { payment: "Payment", funds_added: "Funds added" };
