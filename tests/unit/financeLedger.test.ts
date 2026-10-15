import { describe, expect, it } from "vitest";
import {
  NO_FILTERS,
  activeFilterCount,
  availableFunds,
  buildRows,
  filterRows,
  formatInr,
  fundsRow,
  fundsTile,
  paginate,
  paymentRow,
  sortRows,
  summarizeRows,
} from "@/lib/financeLedger";
import { summarizeFinance } from "@/lib/financeRules";

const at = (iso: string) => new Date(iso);
const pay = (id: string, amount: number, extra: Record<string, unknown> = {}) => ({
  id,
  workerId: "w1",
  workerName: "Ramesh Kumar",
  amount,
  status: "approved",
  issueId: `issue-${id}`,
  note: `Receipt resolved for ${id}`,
  createdAt: at("2026-10-05T10:00:00"),
  ...extra,
});
const fund = (id: string, amount: number, extra: Record<string, unknown> = {}) => ({
  id,
  amount,
  source: "management_allocation",
  description: "Q3 allocation",
  receivedOn: "2026-10-01",
  createdBy: "admin1",
  createdAt: at("2026-10-01T09:00:00"),
  ...extra,
});

describe("available funds", () => {
  it("is what was recorded as available minus what was recorded as spent", () => {
    expect(availableFunds({ totalAvailable: 125000, totalSpent: 4550.5 })).toEqual({ state: "ok", amount: 120449.5, totalFunds: 125000, totalSpent: 4550.5 });
  });

  it("agrees with the finance summary, which the Finance page uses", () => {
    const budget = { totalAvailable: 98765.43, totalSpent: 1234.56 };
    const summary = summarizeFinance({ budget, transactions: [], ledger: [], pendingClaimAmounts: [] });
    const available = availableFunds(budget);
    expect(available.state).toBe("ok");
    if (available.state === "ok") expect(available.amount).toBe(summary.available);
  });

  it("does not subtract pending claims: they are not money that moved", () => {
    const summary = summarizeFinance({ budget: { totalAvailable: 1000, totalSpent: 0 }, transactions: [], ledger: [], pendingClaimAmounts: [1046] });
    expect(summary.available).toBe(1000);
    expect(availableFunds({ totalAvailable: 1000, totalSpent: 0 })).toMatchObject({ amount: 1000 });
  });

  it("is unavailable, not zero, when the budget is missing or unreadable", () => {
    expect(availableFunds(null)).toEqual({ state: "unavailable", reason: "missing" });
    expect(availableFunds(undefined)).toEqual({ state: "unavailable", reason: "missing" });
    expect(availableFunds({ totalAvailable: NaN, totalSpent: 0 })).toEqual({ state: "unavailable", reason: "invalid" });
    expect(availableFunds({ totalAvailable: "1000", totalSpent: 0 })).toEqual({ state: "unavailable", reason: "invalid" });
    expect(availableFunds({ totalAvailable: 100, totalSpent: -1 })).toEqual({ state: "unavailable", reason: "invalid" });
    expect(availableFunds({ totalAvailable: Infinity, totalSpent: 0 })).toEqual({ state: "unavailable", reason: "invalid" });
  });

  it("reports an overspend as a negative amount instead of hiding it", () => {
    expect(availableFunds({ totalAvailable: 100, totalSpent: 150 })).toMatchObject({ state: "ok", amount: -50 });
  });

  it("avoids floating-point residue", () => {
    expect(availableFunds({ totalAvailable: 0.3, totalSpent: 0.1 })).toMatchObject({ amount: 0.2 });
  });
});

describe("the dashboard's money tile", () => {
  it("shows the available amount with what it is made of", () => {
    const tile = fundsTile(availableFunds({ totalAvailable: 125000, totalSpent: 25000 }));
    expect(tile.value).toBe("₹1,00,000.00");
    expect(tile.hint).toContain("₹1,25,000.00 recorded as available");
    expect(tile.hint).toContain("₹25,000.00 paid out");
    expect(tile.tone).toBe("default");
  });

  it("flags an overspend in the danger tone", () => {
    expect(fundsTile(availableFunds({ totalAvailable: 100, totalSpent: 150 }))).toMatchObject({ value: "-₹50.00", tone: "danger" });
  });

  it("says plainly when there is no budget, it can't be read, or loading failed", () => {
    expect(fundsTile(availableFunds(null))).toMatchObject({ value: "Not set up" });
    expect(fundsTile(availableFunds({ totalAvailable: "x", totalSpent: 0 }))).toMatchObject({ value: "Unavailable" });
    const failed = fundsTile(availableFunds(null), { loadFailed: true });
    expect(failed.value).toBe("Unavailable");
    expect(failed.value).not.toMatch(/₹/);
  });
});

describe("formatInr", () => {
  it("uses Indian digit grouping with two decimals", () => {
    expect(formatInr(125000)).toBe("₹1,25,000.00");
    expect(formatInr(1046)).toBe("₹1,046.00");
    expect(formatInr(0)).toBe("₹0.00");
    expect(formatInr(12345678.9)).toBe("₹1,23,45,678.90");
  });

  it("puts the sign before the symbol and refuses non-numbers", () => {
    expect(formatInr(-2500.5)).toBe("-₹2,500.50");
    expect(formatInr(NaN)).toBe("—");
  });
});

