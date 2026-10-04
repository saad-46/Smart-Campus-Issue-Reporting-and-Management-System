"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { FileImage, Plus, Receipt, Wallet } from "lucide-react";
import { getReceiptImage, subscribeToPendingClaims } from "@/lib/firestore";
import { subscribeToBudget, subscribeToTransactions, getAllWorkers, approveClaim, rejectReceipt, getGlobalBudget, addFundsToBudget } from "@/lib/finance";
import { Issue, Budget, Transaction, User } from "@/types";
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
import { Input } from "@/components/ui/Field";
import { DescriptionList, StatStrip, TableWrap, td, th, trHover } from "@/components/ui/Data";
import { EmptyState, Notice, Skeleton, SkeletonRows } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { currency } from "@/components/admin/Kpi";
import { payoutLabel } from "@/lib/claims";

export default function AdminFinancePage() {
  const { userProfile } = useAuthContext();
  const toast = useToast();
  const adminId = userProfile?.id ?? "";
  const [pendingClaims, setPendingClaims] = useState<Issue[] | null>(null);
  const [budget, setBudget] = useState<Budget | null>(null);
  const [transactions, setTransactions] = useState<Transaction[] | null>(null);
  const [workers, setWorkers] = useState<User[]>([]);
  const [loadError, setLoadError] = useState("");
  const [retryKey, setRetryKey] = useState(0);

  const [fundsOpen, setFundsOpen] = useState(false);
  const [fundsAmount, setFundsAmount] = useState("");
  const [fundsTouched, setFundsTouched] = useState(false);
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
  const available = Math.max(0, (budget?.totalAvailable ?? 0) - (budget?.totalSpent ?? 0));
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
    if (fundsError || processing) return;
    const amount = parseAmount(fundsAmount, LIMITS.maxFundsAmount);
    setProcessing(true);
    try {
      await addFundsToBudget(amount);
      toast.success(`${currency(amount)} added to the budget`);
      setFundsOpen(false);
      setFundsAmount("");
      setFundsTouched(false);
    } catch (err) {
      logError("addFundsToBudget", err);
      toast.error("Couldn't add funds", getFriendlyErrorMessage(err, "Please try again."));
    } finally {
      setProcessing(false);
    }
  };

  const pay = async () => {
    if (!review) return;
    setProcessing(true);
    try {
      await approveClaim(review.id, workerName(review.assignedTo), adminId);
      toast.success("Payment completed", `${currency(review.claimAmount ?? 0)} paid to ${workerName(review.assignedTo)}.`);
      setConfirm(null);
      setReview(null);
    } catch (err) {
      logError("approveClaim", err);
      toast.error("Payment failed", getFriendlyErrorMessage(err, "Please try again."));
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
        description="Maintenance budget, expense claims awaiting review, and payouts to workers."
        actions={
          <Button icon={<Plus className="h-4 w-4" aria-hidden="true" />} onClick={() => setFundsOpen(true)}>
            Add funds
          </Button>
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
                      <Button size="sm" variant="secondary" onClick={() => setReview(c)} aria-label={`Review claim for “${c.title}”`}>
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
        <CardHeader title="Recent payouts" description="Approved claims, newest first" />
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
                    <th className={th}>Date</th>
                    <th className={th}>Worker</th>
                    <th className={th}>Description</th>
                    <th className={`${th} text-right`}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {(transactions ?? []).slice(0, 25).map((tx) => (
                    <tr key={tx.id} className={trHover}>
                      <td className={`${td} whitespace-nowrap text-fg-muted`}>{formatDate(tx.createdAt)}</td>
                      <td className={`${td} whitespace-nowrap`}>{tx.workerName}</td>
                      <td className={`${td} max-w-[20rem] truncate text-fg-muted`} title={payoutLabel(tx.note)}>{payoutLabel(tx.note)}</td>
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

      {/* Add funds */}
      <Dialog
        open={fundsOpen}
        onClose={() => setFundsOpen(false)}
        dismissible={!processing}
        title="Add funds"
        description="Increase the maintenance budget available for paying claims."
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
            <Button onClick={() => setConfirm("pay")} disabled={processing || !amount}>
              Pay {currency(amount)}
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
        title={review ? `Pay ${currency(amount)} to ${workerName(review.assignedTo)}?` : "Confirm payment"}
        description="The amount is deducted from the budget and credited to the worker. This action cannot be reversed."
        confirmLabel="Confirm payment"
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
