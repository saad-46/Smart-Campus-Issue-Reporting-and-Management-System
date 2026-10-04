"use client";

import React, { useState } from "react";
import { CheckCircle2, Play } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { StatStrip, TableWrap, td, th, trHover } from "@/components/ui/Data";
import { Tabs, tabId } from "@/components/ui/Tabs";
import { EmptyState } from "@/components/ui/States";
import { useViewer } from "@/components/viewer/ViewerProvider";
import { DemoIssueList, SampleNote, SignInHint, ViewerLoading, WorkflowSteps } from "@/components/viewer/parts";
import { currency } from "@/components/admin/Kpi";
import { computeSla, DEFAULT_SLA_CONFIG } from "@/lib/intelligence/sla";
import { DEMO_TECHNICIANS, DEMO_WORKER_ID } from "@/lib/viewer/demoData";
import { openPool, workerTasks } from "@/lib/viewer/demoStats";

const CLAIM_TONE = { pending: "warning", approved: "success", rejected: "neutral" } as const;
const CLAIM_LABEL = { pending: "Awaiting review", approved: "Paid", rejected: "Rejected" } as const;

export default function ViewerWorkerPage() {
  const { data, promptSignIn } = useViewer();
  const [tab, setTab] = useState<"tasks" | "pool" | "payouts">("tasks");
  const tech = DEMO_TECHNICIANS.find((t) => t.id === DEMO_WORKER_ID)!;

  const header = (
    <PageHeader
      eyebrow={`Worker view · ${tech.label} (sample)`}
      title="My work"
      description="Assigned tasks, most urgent first, and open issues that can be claimed."
    />
  );
  if (!data) return (<>{header}<ViewerLoading /></>);

  const tasks = workerTasks(data);
  const urgency = (state: string) => (state === "breached" ? 0 : state === "approaching" ? 1 : 2);
  const active = tasks
    .filter((i) => i.status !== "Resolved")
    .map((i) => ({ issue: i, sla: computeSla(i, DEFAULT_SLA_CONFIG, data.now) }))
    .sort((a, b) => urgency(a.sla.state) - urgency(b.sla.state) || a.sla.remainingMs - b.sla.remainingMs);
  const needsAttention = active.filter((a) => a.sla.state === "breached" || a.sla.state === "approaching").length;
  const pool = openPool(data);
  const claims = tasks.filter((i) => i.claim);
  const pending = claims.filter((i) => i.claim!.status === "pending");

  return (
    <>
      {header}
      <SampleNote>
        A worker&apos;s dashboard for a sample technician. Buttons explain what they would do — nothing changes in Viewer Mode.
      </SampleNote>

      <StatStrip
        className="mb-6 lg:grid-cols-4"
        stats={[
          { label: "Active tasks", value: active.length, hint: `${tasks.filter((i) => i.status === "Resolved").length} resolved` },
          { label: "Needs attention", value: needsAttention, hint: "Due soon or overdue", tone: needsAttention ? "warning" : "default" },
          { label: "Open pool", value: pool.length, hint: "Unassigned issues" },
          { label: "Pending payout", value: currency(pending.reduce((s, i) => s + i.claim!.amount, 0)), hint: `${pending.length} claim${pending.length === 1 ? "" : "s"} awaiting review` },
        ]}
      />

      <Card className="mb-6">
        <div className="px-4 pt-2 sm:px-5">
          <h2 className="sr-only">Work lists</h2>
          <Tabs
            label="Work lists"
            value={tab}
            onChange={setTab}
            panelId="viewer-worker-panel"
            className="border-b-0"
            options={[
              { value: "tasks", label: "My tasks", count: active.length },
              { value: "pool", label: "Open pool", count: pool.length },
              { value: "payouts", label: "Claims" },
            ]}
          />
        </div>
        <div id="viewer-worker-panel" role="tabpanel" aria-labelledby={tabId("viewer-worker-panel", tab)} className="border-t border-border">
          {tab === "tasks" ? (
            active.length ? (
              <DemoIssueList
                issues={active.map((a) => a.issue)}
                now={data.now}
                label="Active tasks"
                actionFor={(i) =>
                  i.status === "Open" ? (
                    <Button size="sm" icon={<Play className="h-3.5 w-3.5" aria-hidden="true" />} onClick={() => promptSignIn("Starting work")} aria-label={`Start work on “${i.title}”`}>
                      Start work
                    </Button>
                  ) : (
                    <Button size="sm" icon={<CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />} onClick={() => promptSignIn("Resolving a task")} aria-label={`Resolve “${i.title}”`}>
                      Resolve
                    </Button>
                  )
                }
              />
            ) : (
              <EmptyState compact title="No active tasks" />
            )
          ) : tab === "pool" ? (
            <DemoIssueList
              issues={pool}
              now={data.now}
              label="Open pool"
              actionFor={(i) => (
                <Button size="sm" variant="secondary" onClick={() => promptSignIn("Claiming a task")} aria-label={`Claim “${i.title}”`}>
                  Claim task
                </Button>
              )}
            />
          ) : (
            <TableWrap label="Expense claims">
              <thead>
                <tr>
                  <th className={th}>Issue</th>
                  <th className={th}>Spent on</th>
                  <th className={`${th} text-right`}>Amount</th>
                  <th className={th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {claims.map((i) => (
                  <tr key={i.id} className={trHover}>
                    <td className={`${td} min-w-[12rem]`}>{i.title}</td>
                    <td className={`${td} min-w-[10rem] text-fg-muted`}>{i.claim!.description}</td>
                    <td className={`${td} tabular whitespace-nowrap text-right font-medium`}>{currency(i.claim!.amount)}</td>
                    <td className={td}>
                      <Badge tone={CLAIM_TONE[i.claim!.status]}>{CLAIM_LABEL[i.claim!.status]}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          )}
        </div>
      </Card>

      <section aria-labelledby="worker-flow">
        <h2 id="worker-flow" className="mb-3 text-[15px] font-semibold text-fg">
          How a task is handled
        </h2>
        <WorkflowSteps
          label="Worker workflow"
          steps={[
            { title: "Assigned", text: "By an administrator, or claimed from the open pool." },
            { title: "Start work", text: "The reporter is told work has started." },
            { title: "Resolve", text: "Mark it fixed; the reporter is asked to rate it." },
            { title: "Claim expense", text: "Optional: amount, what it was spent on, receipt photo." },
            { title: "Admin review", text: "An administrator pays or rejects the claim, exactly once." },
          ]}
        />
      </section>

      <SignInHint>Need operational access?</SignInHint>
    </>
  );
}