describe("building rows", () => {
  it("gives payments an outgoing direction and funds an incoming one", () => {
    const rows = buildRows([pay("p1", 450)], [fund("f1", 5000)]);
    expect(rows.find((r) => r.id === "p1")).toMatchObject({ direction: "out", kind: "payment", status: "posted", amount: 450 });
    expect(rows.find((r) => r.id === "f1")).toMatchObject({ direction: "in", kind: "funds_added", status: "posted", amount: 5000 });
  });

  it("is newest first", () => {
    const rows = buildRows([pay("old", 1, { createdAt: at("2026-01-01") }), pay("new", 1, { createdAt: at("2026-09-01") })], []);
    expect(rows.map((r) => r.id)).toEqual(["new", "old"]);
  });

  it("lists a document once, even if a source repeats it", () => {
    expect(buildRows([pay("p1", 450), pay("p1", 450)], [fund("f1", 5000), fund("f1", 5000)])).toHaveLength(2);
  });

  it("does not confuse a payment with a funds entry that shares an id", () => {
    expect(buildRows([pay("same", 100)], [fund("same", 200)])).toHaveLength(2);
  });

  it("carries only what was stored", () => {
    const [row] = buildRows([pay("p1", 450, { method: "upi", reference: "UTR1", paidOn: "2026-10-04", verification: "manual", recordedBy: "admin1" })], []);
    expect(row).toMatchObject({ method: "UPI", reference: "UTR1", statedDate: "2026-10-04", manual: true, recordedBy: "admin1" });
    const [legacy] = buildRows([pay("old", 100, { method: undefined, reference: undefined, paidOn: undefined, verification: undefined, recordedBy: undefined })], []);
    expect(legacy.method).toBeUndefined();
    expect(legacy.reference).toBeUndefined();
    expect(legacy.statedDate).toBeUndefined();
    expect(legacy.recordedBy).toBeUndefined();
    expect(legacy.manual).toBe(false);
  });

  it("treats malformed amounts as zero so they cannot inflate a total", () => {
    expect(paymentRow(pay("bad", NaN)).amount).toBe(0);
    expect(paymentRow(pay("neg", -50)).amount).toBe(0);
    expect(fundsRow(fund("bad", Infinity)).amount).toBe(0);
  });

  it("maps unknown status words to posted only for the legacy default, never to money moved otherwise", () => {
    expect(paymentRow(pay("a", 1, { status: "pending" })).status).toBe("pending");
    expect(paymentRow(pay("b", 1, { status: "rejected" })).status).toBe("rejected");
    expect(paymentRow(pay("c", 1, { status: undefined })).status).toBe("posted");
  });

  it("handles empty collections", () => {
    expect(buildRows([], [])).toEqual([]);
    expect(summarizeRows([])).toEqual({ incoming: 0, outgoing: 0, net: 0, count: 0, postedCount: 0, excludedCount: 0 });
  });
});

describe("totals", () => {
  it("counts posted incoming and outgoing separately, and the net of the two", () => {
    const rows = buildRows([pay("p1", 450), pay("p2", 300.5)], [fund("f1", 5000), fund("f2", 1500)]);
    expect(summarizeRows(rows)).toEqual({ incoming: 6500, outgoing: 750.5, net: 5749.5, count: 4, postedCount: 4, excludedCount: 0 });
  });

  it("leaves pending and rejected entries out of every amount but still counts them", () => {
    const rows = buildRows([pay("p1", 450), pay("p2", 999, { status: "pending" }), pay("p3", 888, { status: "rejected" })], [fund("f1", 1000)]);
    expect(summarizeRows(rows)).toMatchObject({ incoming: 1000, outgoing: 450, net: 550, count: 4, postedCount: 2, excludedCount: 2 });
  });

  it("counts a claim and its payment once: only the payment is a movement", () => {
    // A claim lives on the issue; the payment that settles it is the only transaction.
    const rows = buildRows([pay("p1", 450, { issueId: "claim-1" })], []);
    expect(summarizeRows(rows).outgoing).toBe(450);
  });

  it("matches the budget's own spent total when every payment is posted", () => {
    const payments = [pay("p1", 450), pay("p2", 300)];
    const summary = summarizeFinance({ budget: { totalAvailable: 5000, totalSpent: 750 }, transactions: payments.map((p) => ({ amount: p.amount, status: "approved" as const })), ledger: [], pendingClaimAmounts: [] });
    expect(summarizeRows(buildRows(payments, [])).outgoing).toBe(summary.paidOut);
    expect(summary.reconciliation.ok).toBe(true);
  });
});

