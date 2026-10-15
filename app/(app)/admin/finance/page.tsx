"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Download, FileImage, Plus, Receipt, Wallet } from "lucide-react";
import { getReceiptImage, subscribeToPendingClaims } from "@/lib/firestore";
import { subscribeToBudget, subscribeToTransactions, subscribeToLedger, subscribeToLedgerHead, newLedgerEntryId, getAllWorkers, approveClaim, rejectReceipt, getGlobalBudget, addFundsToBudget } from "@/lib/finance";
import { Issue, Budget, LedgerEntry, LedgerHead, Transaction, User } from "@/types";
import {
  FUND_SOURCES,
  FUND_SOURCE_LABELS,
  FinanceInputError,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  METHODS_NEEDING_REFERENCE,
  PaymentMethod,
  FundSource,
  summarizeFinance,
  validateFundDetails,
  validatePaymentDetails,
} from "@/lib/financeRules";
import { downloadText, toCsv } from "@/lib/export";
import { LIMITS } from "@/lib/constants";
import { formatDate } from "@/lib/dates";
import { getFriendlyErrorMessage, logError } from "@/lib/errors";
import { parseAmount } from "@/lib/validation";
import ImageModal from "@/components/ImageModal";
import { useAuthContext } from "@/components/AuthProvider";
import PageHeader from "@/components/ui/PageHeader";
import Card, { CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Dialog, { ConfirmDialog } from "@/components/ui/Dialog";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { DescriptionList, StatStrip, TableWrap, td, th, trHover } from "@/components/ui/Data";
import { EmptyState, Notice, Skeleton, SkeletonRows } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { currency } from "@/components/admin/Kpi";
import { payoutLabel } from "@/lib/claims";

/** Payments and funds as one CSV. Contains no receipt images and no reporter details. */
function exportLedger(transactions: Transaction[], ledger: LedgerEntry[]) {
  type Row = { kind: string; recorded: string; date: string; who: string; description: string; method: string; reference: string; amount: number };
  const rows: Row[] = [
    ...ledger.map((e) => ({
      kind: "funds added",
      recorded: e.createdAt.toISOString(),
      date: e.receivedOn,
      who: "",
      description: `${FUND_SOURCE_LABELS[e.source]}: ${e.description}`,
      method: "",
      reference: e.reference,
      amount: e.amount,
    })),
    ...transactions.map((t) => ({
      kind: "payment recorded",
      recorded: t.createdAt.toISOString(),
      date: t.paidOn ?? "",
      who: t.workerName,
      description: payoutLabel(t.note),
      method: t.method ? PAYMENT_METHOD_LABELS[t.method] : "",
      reference: t.reference ?? "",
      amount: -t.amount,
    })),
  ].sort((a, b) => b.recorded.localeCompare(a.recorded));
  const csv = toCsv(rows, [
    { header: "Type", value: (r: Row) => r.kind },
    { header: "Recorded at", value: (r: Row) => r.recorded },
    { header: "Date stated", value: (r: Row) => r.date },
    { header: "Worker", value: (r: Row) => r.who },
    { header: "Description", value: (r: Row) => r.description },
    { header: "Method", value: (r: Row) => r.method },
    { header: "Reference", value: (r: Row) => r.reference },
    { header: "Amount (INR; payments negative)", value: (r: Row) => r.amount },
  ]);
  downloadText(`unifix-finance-${new Date().toISOString().slice(0, 10)}.csv`, csv, "text/csv");
}

export default function AdminFinancePage() {
  const { userProfile } = useAuthContext();
  const toast = useToast();
  const adminId = userProfile?.id ?? "";
  const [pendingClaims, setPendingClaims] = useState<Issue[] | null>(null);
  const [budget, setBudget] = useState<Budget | null>(null);
  const [transactions, setTransactions] = useState<Transaction[] | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[] | null>(null);
  // undefined = not read yet, null = no entries yet
  const [ledgerHead, setLedgerHead] = useState<LedgerHead | null | undefined>(undefined);
  // One id per funds entry being submitted: a retry or a second click is the same entry, recorded once.
  const [fundsEntryId, setFundsEntryId] = useState("");
  const [workers, setWorkers] = useState<User[]>([]);
  const [loadError, setLoadError] = useState("");
  const [retryKey, setRetryKey] = useState(0);

  const [fundsOpen, setFundsOpen] = useState(false);
  const [fundsAmount, setFundsAmount] = useState("");
  const [fundsTouched, setFundsTouched] = useState(false);
  const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
  const [fundsSource, setFundsSource] = useState<FundSource>("management_allocation");
  const [fundsReference, setFundsReference] = useState("");
  const [fundsReason, setFundsReason] = useState("");
  const [fundsDate, setFundsDate] = useState(today);
  const [fundsFormError, setFundsFormError] = useState("");
  const [payMethod, setPayMethod] = useState<PaymentMethod>("bank_transfer");
  const [payReference, setPayReference] = useState("");
  const [payDate, setPayDate] = useState(today);
  const [payError, setPayError] = useState("");
  const fundsInputRef = useRef<HTMLInputElement>(null);
  const [review, setReview] = useState<Issue | null>(null);
  const [confirm, setConfirm] = useState<"pay" | "reject" | null>(null);
  const [processing, setProcessing] = useState(false);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  // undefined = loading, "" = none / unavailable
  const [receiptImage, setReceiptImage] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    setLoadError("");
    const onError = (operation: string) => (err: unknown) => {
      logError(operation, err);
      if (!cancelled) setLoadError(getFriendlyErrorMessage(err, "We couldn't load finance data. Please check your connection and try again."));
    };
    getGlobalBudget().catch(onError("getGlobalBudget"));
    const unsubClaims = subscribeToPendingClaims(setPendingClaims, onError("subscribeToPendingClaims"));
    const unsubBudget = subscribeToBudget(setBudget, onError("subscribeToBudget"));
    const unsubTx = subscribeToTransactions(null, setTransactions, onError("subscribeToTransactions"));
    const unsubLedger = subscribeToLedger(setLedger, onError("subscribeToLedger"));
    const unsubHead = subscribeToLedgerHead(setLedgerHead, onError("subscribeToLedgerHead"));
    getAllWorkers()
      .then((data) => {
        if (!cancelled) setWorkers(data);
      })
      .catch(onError("getAllWorkers"));
    return () => {
      cancelled = true;
      unsubClaims();
      unsubBudget();
      unsubTx();
      unsubLedger();
      unsubHead();
    };
  }, [retryKey]);

  // The receipt is private to the worker and admins; fetched only when a claim is opened.
  const latestReview = useRef(review);
  useEffect(() => {
    latestReview.current = review;
  });
  const reviewId = review?.id;
  useEffect(() => {
    setReceiptImage(undefined);
    const current = latestReview.current;
    if (!current) return;
    let cancelled = false;
    getReceiptImage(current)
      .then((image) => {
        if (!cancelled) setReceiptImage(image);
      })
      .catch((err) => {
        logError("getReceiptImage", err);
        if (!cancelled) setReceiptImage("");
      });
    return () => {
      cancelled = true;
    };
  }, [reviewId]);

  const workerName = useMemo(() => {
    const map = new Map(workers.map((w) => [w.id, w.name]));
    return (id: string) => map.get(id) ?? "Worker";
  }, [workers]);

  // A receipt photo is optional, so a claim is identified by its status.
  const claims = useMemo(() => (pendingClaims ?? []).filter((i) => (i.claimAmount ?? 0) > 0), [pendingClaims]);
  const pendingTotal = claims.reduce((s, i) => s + (i.claimAmount ?? 0), 0);
  const summary = useMemo(
    () =>
      summarizeFinance({
        budget,
        transactions: transactions ?? [],
        ledger: ledger ?? [],
        pendingClaimAmounts: claims.map((c) => c.claimAmount ?? 0),
        ledgerHead: ledgerHead === undefined || ledger === null ? undefined : ledgerHead,
      }),
    [budget, transactions, ledger, ledgerHead, claims]
  );
  const available = Math.max(0, summary.available);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
  const paidThisMonth = (transactions ?? []).filter((t) => t.createdAt.getTime() >= monthStart).reduce((s, t) => s + t.amount, 0);
  const spentPct = budget && budget.totalAvailable > 0 ? Math.min(100, (budget.totalSpent / budget.totalAvailable) * 100) : 0;

  let fundsError = "";
  try {
    parseAmount(fundsAmount, LIMITS.maxFundsAmount);
  } catch (err) {
    fundsError = getFriendlyErrorMessage(err);
  }

  const handleAddFunds = async (e: React.FormEvent) => {
    e.preventDefault();
    setFundsTouched(true);
    setFundsFormError("");
    if (fundsError || processing) return;
    const amount = parseAmount(fundsAmount, LIMITS.maxFundsAmount);
    let details;
    try {
      details = validateFundDetails({ source: fundsSource, reference: fundsReference, description: fundsReason, receivedOn: fundsDate });
    } catch (err) {
      if (err instanceof FinanceInputError) return setFundsFormError(err.message);
      throw err;
    }
    setProcessing(true);
    try {
      await addFundsToBudget(amount, details, adminId, fundsEntryId || undefined);
      toast.success(`${currency(amount)} recorded as added to the budget`, "It is in the funds ledger with your name and the reason.");
      setFundsOpen(false);
      setFundsAmount("");
      setFundsReference("");
      setFundsReason("");
      setFundsTouched(false);
      setFundsEntryId("");
    } catch (err) {
      logError("addFundsToBudget", err);
      toast.error("Couldn't add funds", getFriendlyErrorMessage(err, "Please try again."));
    } finally {
      setProcessing(false);
    }
  };

  // Opening a claim starts a fresh payment record.
  const openReview = (claim: Issue) => {
    setReview(claim);
    setPayMethod("bank_transfer");
    setPayReference("");
    setPayDate(today());
    setPayError("");
  };

  /** Validate what the administrator says about the payment, then ask them to confirm. */
  const askToRecord = () => {
    try {
      validatePaymentDetails({ method: payMethod, reference: payReference, paidOn: payDate });
      setPayError("");
      setConfirm("pay");
    } catch (err) {
      if (err instanceof FinanceInputError) return setPayError(err.message);
      throw err;
    }
  };

  const pay = async () => {
    if (!review) return;
    setProcessing(true);
    try {
      const details = validatePaymentDetails({ method: payMethod, reference: payReference, paidOn: payDate });
      await approveClaim(review.id, workerName(review.assignedTo), adminId, details);
      toast.success("Payment recorded", `${currency(review.claimAmount ?? 0)} to ${workerName(review.assignedTo)}, recorded by you. UniFix did not move any money.`);
      setConfirm(null);
      setReview(null);
    } catch (err) {
      logError("approveClaim", err);
      toast.error("Payment was not recorded", getFriendlyErrorMessage(err, "Please try again."));
      setConfirm(null);
    } finally {
      setProcessing(false);
    }
  };

  const reject = async () => {
    if (!review) return;
    setProcessing(true);
    try {
      await rejectReceipt(review.id, adminId);
      toast.success("Claim rejected", `${workerName(review.assignedTo)} has been notified.`);
      setConfirm(null);
      setReview(null);
    } catch (err) {
      logError("rejectReceipt", err);
      toast.error("Couldn't reject the claim", getFriendlyErrorMessage(err, "Please try again."));
      setConfirm(null);
    } finally {
      setProcessing(false);
    }
  };

  const loading = pendingClaims === null || transactions === null || budget === null;
  const amount = review?.claimAmount ?? 0;

  return (
    <>
      <PageHeader
        title="Finance"
        description="Maintenance budget, expense claims awaiting review, and payments recorded by administrators. UniFix keeps the record; it does not move money."
        actions={
          <>
            <Button
              variant="secondary"
              icon={<Download className="h-4 w-4" aria-hidden="true" />}
              disabled={(transactions ?? []).length === 0 && (ledger ?? []).length === 0}
              onClick={() => exportLedger(transactions ?? [], ledger ?? [])}
            >
              Export CSV
            </Button>
            <Button
              icon={<Plus className="h-4 w-4" aria-hidden="true" />}
              onClick={() => {
                setFundsEntryId((current) => current || newLedgerEntryId());
                setFundsOpen(true);
              }}
            >
              Add funds
            </Button>
          </>
        }
      />

      {loadError && (
        <Notice tone="danger" title="Some finance data couldn't be loaded" className="mb-6" action={<Button size="sm" variant="secondary" onClick={() => setRetryKey((k) => k + 1)}>Try again</Button>}>
          {loadError}
        </Notice>
      )}

      <StatStrip
        className="mb-6 lg:grid-cols-4"
        stats={[
          { label: "Available balance", value: currency(available), loading: budget === null && !loadError, hint: budget ? `of ${currency(budget.totalAvailable)} total budget` : undefined },
          { label: "Spent", value: currency(budget?.totalSpent ?? 0), loading: budget === null && !loadError, hint: budget ? `${Math.round(spentPct)}% of budget` : undefined },
          { label: "Pending claims", value: claims.length, loading: pendingClaims === null && !loadError, hint: claims.length ? `${currency(pendingTotal)} awaiting review` : "Nothing to review", tone: claims.length ? "warning" : "default" },
          { label: "Paid this month", value: currency(paidThisMonth), loading: transactions === null && !loadError },
        ]}
      />

      <StatStrip
        className="mb-4 lg:grid-cols-4"
        stats={[
          { label: "Funds added (ledger)", value: currency(summary.fundsAdded), loading: ledger === null && !loadError, hint: `plus ${currency(summary.openingBalance)} opening balance` },
          { label: "Payments recorded", value: currency(summary.paidOut), loading: transactions === null && !loadError, hint: `${summary.paymentCount} payment${summary.paymentCount === 1 ? "" : "s"}` },
          { label: "After pending claims", value: currency(Math.max(0, summary.availableAfterPending)), hint: summary.shortfall ? `${currency(summary.shortfall)} short if all are paid` : "If every pending claim is paid", tone: summary.shortfall ? "danger" : "default" },
          { label: "Ledger check", value: summary.reconciliation.ok ? "Consistent" : "Mismatch", tone: summary.reconciliation.ok ? "default" : "danger", hint: "Spent total vs recorded payments" },
        ]}
      />
      {!summary.ledgerCount.ok && (
        <Notice tone="danger" title="The funds ledger and its counter disagree" className="mb-6">
          {summary.ledgerCount.message}
        </Notice>
      )}
      {!summary.reconciliation.ok && budget && transactions && (
        <Notice tone="danger" title="The budget and the payment record disagree" className="mb-6">
          {summary.reconciliation.message} Difference: {currency(Math.abs(summary.reconciliation.spentDifference))}.
        </Notice>
      )}

      {budget && (
        <div className="mb-6">
          <div className="mb-1.5 flex justify-between text-xs text-fg-subtle">
            <span>Budget used</span>
            <span className="tabular">
              {currency(budget.totalSpent)} / {currency(budget.totalAvailable)}
            </span>
          </div>
          <div role="progressbar" aria-label="Budget used" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(spentPct)} className="h-2 overflow-hidden rounded-full bg-surface-2">
            <div className={`h-full rounded-full ${spentPct > 90 ? "bg-danger" : spentPct > 75 ? "bg-warning" : "bg-brand"}`} style={{ width: `${spentPct}%` }} />
          </div>
        </div>
      )}

      <Card className="mb-6">
        <CardHeader title="Claims awaiting review" description="Workers submit a claim when they resolve a task. Each claim can be paid once." />
        <div className="mt-3 border-t border-border">
          {loading && !loadError ? (
            <SkeletonRows rows={3} />
          ) : claims.length === 0 ? (
            <EmptyState compact icon={<Receipt />} title="No claims to review" description="New expense claims will appear here." />
          ) : (
            <TableWrap label="Pending claims">
              <thead>
                <tr>
                  <th className={th}>Worker</th>
                  <th className={th}>Issue</th>
                  <th className={th}>Resolved</th>
                  <th className={`${th} text-right`}>Amount</th>
                  <th className={th}>
                    <span className="sr-only">Action</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {claims.map((c) => (
                  <tr key={c.id} className={trHover}>
                    <td className={`${td} whitespace-nowrap font-medium`}>{workerName(c.assignedTo)}</td>
                    <td className={`${td} max-w-[18rem]`}>
                      <Link href={`/issues/${c.id}`} className="block truncate hover:text-brand-fg hover:underline">
                        {c.title}
                      </Link>
                      <span className="block truncate text-xs text-fg-subtle">
                        {c.category}
                        {c.claimDescription ? ` · ${c.claimDescription}` : ""}
                      </span>
                    </td>
                    <td className={`${td} whitespace-nowrap text-fg-muted`}>{c.resolvedAt ? formatDate(c.resolvedAt, { month: "short", day: "numeric" }) : "—"}</td>
                    <td className={`${td} tabular whitespace-nowrap text-right font-medium`}>{currency(c.claimAmount ?? 0)}</td>
                    <td className={`${td} text-right`}>
                      <Button size="sm" variant="secondary" onClick={() => openReview(c)} aria-label={`Review claim for “${c.title}”`}>
                        Review
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title="Recent payments" description="Recorded by an administrator, newest first. Not confirmed by a bank." />
        <div className="mt-3 border-t border-border">
          {transactions === null && !loadError ? (
            <SkeletonRows rows={4} />
          ) : (transactions ?? []).length === 0 ? (
            <EmptyState compact icon={<Wallet />} title="No payouts yet" description="Payments appear here once claims are approved." />
          ) : (
            <>
              <TableWrap label="Payouts">
                <thead>
                  <tr>
                    <th className={th}>Recorded</th>
                    <th className={th}>Worker</th>
                    <th className={th}>Description</th>
                    <th className={th}>How</th>
                    <th className={`${th} text-right`}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {(transactions ?? []).slice(0, 25).map((tx) => (
                    <tr key={tx.id} className={trHover}>
                      <td className={`${td} whitespace-nowrap text-fg-muted`}>{formatDate(tx.createdAt)}</td>
                      <td className={`${td} whitespace-nowrap`}>{tx.workerName}</td>
                      <td className={`${td} max-w-[20rem] truncate text-fg-muted`} title={payoutLabel(tx.note)}>{payoutLabel(tx.note)}</td>
                      <td className={`${td} whitespace-nowrap text-fg-muted`}>
                        {tx.method ? PAYMENT_METHOD_LABELS[tx.method] : <span className="text-fg-subtle">Not stated</span>}
                        {tx.reference ? ` · ${tx.reference}` : ""}
                        {tx.paidOn ? ` · ${tx.paidOn}` : ""}
                      </td>
                      <td className={`${td} tabular whitespace-nowrap text-right font-medium`}>{currency(tx.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
              {(transactions ?? []).length > 25 && <p className="px-5 py-2.5 text-xs text-fg-subtle">Showing the latest 25 of {(transactions ?? []).length}.</p>}
            </>
          )}
        </div>
      </Card>

      <Card className="mt-6">
        <CardHeader title="Funds ledger" description="Every addition to the budget, with who recorded it and why. Entries cannot be edited or deleted." />
        <div className="mt-3 border-t border-border">
          {ledger === null && !loadError ? (
            <SkeletonRows rows={3} />
          ) : (ledger ?? []).length === 0 ? (
            <EmptyState compact icon={<Wallet />} title="No funds added yet" description="Funds added from now on are listed here. The opening balance and anything added earlier is not itemised." />
          ) : (
            <TableWrap label="Funds ledger">
              <thead>
                <tr>
                  <th className={th}>Date</th>
                  <th className={th}>Source</th>
                  <th className={th}>Reason</th>
                  <th className={th}>Reference</th>
                  <th className={`${th} text-right`}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {(ledger ?? []).slice(0, 25).map((e) => (
                  <tr key={e.id} className={trHover}>
                    <td className={`${td} whitespace-nowrap text-fg-muted`}>{e.receivedOn || formatDate(e.createdAt)}</td>
                    <td className={`${td} whitespace-nowrap`}>{FUND_SOURCE_LABELS[e.source]}</td>
                    <td className={`${td} max-w-[20rem] truncate text-fg-muted`} title={e.description}>{e.description}</td>
                    <td className={`${td} whitespace-nowrap text-fg-muted`}>{e.reference || "—"}</td>
                    <td className={`${td} tabular whitespace-nowrap text-right font-medium`}>{currency(e.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          )}
        </div>
      </Card>

      {/* Add funds */}
      <Dialog
        open={fundsOpen}
        onClose={() => setFundsOpen(false)}
        dismissible={!processing}
        title="Add funds"
        description="Record funds that management has made available for paying claims. This is your record of the allocation; UniFix does not receive or verify money."
        size="sm"
        initialFocus={fundsInputRef}
        footer={
          <>
            <Button variant="secondary" onClick={() => setFundsOpen(false)} disabled={processing}>
              Cancel
            </Button>
            <Button type="submit" form="add-funds-form" isLoading={processing}>
              Add funds
            </Button>
          </>
        }
      >
        <form id="add-funds-form" onSubmit={handleAddFunds} noValidate>
          <Input
            label="Amount"
            type="number"
            min="1"
            max={LIMITS.maxFundsAmount}
            step="1"
            inputMode="numeric"
            placeholder="0"
            value={fundsAmount}
            onChange={(e) => setFundsAmount(e.target.value)}
            onBlur={() => setFundsTouched(true)}
            error={fundsTouched && fundsError ? fundsError : undefined}
            icon={<span className="text-sm font-medium">₹</span>}
            ref={fundsInputRef}
            required
          />
          <div className="mt-4 space-y-4">
            <Select label="Source" value={fundsSource} onChange={(e) => setFundsSource(e.target.value as FundSource)}>
              {FUND_SOURCES.map((f) => (
                <option key={f} value={f}>
                  {FUND_SOURCE_LABELS[f]}
                </option>
              ))}
            </Select>
            <Textarea label="Reason" rows={2} maxLength={300} value={fundsReason} onChange={(e) => setFundsReason(e.target.value)} placeholder="e.g. Q3 maintenance allocation approved by the estate office" required />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Date" type="date" max={today()} value={fundsDate} onChange={(e) => setFundsDate(e.target.value)} required />
              <Input label="Reference (optional)" maxLength={60} value={fundsReference} onChange={(e) => setFundsReference(e.target.value)} placeholder="Sanction or letter no." />
            </div>
            {fundsFormError && (
              <p role="alert" className="text-[13px] text-danger">
                {fundsFormError}
              </p>
            )}
          </div>
        </form>
      </Dialog>

      {/* Claim review */}
      <Dialog
        open={!!review && confirm === null}
        onClose={() => setReview(null)}
        dismissible={!processing}
        title="Review expense claim"
        description={review ? `Submitted by ${workerName(review.assignedTo)} when resolving this issue.` : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm("reject")} disabled={processing}>
              Reject
            </Button>
            <Button onClick={askToRecord} disabled={processing || !amount}>
              Record payment of {currency(amount)}
            </Button>
          </>
        }
      >
        {review && (
          <div className="space-y-4">
            <DescriptionList
              items={[
                { label: "Worker", value: workerName(review.assignedTo) },
                {
                  label: "Issue",
                  value: (
                    <Link href={`/issues/${review.id}`} className="hover:text-brand-fg hover:underline">
                      {review.title}
                    </Link>
                  ),
                },
                { label: "Amount", value: <span className="tabular text-base font-semibold">{currency(amount)}</span> },
                {
                  label: "Spent on",
                  value: review.claimDescription ? (
                    <span className="break-words">{review.claimDescription}</span>
                  ) : (
                    <span className="text-fg-subtle">No description given</span>
                  ),
                },
                { label: "Status", value: <Badge tone="warning">Awaiting review</Badge> },
              ]}
            />
            <fieldset className="space-y-3 rounded-md border border-border p-3">
              <legend className="px-1 text-[13px] font-medium text-fg">How was it paid?</legend>
              <p className="text-xs text-fg-subtle">Record the payment you made outside UniFix. This is your statement; it is not checked with a bank.</p>
              <div className="grid grid-cols-2 gap-3">
                <Select label="Method" value={payMethod} onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}>
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {PAYMENT_METHOD_LABELS[m]}
                    </option>
                  ))}
                </Select>
                <Input label="Paid on" type="date" max={today()} value={payDate} onChange={(e) => setPayDate(e.target.value)} required />
              </div>
              <Input
                label={METHODS_NEEDING_REFERENCE.includes(payMethod) ? "Reference number" : "Reference (optional)"}
                maxLength={60}
                value={payReference}
                onChange={(e) => setPayReference(e.target.value)}
                placeholder="Transaction, UPI or cheque number"
                required={METHODS_NEEDING_REFERENCE.includes(payMethod)}
              />
              {payError && (
                <p role="alert" className="text-[13px] text-danger">
                  {payError}
                </p>
              )}
            </fieldset>
            <div>
              <p className="mb-1.5 text-[13px] text-fg-subtle">Receipt</p>
              {receiptImage === undefined && review.hasReceipt ? (
                <Skeleton className="h-40 w-full" />
              ) : receiptImage ? (
                <button type="button" onClick={() => setReceiptPreview(receiptImage)} aria-label="View receipt full size" className="block w-full overflow-hidden rounded-md border border-border bg-surface-2 transition-colors hover:border-border-strong">
                  <img src={receiptImage} alt="Receipt" className="max-h-56 w-full object-contain" />
                </button>
              ) : (
                <p className="flex items-center gap-2 rounded-md border border-dashed border-border px-3 py-4 text-[13px] text-fg-subtle">
                  <FileImage className="h-4 w-4" aria-hidden="true" /> No receipt attached
                </p>
              )}
            </div>
          </div>
        )}
      </Dialog>

      <ConfirmDialog
        open={confirm === "pay"}
        title={review ? `Record a payment of ${currency(amount)} to ${workerName(review.assignedTo)}?` : "Record payment"}
        description="This records a payment you have made outside UniFix: it is deducted from the budget, added to the worker's earnings and written to the payment record, once. UniFix does not send money. It cannot be undone."
        confirmLabel="Record payment"
        busy={processing}
        onConfirm={pay}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === "reject"}
        title="Reject this claim?"
        description="No payment is made. The worker is notified and the claim can't be paid later."
        confirmLabel="Reject claim"
        tone="danger"
        busy={processing}
        onConfirm={reject}
        onCancel={() => setConfirm(null)}
      />

      {receiptPreview && <ImageModal imageUrl={receiptPreview} alt="Receipt" onClose={() => setReceiptPreview(null)} />}
    </>
  );
}
