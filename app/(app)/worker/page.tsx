"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Inbox, Play, Wallet } from "lucide-react";
import { useAuthContext } from "@/components/AuthProvider";
import IssueRow from "@/components/IssueCard";
import BillSubmissionForm from "@/components/BillSubmissionForm";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Tabs, tabId } from "@/components/ui/Tabs";
import { payoutLabel } from "@/lib/claims";
import { PAYMENT_METHOD_LABELS } from "@/lib/financeRules";
import { StatStrip, TableWrap, td, th, trHover } from "@/components/ui/Data";
import { EmptyState, ErrorState, Notice, SkeletonRows } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { Issue, Transaction } from "@/types";
import { subscribeToAssignedIssues, subscribeToOpenPool, updateIssueStatus, assignIssue, submitBill } from "@/lib/firestore";
import { subscribeToTransactions } from "@/lib/finance";
import RepairTip from "@/components/issue/RepairTip";
import { useUnreadChats } from "@/hooks/useUnreadChats";
import { useSlaConfig } from "@/hooks/useSlaConfig";
import { useNow } from "@/hooks/useNow";
import { computeSla } from "@/lib/intelligence/sla";
import { formatDate, greeting } from "@/lib/dates";
import { getFriendlyErrorMessage, logError } from "@/lib/errors";