describe("search and filters", () => {
  const rows = buildRows(
    [
      pay("tx-aaa", 450, { reference: "UTR998877", method: "bank_transfer", createdAt: at("2026-10-05T10:00:00") }),
      pay("tx-bbb", 300, { workerName: "Priya Nair", issueId: "issue-77", createdAt: at("2026-09-20T10:00:00") }),
      pay("tx-ccc", 120, { status: "pending", createdAt: at("2026-10-07T10:00:00") }),
    ],
    [fund("fund-1", 5000, { source: "donation", description: "Alumni gift", createdAt: at("2026-10-01T09:00:00") })]
  );

  it("returns everything with no filters", () => {
    expect(filterRows(rows, NO_FILTERS)).toHaveLength(4);
    expect(activeFilterCount(NO_FILTERS)).toBe(0);
  });

  it("searches id, reference, person, issue and description, case-insensitively", () => {
    expect(filterRows(rows, { ...NO_FILTERS, query: "TX-AAA" }).map((r) => r.id)).toEqual(["tx-aaa"]);
    expect(filterRows(rows, { ...NO_FILTERS, query: "utr9988" }).map((r) => r.id)).toEqual(["tx-aaa"]);
    expect(filterRows(rows, { ...NO_FILTERS, query: "priya" }).map((r) => r.id)).toEqual(["tx-bbb"]);
    expect(filterRows(rows, { ...NO_FILTERS, query: "issue-77" }).map((r) => r.id)).toEqual(["tx-bbb"]);
    expect(filterRows(rows, { ...NO_FILTERS, query: "alumni" }).map((r) => r.id)).toEqual(["fund-1"]);
    expect(filterRows(rows, { ...NO_FILTERS, query: "no such thing" })).toEqual([]);
  });

  it("filters by direction, type and status", () => {
    expect(filterRows(rows, { ...NO_FILTERS, direction: "in" }).map((r) => r.id)).toEqual(["fund-1"]);
    expect(filterRows(rows, { ...NO_FILTERS, direction: "out" })).toHaveLength(3);
    expect(filterRows(rows, { ...NO_FILTERS, kind: "funds_added" })).toHaveLength(1);
    expect(filterRows(rows, { ...NO_FILTERS, status: "pending" }).map((r) => r.id)).toEqual(["tx-ccc"]);
  });

  it("filters by an inclusive date range", () => {
    expect(filterRows(rows, { ...NO_FILTERS, from: "2026-10-01", to: "2026-10-05" }).map((r) => r.id).sort()).toEqual(["fund-1", "tx-aaa"]);
    expect(filterRows(rows, { ...NO_FILTERS, from: "2026-10-06" }).map((r) => r.id)).toEqual(["tx-ccc"]);
    expect(filterRows(rows, { ...NO_FILTERS, to: "2026-09-30" }).map((r) => r.id)).toEqual(["tx-bbb"]);
  });

  it("filters by related issue exactly", () => {
    expect(filterRows(rows, { ...NO_FILTERS, issueId: "issue-77" }).map((r) => r.id)).toEqual(["tx-bbb"]);
    expect(filterRows(rows, { ...NO_FILTERS, issueId: "issue-7" })).toEqual([]);
  });

  it("combines filters and counts them", () => {
    const f = { ...NO_FILTERS, direction: "out" as const, status: "posted" as const, from: "2026-10-01" };
    expect(filterRows(rows, f).map((r) => r.id)).toEqual(["tx-aaa"]);
    expect(activeFilterCount(f)).toBe(3);
  });
});

describe("sorting and pagination", () => {
  const rows = buildRows(
    [pay("a", 300, { createdAt: at("2026-10-03") }), pay("b", 100, { createdAt: at("2026-10-05") }), pay("c", 200, { createdAt: at("2026-10-04") })],
    []
  );

  it("sorts by amount either way", () => {
    expect(sortRows(rows, "amount", "asc").map((r) => r.id)).toEqual(["b", "c", "a"]);
    expect(sortRows(rows, "amount", "desc").map((r) => r.id)).toEqual(["a", "c", "b"]);
  });

  it("sorts by time and does not mutate its input", () => {
    const before = rows.map((r) => r.id);
    expect(sortRows(rows, "at", "asc").map((r) => r.id)).toEqual(["a", "c", "b"]);
    expect(rows.map((r) => r.id)).toEqual(before);
  });

  it("keeps equal amounts in a stable order", () => {
    const tied = buildRows([pay("x", 50, { createdAt: at("2026-10-01") }), pay("y", 50, { createdAt: at("2026-10-02") })], []);
    expect(sortRows(tied, "amount", "asc").map((r) => r.id)).toEqual(["y", "x"]);
  });

  it("pages and clamps out-of-range pages", () => {
    const many = Array.from({ length: 45 }, (_, i) => i);
    expect(paginate(many, 1, 20)).toMatchObject({ pages: 3, page: 1, items: many.slice(0, 20) });
    expect(paginate(many, 3, 20).items).toHaveLength(5);
    expect(paginate(many, 99, 20).page).toBe(3);
    expect(paginate(many, 0, 20).page).toBe(1);
    expect(paginate([], 1, 20)).toEqual({ items: [], page: 1, pages: 1 });
  });
});
