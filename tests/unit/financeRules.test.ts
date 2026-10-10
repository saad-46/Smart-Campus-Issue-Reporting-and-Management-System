import { describe, expect, it } from "vitest";
import {
  FinanceInputError,
  summarizeFinance,
  validateFundDetails,
  validatePaymentDetails,
} from "@/lib/financeRules";

const NOW = new Date("2026-10-11T10:00:00");
const tx = (amount: number, status: "approved" | "pending" | "rejected" = "approved") => ({ amount, status });

describe("finance summary: what each figure means", () => {
  it("separates funds, recorded payments and what is available", () => {
    const s = summarizeFinance({
      budget: { totalAvailable: 500_000 + 50_000, totalSpent: 1_000 },
      transactions: [tx(400), tx(600)],
      ledger: [{ id: "l1", amount: 50_000, createdAt: NOW }],
      pendingClaimAmounts: [],
    });
    expect(s.totalFunds).toBe(550_000);
    expect(s.fundsAdded).toBe(50_000);
    expect(s.openingBalance).toBe(500_000);
    expect(s.paidOut).toBe(1_000);
    expect(s.available).toBe(549_000);
    expect(s.paymentCount).toBe(2);
    expect(s.reconciliation.ok).toBe(true);
  });

  it("does not count a pending claim as spent, and shows the shortfall it would cause", () => {
    const s = summarizeFinance({ budget: { totalAvailable: 1_000, totalSpent: 700 }, transactions: [tx(700)], ledger: [], pendingClaimAmounts: [200, 250] });
    expect(s.paidOut).toBe(700);
    expect(s.available).toBe(300);
    expect(s.pendingClaimsCount).toBe(2);
    expect(s.pendingClaimsAmount).toBe(450);
    expect(s.availableAfterPending).toBe(-150);
    expect(s.shortfall).toBe(150);
  });

  it("does not count rejected or pending entries as expenditure", () => {
    const s = summarizeFinance({ budget: { totalAvailable: 1_000, totalSpent: 100 }, transactions: [tx(100), tx(900, "rejected"), tx(50, "pending")], ledger: [], pendingClaimAmounts: [] });
    expect(s.paidOut).toBe(100);
    expect(s.paymentCount).toBe(1);
    expect(s.reconciliation.ok).toBe(true);
  });

  it("flags a budget that disagrees with the recorded payments, in either direction", () => {
    const more = summarizeFinance({ budget: { totalAvailable: 1_000, totalSpent: 500 }, transactions: [tx(300)], ledger: [], pendingClaimAmounts: [] });
    expect(more.reconciliation.ok).toBe(false);
    expect(more.reconciliation.spentDifference).toBe(200);
    expect(more.reconciliation.message).toMatch(/do not pay further claims/i);
    const less = summarizeFinance({ budget: { totalAvailable: 1_000, totalSpent: 100 }, transactions: [tx(300)], ledger: [], pendingClaimAmounts: [] });
    expect(less.reconciliation.ok).toBe(false);
    expect(less.reconciliation.spentDifference).toBe(-200);
  });

  it("is exact to the paisa and does not drift", () => {
    const amounts = Array.from({ length: 100 }, () => 0.1);
    const s = summarizeFinance({ budget: { totalAvailable: 100, totalSpent: 10 }, transactions: amounts.map((a) => tx(a)), ledger: [], pendingClaimAmounts: [] });
    expect(s.paidOut).toBe(10);
    expect(s.reconciliation.ok).toBe(true);
  });

  it("handles a budget that has not been set up and a ledger larger than the budget", () => {
    const none = summarizeFinance({ budget: null, transactions: [], ledger: [], pendingClaimAmounts: [] });
    expect(none.totalFunds).toBe(0);
    expect(none.reconciliation.ok).toBe(true);
    const odd = summarizeFinance({ budget: { totalAvailable: 100, totalSpent: 0 }, transactions: [], ledger: [{ id: "x", amount: 300, createdAt: NOW }], pendingClaimAmounts: [] });
    expect(odd.openingBalance).toBe(-200); // surfaced, not hidden: the ledger exceeds the recorded funds
  });

  it("ignores non-positive pending amounts", () => {
    const s = summarizeFinance({ budget: { totalAvailable: 100, totalSpent: 0 }, transactions: [], ledger: [], pendingClaimAmounts: [0, -5, 20] });
    expect(s.pendingClaimsCount).toBe(1);
    expect(s.pendingClaimsAmount).toBe(20);
  });
});

describe("recording a payment", () => {
  const ok = { method: "bank_transfer", reference: "UTR 123456", paidOn: "2026-10-10" };

  it("accepts complete details and trims the reference", () => {
    expect(validatePaymentDetails({ ...ok, reference: "  UTR   123456 " }, NOW)).toEqual({ method: "bank_transfer", reference: "UTR 123456", paidOn: "2026-10-10" });
    expect(validatePaymentDetails({ method: "cash", reference: "", paidOn: "2026-10-11" }, NOW).method).toBe("cash");
  });

  it.each([
    ["no method", { ...ok, method: "" }, /how the payment/i],
    ["an unknown method", { ...ok, method: "bitcoin" }, /how the payment/i],
    ["a bank transfer with no reference", { ...ok, reference: "" }, /reference number/i],
    ["a UPI payment with a one-character reference", { method: "upi", reference: "1", paidOn: "2026-10-10" }, /reference number/i],
    ["an over-long reference", { ...ok, reference: "x".repeat(61) }, /60 characters/],
    ["a missing date", { ...ok, paidOn: "" }, /payment date/],
    ["a future date", { ...ok, paidOn: "2026-10-12" }, /future/],
    ["a malformed date", { ...ok, paidOn: "10/10/2026" }, /payment date/],
    ["an impossible date", { ...ok, paidOn: "2026-02-30" }, /real date/],
    ["a non-string date", { ...ok, paidOn: 20261010 }, /payment date/],
  ])("rejects %s", (_name, input, message) => {
    expect(() => validatePaymentDetails(input as never, NOW)).toThrow(FinanceInputError);
    expect(() => validatePaymentDetails(input as never, NOW)).toThrow(message);
  });
});

describe("recording funds", () => {
  const ok = { source: "management_allocation", reference: "Sanction 14/2026", description: "Q3 maintenance allocation", receivedOn: "2026-10-01" };

  it("accepts complete details", () => {
    expect(validateFundDetails(ok, NOW)).toEqual({ source: "management_allocation", reference: "Sanction 14/2026", description: "Q3 maintenance allocation", receivedOn: "2026-10-01" });
    expect(validateFundDetails({ ...ok, reference: "" }, NOW).reference).toBe("");
  });

  it.each([
    ["an unknown source", { ...ok, source: "found it" }, /where the funds/i],
    ["no reason", { ...ok, description: "  " }, /why the funds/i],
    ["an over-long reason", { ...ok, description: "x".repeat(301) }, /300 characters/],
    ["a future date", { ...ok, receivedOn: "2027-01-01" }, /future/],
    ["no date", { ...ok, receivedOn: "" }, /Choose the date/],
  ])("rejects %s", (_name, input, message) => {
    expect(() => validateFundDetails(input as never, NOW)).toThrow(message);
  });
});
