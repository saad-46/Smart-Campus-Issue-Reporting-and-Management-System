"use client";

import React, { useEffect, useState } from "react";
import { Siren, UserPlus } from "lucide-react";
import { Issue, IssueSummary, User } from "@/types";
import { Actor, adminAssignIssue, fetchIssueSummaries, setIssueEscalation } from "@/lib/firestore";
import { getAllWorkers } from "@/lib/finance";
import { getRecentFeedback } from "@/lib/feedback";
import { workerWorkload } from "@/lib/intelligence/analytics";
import { averageRatings, recommendWorkers, WorkerRecommendation } from "@/lib/intelligence/assignment";
import { computeSla } from "@/lib/intelligence/sla";
import { getFriendlyErrorMessage, logError } from "@/lib/errors";
import { useSlaConfig } from "@/hooks/useSlaConfig";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Dialog, { ConfirmDialog } from "@/components/ui/Dialog";
import { DescriptionList } from "@/components/ui/Data";
import { EmptyState, SkeletonRows } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import Panel from "./Panel";

const DAY = 86_400_000;

function WorkerOption({
  r,
  compliance,
  recommended,
  current,
  busy,
  onAssign,
}: {
  r: WorkerRecommendation;
  compliance: number | null;
  recommended?: boolean;
  current: boolean;
  busy: boolean;
  onAssign: () => void;
}) {
  return (
    <li className="flex items-start justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-fg">
          {r.name}
          {recommended && <Badge tone="info">Suggested</Badge>}
          {current && <Badge tone="success">Assigned</Badge>}
        </p>
        <p className="mt-0.5 text-[13px] text-fg-subtle">{r.reason}</p>
        {compliance !== null && <p className="mt-0.5 text-xs text-fg-subtle">{compliance}% resolved within target (90 days)</p>}
      </div>
      <Button size="sm" variant={recommended ? "primary" : "secondary"} onClick={onAssign} disabled={current || busy} aria-label={current ? `Assigned to ${r.name}` : `Assign to ${r.name}`}>
        {current ? "Assigned" : "Assign"}
      </Button>
    </li>
  );
}

/**
 * Admin-only workflow controls: assignment (with ranked suggestions the
 * admin may ignore) and escalation. Every change is still checked by the
 * database rules (assignees must be approved workers or admins).
 */