const currency = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export default function WorkerPage() {
  const { userProfile, activeRole } = useAuthContext();
  const toast = useToast();
  const workerId = userProfile?.id ?? "";
  const unreadChats = useUnreadChats(workerId);
  // null = still loading
  const [myIssues, setMyIssues] = useState<Issue[] | null>(null);
  const [poolIssues, setPoolIssues] = useState<Issue[] | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadError, setLoadError] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  const [tab, setTab] = useState<"tasks" | "pool" | "payouts">("tasks");
  const [resolvingIssue, setResolvingIssue] = useState<Issue | null>(null);
  const [busyId, setBusyId] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);
  // A resolved task's row (and its Resolve button) disappears, so keep keyboard focus in the list.
  const focusPanel = () => window.setTimeout(() => panelRef.current?.focus({ preventScroll: true }), 50);

  // Scoped listeners: only this worker's tasks, the unassigned pool and
  // this worker's payouts — not every issue on campus.
  useEffect(() => {
    if (!workerId) return;
    setLoadError("");
    const onError = (operation: string) => (err: unknown) => {
      logError(operation, err);
      setLoadError(getFriendlyErrorMessage(err, "We couldn't load your tasks. Please check your connection and try again."));
    };
    const unsubMine = subscribeToAssignedIssues(workerId, setMyIssues, onError("subscribeToAssignedIssues"));
    const unsubPool = subscribeToOpenPool(setPoolIssues, onError("subscribeToOpenPool"));
    const unsubTx = subscribeToTransactions(workerId, setTransactions, onError("subscribeToTransactions"));
    return () => {
      unsubMine();
      unsubPool();
      unsubTx();
    };
  }, [workerId, retryKey]);

  const loading = (myIssues === null || poolIssues === null) && !loadError;
  const pool = useMemo(() => poolIssues ?? [], [poolIssues]);
  const mine = useMemo(() => myIssues ?? [], [myIssues]);

  // Most urgent first: escalated, then by time left before the SLA deadline.
  const slaConfig = useSlaConfig();
  const now = useNow();
  const active = useMemo(
    () =>
      mine
        .filter((i) => i.status !== "Resolved")
        .map((i) => ({ issue: i, sla: computeSla(i, slaConfig, now) }))
        .sort((a, b) => Number(!!b.issue.escalated) - Number(!!a.issue.escalated) || a.sla.remainingMs - b.sla.remainingMs),
    [mine, slaConfig, now]
  );
  const overdue = active.filter((x) => x.sla.state === "breached").length;
  const dueSoon = active.filter((x) => x.sla.state === "approaching").length;
  const escalated = active.filter((x) => x.issue.escalated).length;
  const attention = active.filter((x) => x.issue.escalated || x.sla.state === "approaching" || x.sla.state === "breached").length;

  const pendingClaims = mine.filter((i) => i.status === "Resolved" && i.claimStatus === "pending");
  const pendingAmount = pendingClaims.reduce((sum, i) => sum + (i.claimAmount || 0), 0);
  const resolvedCount = mine.filter((i) => i.status === "Resolved").length;
  const paidTotal = transactions.reduce((s, t) => s + t.amount, 0);

  const start = async (issue: Issue) => {
    setBusyId(issue.id);
    try {
      await updateIssueStatus(issue.id, "In Progress", { id: workerId, role: activeRole });
      toast.success("Work started", "The reporter has been notified.");
    } catch (e) {
      logError("updateIssueStatus", e);
      toast.error("Couldn't start this task", getFriendlyErrorMessage(e, "Please try again."));
    } finally {
      setBusyId("");
    }
  };

  const claim = async (issue: Issue) => {
    setBusyId(issue.id);
    try {
      await assignIssue(issue.id, workerId, activeRole);
      toast.success("Task claimed", "It's now in your tasks.");
    } catch (e) {
      logError("assignIssue", e);
      toast.error("Couldn't claim this task", getFriendlyErrorMessage(e, "Please try again."));
    } finally {
      setBusyId("");
    }
  };

  const handleBillSuccess = async (data: { amount: number; description: string; receiptUrl: string }) => {
    if (!resolvingIssue) return;
    // Errors propagate to the dialog, which shows them and stays open.
    await submitBill(resolvingIssue.id, { id: workerId, role: activeRole }, data.amount, data.receiptUrl, data.description);
    toast.success("Task resolved", `Your claim of ${currency(data.amount)} was sent for review.`);
    setResolvingIssue(null);
    focusPanel();
  };

  const handleSkipBill = async () => {
    if (!resolvingIssue) return;
    await updateIssueStatus(resolvingIssue.id, "Resolved", { id: workerId, role: activeRole });
    toast.success("Task resolved", "The reporter will be asked to rate the fix.");
    setResolvingIssue(null);
    focusPanel();
  };

  if (!workerId) return null;
  const firstName = userProfile?.name?.split(" ")[0];

  return (
    <>
      <PageHeader eyebrow={firstName ? `${greeting()}, ${firstName}` : undefined} title="My work" description="Your assigned tasks, most urgent first, and open issues you can claim." />

      {loadError ? (
        <Card>
          <ErrorState title="Couldn't load your work" description={loadError} onRetry={() => setRetryKey((k) => k + 1)} />
        </Card>
      ) : (
        <>
          <StatStrip
            className="mb-6 lg:grid-cols-4"
            stats={[
              { label: "Active tasks", value: active.length, loading, hint: active.length === 0 ? "Nothing assigned" : `${resolvedCount} resolved in total` },
              {
                label: "Needs attention",
                value: attention,
                loading,
                tone: overdue ? "danger" : attention ? "warning" : "default",
                hint: attention ? [overdue && `${overdue} overdue`, dueSoon && `${dueSoon} due soon`, escalated && `${escalated} escalated`].filter(Boolean).join(" · ") : "All on track",
              },
              { label: "Open pool", value: pool.length, loading, hint: "Unassigned issues" },
              { label: "Pending payout", value: currency(pendingAmount), loading, hint: `${pendingClaims.length} claim${pendingClaims.length === 1 ? "" : "s"} awaiting review` },
            ]}
          />

          {attention > 0 && !loading && (
            <Notice tone={overdue ? "danger" : "warning"} title={`${attention} task${attention === 1 ? " needs" : "s need"} attention`} className="mb-6">
              They&apos;re listed first in your tasks. Overdue means the target time for its priority has passed.
            </Notice>
          )}

          <Card>
            <div className="px-4 pt-2 sm:px-5">
              <h2 className="sr-only">Work lists</h2>
              <Tabs
                label="Work lists"
                value={tab}
                onChange={setTab}
                panelId="work-panel"
                className="border-b-0"
                options={[
                  { value: "tasks", label: "My tasks", count: myIssues ? active.length : undefined },
                  { value: "pool", label: "Open pool", count: poolIssues ? pool.length : undefined },
                  { value: "payouts", label: "Payouts" },
                ]}
              />
            </div>
            <div ref={panelRef} tabIndex={-1} className="border-t border-border outline-none" id="work-panel" role="tabpanel" aria-labelledby={tabId("work-panel", tab)}>
              {loading ? (
                <SkeletonRows rows={4} label="Loading tasks" />
              ) : tab === "tasks" ? (
                active.length === 0 ? (
                  <EmptyState
                    icon={<CheckCircle2 />}
                    title="No active tasks"
                    description="You're all caught up. Claim an issue from the open pool to get started."
                    action={pool.length > 0 ? <Button variant="secondary" size="sm" onClick={() => setTab("pool")}>View open pool ({pool.length})</Button> : undefined}
                  />
                ) : (
                  <ul className="divide-y divide-border">
                    {active.map(({ issue }) => (
                      <li key={issue.id}>
                        <IssueRow
                          issue={issue}
                          showSla
                          unreadChat={unreadChats.has(issue.id)}
                          footer={<RepairTip issue={issue} />}
                          actions={
                            issue.status === "Open" ? (
                              <Button size="sm" icon={<Play className="h-3.5 w-3.5" aria-hidden="true" />} onClick={() => start(issue)} isLoading={busyId === issue.id} disabled={busyId !== "" && busyId !== issue.id} aria-label={`Start work on “${issue.title}”`}>
                                Start work
                              </Button>
                            ) : (
                              <Button size="sm" icon={<CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />} onClick={() => setResolvingIssue(issue)} aria-label={`Resolve “${issue.title}”`}>
                                Resolve
                              </Button>
                            )
                          }
                        />
                      </li>
                    ))}
                  </ul>
                )
              ) : tab === "pool" ? (
                pool.length === 0 ? (
                  <EmptyState icon={<Inbox />} title="The open pool is empty" description="Every reported issue has been picked up. New ones will appear here." />
                ) : (
                  <ul className="divide-y divide-border">
                    {pool.map((issue) => (
                      <li key={issue.id}>
                        <IssueRow
                          issue={issue}
                          showSla
                          actions={
                            <Button size="sm" variant="secondary" onClick={() => claim(issue)} isLoading={busyId === issue.id} disabled={busyId !== "" && busyId !== issue.id} aria-label={`Claim “${issue.title}”`}>
                              Claim task
                            </Button>
                          }
                        />
                      </li>
                    ))}
                  </ul>
                )
              ) : transactions.length === 0 ? (
                <EmptyState icon={<Wallet />} title="No payouts yet" description="When an administrator records a payment for a claim, it is listed here with how and when it was paid." />
              ) : (
                <>
                  <TableWrap label="Payouts">
                    <thead>
                      <tr>
                        <th className={th}>Date</th>
                        <th className={th}>Description</th>
                        <th className={th}>Paid how</th>
                        <th className={`${th} text-right`}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((tx) => (
                        <tr key={tx.id} className={trHover}>
                          <td className={`${td} whitespace-nowrap text-fg-muted`}>{formatDate(tx.createdAt)}</td>
                          <td className={`${td} max-w-[22rem] truncate`}>{payoutLabel(tx.note, "Task payout")}</td>
                          <td className={`${td} whitespace-nowrap text-fg-muted`}>
                            {tx.method ? PAYMENT_METHOD_LABELS[tx.method] : "Not stated"}
                            {tx.paidOn ? ` · ${tx.paidOn}` : ""}
                            {tx.reference ? ` · ${tx.reference}` : ""}
                          </td>
                          <td className={`${td} tabular whitespace-nowrap text-right font-medium`}>{currency(tx.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </TableWrap>
                  <p className="flex justify-between px-4 py-3 text-sm sm:px-5">
                    <span className="text-fg-subtle">Total paid (as recorded by administrators)</span>
                    <span className="tabular font-semibold text-fg">{currency(paidTotal)}</span>
                  </p>
                </>
              )}
            </div>
          </Card>
        </>
      )}

      <BillSubmissionForm
        key={resolvingIssue?.id ?? "none"}
        open={!!resolvingIssue}
        issueId={resolvingIssue?.id ?? ""}
        issueTitle={resolvingIssue?.title ?? ""}
        onSuccess={handleBillSuccess}
        onSkip={handleSkipBill}
        onCancel={() => setResolvingIssue(null)}
      />
    </>
  );
}
