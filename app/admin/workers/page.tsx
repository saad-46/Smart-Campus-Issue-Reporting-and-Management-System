"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { UserCheck, Users } from "lucide-react";
import { Feedback, IssueSummary, User } from "@/types";
import { useAuthContext } from "@/components/AuthProvider";
import { fetchIssueSummaries } from "@/lib/firestore";
import { getAllWorkers, setWorkerAccess, subscribeToWorkerRequests } from "@/lib/finance";
import { getRecentFeedback } from "@/lib/feedback";
import { workerWorkload, WorkerLoad } from "@/lib/intelligence/analytics";
import { averageRatings } from "@/lib/intelligence/assignment";
import { computeSla } from "@/lib/intelligence/sla";
import { getFriendlyErrorMessage, logError } from "@/lib/errors";
import { useSlaConfig } from "@/hooks/useSlaConfig";
import PageHeader from "@/components/ui/PageHeader";
import Card, { CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge, { BadgeTone } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { TableWrap, td, th, trHover } from "@/components/ui/Data";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { formatHours } from "@/components/admin/Kpi";

const DAY = 86_400_000;

/** Derived from current active tasks only — a quick signal, not a judgement. */
function loadOf(active: number): { label: string; tone: BadgeTone } {
  if (active >= 6) return { label: "Heavy", tone: "warning" };
  if (active >= 3) return { label: "Moderate", tone: "info" };
  return { label: "Light", tone: "neutral" };
}

export default function AdminWorkersPage() {
  const { userProfile } = useAuthContext();
  const toast = useToast();
  const adminId = userProfile?.id ?? "";
  const slaConfig = useSlaConfig();
  const [workers, setWorkers] = useState<User[] | null>(null);
  const [requests, setRequests] = useState<User[] | null>(null);
  const [history, setHistory] = useState<IssueSummary[] | null>(null);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [error, setError] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  const [busyId, setBusyId] = useState("");
  const [confirm, setConfirm] = useState<{ user: User; decision: "reject" | "revoke" } | null>(null);

  const loadWorkers = useCallback(() => {
    getAllWorkers()
      .then(setWorkers)
      .catch((err) => {
        logError("getAllWorkers", err);
        setError(getFriendlyErrorMessage(err, "Workers couldn't be loaded."));
      });
  }, []);

  useEffect(() => {
    setError("");
    loadWorkers();
    fetchIssueSummaries({ since: new Date(Date.now() - 90 * DAY) })
      .then(({ issues }) => setHistory(issues))
      .catch((err) => {
        logError("fetchIssueSummaries", err);
        setHistory([]);
      });
    getRecentFeedback()
      .then(setFeedback)
      .catch((err) => logError("getRecentFeedback", err));
    return subscribeToWorkerRequests(setRequests, (err) => {
      logError("subscribeToWorkerRequests", err);
      setRequests([]);
    });
  }, [retryKey, loadWorkers]);

  const loads = useMemo(() => new Map<string, WorkerLoad>((history ? workerWorkload(history) : []).map((l) => [l.workerId, l])), [history]);
  const ratings = useMemo(() => averageRatings(feedback), [feedback]);
  const onTime = useMemo(() => {
    const result = new Map<string, number>();
    const byWorker = new Map<string, IssueSummary[]>();
    for (const i of history ?? []) if (i.assignedTo && i.status === "Resolved") byWorker.set(i.assignedTo, [...(byWorker.get(i.assignedTo) ?? []), i]);
    for (const [id, list] of byWorker) {
      if (list.length < 3) continue;
      result.set(id, Math.round((list.filter((i) => computeSla(i, slaConfig).state === "met").length / list.length) * 100));
    }
    return result;
  }, [history, slaConfig]);

  const rows = useMemo(
    () =>
      (workers ?? [])
        .map((w) => ({ worker: w, load: loads.get(w.id), rating: ratings.get(w.id), onTime: onTime.get(w.id) }))
        .sort((a, b) => (b.load?.active ?? 0) - (a.load?.active ?? 0) || a.worker.name.localeCompare(b.worker.name)),
    [workers, loads, ratings, onTime]
  );

  const decide = async (user: User, decision: "approve" | "reject" | "revoke") => {
    setBusyId(user.id);
    try {
      await setWorkerAccess(user.id, decision, adminId);
      loadWorkers();
      toast.success(
        decision === "approve" ? `${user.name} is now a worker` : decision === "reject" ? "Request rejected" : `Worker access removed from ${user.name}`,
        decision === "approve" ? "They can claim and resolve issues." : "They've been notified."
      );
    } catch (err) {
      logError("setWorkerAccess", err);
      toast.error("Couldn't update that account", getFriendlyErrorMessage(err, "Please try again."));
    } finally {
      setBusyId("");
      setConfirm(null);
    }
  };

  return (
    <>
      <PageHeader title="Workers" description="Maintenance staff, their current workload and track record over the last 90 days." />

      {error ? (
        <Card>
          <ErrorState description={error} onRetry={() => setRetryKey((k) => k + 1)} />
        </Card>
      ) : (
        <>
          {(requests === null || requests.length > 0) && (
            <Card className="mb-6">
              <CardHeader title="Access requests" description="People who asked for worker access when they registered." />
              <div className="mt-3 border-t border-border">
                {requests === null ? (
                  <SkeletonRows rows={2} />
                ) : (
                  <ul className="divide-y divide-border">
                    {requests.map((u) => (
                      <li key={u.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-fg">{u.name}</p>
                          <p className="truncate text-[13px] text-fg-subtle">{u.email}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="secondary" onClick={() => setConfirm({ user: u, decision: "reject" })} disabled={busyId !== ""} aria-label={`Reject worker request from ${u.name}`}>
                            Reject
                          </Button>
                          <Button size="sm" icon={<UserCheck className="h-3.5 w-3.5" aria-hidden="true" />} onClick={() => decide(u, "approve")} isLoading={busyId === u.id} disabled={busyId !== "" && busyId !== u.id} aria-label={`Approve worker request from ${u.name}`}>
                            Approve
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Card>
          )}

          <Card>
            <CardHeader title="Team" description={workers ? `${workers.length} worker${workers.length === 1 ? "" : "s"} with access` : undefined} />
            <div className="mt-3 border-t border-border">
              {workers === null ? (
                <SkeletonRows rows={4} />
              ) : rows.length === 0 ? (
                <EmptyState compact icon={<Users />} title="No workers yet" description="Approve an access request to add someone to the team." />
              ) : (
                <>
                  <TableWrap label="Workers" className="hidden md:block">
                    <thead>
                      <tr>
                        <th className={th}>Worker</th>
                        <th className={`${th} text-right`}>Active</th>
                        <th className={`${th} text-right`}>Resolved</th>
                        <th className={`${th} text-right`}>Avg. time</th>
                        <th className={`${th} text-right`}>On time</th>
                        <th className={`${th} text-right`}>Rating</th>
                        <th className={th}>Load</th>
                        <th className={th}>
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(({ worker, load, rating, onTime: rate }) => {
                        const l = loadOf(load?.active ?? 0);
                        return (
                          <tr key={worker.id} className={`${trHover} group`}>
                            <td className={td}>
                              <p className="font-medium">{worker.name}</p>
                              <p className="text-xs text-fg-subtle">{worker.email}</p>
                            </td>
                            <td className={`${td} tabular text-right`}>{load?.active ?? 0}</td>
                            <td className={`${td} tabular text-right`}>{load?.resolved ?? 0}</td>
                            <td className={`${td} tabular text-right text-fg-muted`}>{formatHours(load?.averageResolutionHours ?? null) ?? "—"}</td>
                            <td className={`${td} tabular text-right text-fg-muted`} title={rate === undefined ? "Needs at least 3 resolved issues" : undefined}>
                              {rate === undefined ? "—" : `${rate}%`}
                            </td>
                            <td className={`${td} tabular text-right text-fg-muted`} title={rating && rating.count < 2 ? "Based on one rating" : undefined}>
                              {rating ? `${rating.average} (${rating.count})` : "—"}
                            </td>
                            <td className={td}>
                              <Badge tone={l.tone}>{l.label}</Badge>
                            </td>
                            <td className={`${td} w-24 text-right`}>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setConfirm({ user: worker, decision: "revoke" })}
                                aria-label={`Remove worker access from ${worker.name}`}
                                className="whitespace-nowrap text-fg-subtle opacity-0 transition-opacity hover:text-danger focus-visible:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100"
                              >
                                Remove
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </TableWrap>
                  <ul className="divide-y divide-border md:hidden">
                    {rows.map(({ worker, load, rating, onTime: rate }) => {
                      const l = loadOf(load?.active ?? 0);
                      return (
                        <li key={worker.id} className="px-4 py-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-fg">{worker.name}</p>
                              <p className="truncate text-xs text-fg-subtle">{worker.email}</p>
                            </div>
                            <Badge tone={l.tone}>{l.label}</Badge>
                          </div>
                          <p className="mt-2 text-[13px] text-fg-muted">
                            {load?.active ?? 0} active · {load?.resolved ?? 0} resolved · on time {rate === undefined ? "—" : `${rate}%`} · rating {rating ? rating.average : "—"}
                          </p>
                          <Button size="sm" variant="ghost" className="-ml-2 mt-1 text-danger hover:text-danger" onClick={() => setConfirm({ user: worker, decision: "revoke" })}>
                            Remove access
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                  <p className="border-t border-border px-4 py-2.5 text-xs text-fg-subtle sm:px-5">
                    Resolved, average time and on-time rate cover the last 90 days. On time needs at least 3 resolved issues. Load is based on current active tasks.
                  </p>
                </>
              )}
            </div>
          </Card>
        </>
      )}

      <ConfirmDialog
        open={!!confirm}
        title={confirm?.decision === "revoke" ? `Remove worker access from ${confirm.user.name}?` : `Reject ${confirm?.user.name}'s request?`}
        description={
          confirm?.decision === "revoke"
            ? "They will no longer see the worker workspace or be able to claim issues. Issues already assigned to them stay assigned until you reassign them."
            : "They keep their account and can still report issues. They'll be notified."
        }
        confirmLabel={confirm?.decision === "revoke" ? "Remove access" : "Reject request"}
        tone="danger"
        busy={!!confirm && busyId === confirm.user.id}
        onConfirm={() => confirm && decide(confirm.user, confirm.decision)}
        onCancel={() => setConfirm(null)}
      />
    </>
  );
}