export default function AdminIssueControls({ issue, admin }: { issue: Issue; admin: Actor }) {
  const toast = useToast();
  const slaConfig = useSlaConfig();
  const [workers, setWorkers] = useState<User[] | null>(null);
  const [recommendations, setRecommendations] = useState<WorkerRecommendation[] | null>(null);
  const [compliance, setCompliance] = useState<Map<string, number>>(new Map());
  const [assignOpen, setAssignOpen] = useState(false);
  const [confirmUnassign, setConfirmUnassign] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    getAllWorkers()
      .then((list) => {
        if (!cancelled) setWorkers(list);
      })
      .catch((err) => {
        logError("getAllWorkers", err);
        if (!cancelled) setWorkers([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const workerName = (id: string) => workers?.find((w) => w.id === id)?.name;
  const assigneeName = issue.assignedTo ? workerName(issue.assignedTo) ?? (issue.assignedTo === admin.id ? "You" : "An administrator or former worker") : null;

  // Recommendations load when the dialog opens (90 days of bounded history + recent ratings).
  useEffect(() => {
    if (!assignOpen || recommendations || !workers || workers.length === 0) return;
    let cancelled = false;
    setError("");
    Promise.all([fetchIssueSummaries({ since: new Date(Date.now() - 90 * DAY) }), getRecentFeedback()])
      .then(([{ issues }, feedback]) => {
        if (cancelled) return;
        setRecommendations(recommendWorkers(issue, workers, workerWorkload(issues), averageRatings(feedback)));
        const byWorker = new Map<string, IssueSummary[]>();
        for (const i of issues) if (i.assignedTo && i.status === "Resolved") byWorker.set(i.assignedTo, [...(byWorker.get(i.assignedTo) ?? []), i]);
        const rates = new Map<string, number>();
        for (const [id, list] of byWorker) {
          if (list.length < 3) continue;
          const met = list.filter((i) => computeSla(i, slaConfig).state === "met").length;
          rates.set(id, Math.round((met / list.length) * 100));
        }
        setCompliance(rates);
      })
      .catch((err) => {
        logError("loadRecommendations", err);
        if (!cancelled) setError(getFriendlyErrorMessage(err, "Recommendations couldn't be loaded."));
      });
    return () => {
      cancelled = true;
    };
  }, [assignOpen, recommendations, workers, issue, slaConfig]);

  const assign = async (workerId: string) => {
    setBusy(workerId || "unassign");
    setError("");
    try {
      await adminAssignIssue(issue.id, workerId, admin);
      toast.success(workerId ? `Assigned to ${workerName(workerId) ?? "worker"}` : "Issue unassigned", workerId ? "They've been notified." : undefined);
      setAssignOpen(false);
      setConfirmUnassign(false);
    } catch (err) {
      logError("adminAssignIssue", err);
      setError(getFriendlyErrorMessage(err, "The assignment couldn't be saved."));
      if (!workerId) toast.error("Couldn't unassign the issue", getFriendlyErrorMessage(err, ""));
    } finally {
      setBusy("");
    }
  };

  const toggleEscalation = async () => {
    setBusy("escalate");
    try {
      await setIssueEscalation(issue.id, !issue.escalated);
      toast.success(issue.escalated ? "Escalation cleared" : "Issue escalated", issue.escalated ? undefined : "It now appears first in the assigned worker's list.");
    } catch (err) {
      logError("setIssueEscalation", err);
      toast.error("Couldn't change escalation", getFriendlyErrorMessage(err, "Please try again."));
    } finally {
      setBusy("");
    }
  };

  const resolved = issue.status === "Resolved";
  const top = recommendations?.[0];

  return (
    <Panel title="Manage issue">
      <DescriptionList
        items={[
          { label: "Assigned to", value: workers === null ? "…" : assigneeName ?? <span className="text-fg-subtle">Unassigned</span> },
          {
            label: "Escalation",
            value: issue.escalated ? (
              <Badge tone="danger" icon={<Siren aria-hidden="true" />}>
                Escalated
              </Badge>
            ) : (
              <span className="text-fg-subtle">Not escalated</span>
            ),
          },
        ]}
      />
      {!resolved ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" icon={<UserPlus className="h-3.5 w-3.5" aria-hidden="true" />} onClick={() => setAssignOpen(true)} disabled={workers === null}>
            {issue.assignedTo ? "Reassign" : "Assign"}
          </Button>
          <Button size="sm" variant="secondary" onClick={toggleEscalation} isLoading={busy === "escalate"} disabled={busy !== "" && busy !== "escalate"}>
            {issue.escalated ? "Clear escalation" : "Escalate"}
          </Button>
          {issue.assignedTo && (
            <Button size="sm" variant="ghost" onClick={() => setConfirmUnassign(true)} disabled={busy !== ""}>
              Unassign
            </Button>
          )}
        </div>
      ) : (
        <p className="mt-3 text-xs text-fg-subtle">Resolved issues can&apos;t be reassigned or escalated.</p>
      )}

      <Dialog
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        title="Assign issue"
        description={`Ranked by ${issue.category} experience, current workload and reporter ratings over the last 90 days. The suggestion is a starting point — you decide.`}
        size="md"
      >
        {error && <p role="alert" className="mb-3 text-[13px] text-danger">{error}</p>}
        {workers !== null && workers.length === 0 ? (
          <EmptyState compact title="No approved workers yet" description="Approve worker requests on the Workers page first." />
        ) : recommendations === null ? (
          error ? null : <SkeletonRows rows={3} label="Loading recommendations" />
        ) : (
          <div className="-mx-5 space-y-4">
            {top && (
              <div>
                <p className="px-5 pb-1 text-xs font-medium text-fg-subtle">Suggested</p>
                <ul className="border-y border-border bg-brand-subtle/40">
                  <WorkerOption r={top} compliance={compliance.get(top.workerId) ?? null} recommended current={top.workerId === issue.assignedTo} busy={busy !== ""} onAssign={() => assign(top.workerId)} />
                </ul>
              </div>
            )}
            {recommendations.length > 1 && (
              <div>
                <p className="px-5 pb-1 text-xs font-medium text-fg-subtle">Other workers</p>
                <ul className="divide-y divide-border border-y border-border">
                  {recommendations.slice(1).map((r) => (
                    <WorkerOption key={r.workerId} r={r} compliance={compliance.get(r.workerId) ?? null} current={r.workerId === issue.assignedTo} busy={busy !== ""} onAssign={() => assign(r.workerId)} />
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Dialog>

      <ConfirmDialog
        open={confirmUnassign}
        title="Unassign this issue?"
        description={`${assigneeName ?? "The current assignee"} will no longer see it in their tasks.${issue.status === "Open" ? " It returns to the open pool for any worker to claim." : " It will need a new assignee to be completed."}`}
        confirmLabel="Unassign"
        tone="danger"
        busy={busy === "unassign"}
        onConfirm={() => assign("")}
        onCancel={() => setConfirmUnassign(false)}
      />
    </Panel>
  );
}
