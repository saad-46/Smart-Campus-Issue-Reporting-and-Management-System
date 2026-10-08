"use client";

import React, { useState } from "react";
import Link from "next/link";
import { AlarmClock, CheckCircle2, ClipboardList, Play, Receipt, Wallet } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { KpiCard, KpiGrid } from "@/components/ui/Kpi";
import { EmptyState } from "@/components/ui/States";
import { currency } from "@/components/admin/Kpi";
import { DemoIssueList, SectionCard, ViewerGate } from "@/components/viewer/parts";
import { ClaimDialog, ResolveDialog } from "@/components/viewer/ActionDialogs";
import { DEMO_PERSONA, DemoIssue } from "@/lib/viewer/demoData";
import { byUrgency, openPool, workerTasks } from "@/lib/viewer/demoStats";
import { computeSla } from "@/lib/intelligence/sla";
import { Avatar } from "@/components/viewer/DemoImage";

const CLAIM_TONE = { pending: "warning", approved: "success", rejected: "danger" } as const;
const CLAIM_LABEL = { pending: "Awaiting review", approved: "Approved and paid", rejected: "Rejected" } as const;

export default function ViewerWorkerPage() {
  const [resolving, setResolving] = useState<DemoIssue | null>(null);
  const [claiming, setClaiming] = useState<DemoIssue | null>(null);
  const me = DEMO_PERSONA.worker;

  return (
    <ViewerGate>
      {({ data, slaConfig, startIssue, assignIssue }) => {
        const tasks = workerTasks(data, me.id);
        const active = byUrgency(tasks.filter((t) => t.status !== "Resolved"), slaConfig, data.now);
        const done = tasks.filter((t) => t.status === "Resolved");
        const claims = done.filter((t) => t.claim);
        const unclaimed = done.filter((t) => !t.claim);
        const pool = openPool(data);
        const urgent = active.filter((t) => computeSla(t, slaConfig, data.now).state !== "on-track").length;
        const earned = claims.filter((c) => c.claim!.status === "approved").reduce((s, c) => s + c.claim!.amount, 0);
        const pending = claims.filter((c) => c.claim!.status === "pending").reduce((s, c) => s + c.claim!.amount, 0);

        return (
          <>
            <PageHeader
              eyebrow={
                <span className="inline-flex items-center gap-2">
                  <Avatar name={me.name} size={20} />
                  {me.name} · {me.team} · {me.shift} shift
                </span>
              }
              title="My work"
              description="Your assigned tasks, most urgent first, and open issues you can take."
            />

            <KpiGrid className="mb-6 xl:grid-cols-4">
              <KpiCard label="Active tasks" value={active.length} icon={<ClipboardList />} hint={`${active.filter((t) => t.status === "In Progress").length} in progress`} />
              <KpiCard label="Due soon or overdue" value={urgent} icon={<AlarmClock />} tone={urgent ? "danger" : "success"} hint="Needs attention first" />
              <KpiCard label="Resolved" value={done.length} icon={<CheckCircle2 />} tone="success" hint="This month in the demo" />
              <KpiCard label="Paid so far" value={earned} format={currency} icon={<Wallet />} tone="brand" hint={pending ? `${currency(pending)} awaiting review` : "No claims waiting"} />
            </KpiGrid>

            <SectionCard title="Assigned to me" description="Start work, then resolve it. A deadline sits on every task." className="mb-6" tour="worker-queue" flush>
              {active.length === 0 ? (
                <EmptyState title="Nothing assigned" description="Take an open issue from the pool below." />
              ) : (
                <DemoIssueList
                  issues={active}
                  now={data.now}
                  config={slaConfig}
                  label="Assigned tasks"
                  actionFor={(i) =>
                    i.status === "Open" ? (
                      <Button size="sm" onClick={() => startIssue(i.id)} icon={<Play className="h-3.5 w-3.5" aria-hidden="true" />}>
                        Start work
                      </Button>
                    ) : (
                      <Button size="sm" onClick={() => setResolving(i)} icon={<CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />}>
                        Mark resolved
                      </Button>
                    )
                  }
                />
              )}
            </SectionCard>

            <div className="mb-6 grid gap-6 lg:grid-cols-2">
              <SectionCard title="Expense claims" description="What you spent on repairs. An administrator reviews each claim." tour="worker-claims" flush>
                {claims.length + unclaimed.length === 0 ? (
                  <EmptyState title="No resolved work yet" compact />
                ) : (
                  <ul className="divide-y divide-border">
                    {claims.map((c) => (
                      <li key={c.id} className="flex items-start justify-between gap-3 px-4 py-3 sm:px-5">
                        <div className="min-w-0">
                          <Link href={`/viewer/issues/${c.id}`} className="block truncate text-sm font-medium text-fg hover:text-brand-fg">
                            {c.title}
                          </Link>
                          <p className="text-[13px] text-fg-subtle">{c.claim!.description}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="tabular text-sm font-semibold text-fg">{currency(c.claim!.amount)}</p>
                          <Badge tone={CLAIM_TONE[c.claim!.status]} dot>
                            {CLAIM_LABEL[c.claim!.status]}
                          </Badge>
                        </div>
                      </li>
                    ))}
                    {unclaimed.slice(0, 3).map((u) => (
                      <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-5">
                        <p className="min-w-0 truncate text-sm text-fg-muted">{u.title}</p>
                        <Button size="sm" variant="secondary" onClick={() => setClaiming(u)} icon={<Receipt className="h-3.5 w-3.5" aria-hidden="true" />}>
                          Submit a claim
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </SectionCard>

              <SectionCard title="Open issue pool" description="Unassigned issues you could take on." flush>
                {pool.length === 0 ? (
                  <EmptyState title="The pool is empty" description="Every open issue has someone assigned." compact />
                ) : (
                  <DemoIssueList
                    issues={pool.slice(0, 5)}
                    now={data.now}
                    config={slaConfig}
                    label="Open pool"
                    actionFor={(i) => (
                      <Button size="sm" variant="secondary" onClick={() => assignIssue(i.id, me.id)}>
                        Take this task
                      </Button>
                    )}
                  />
                )}
              </SectionCard>
            </div>

            <p className="text-[13px] text-fg-subtle">
              Looking for something else?{" "}
              <Link href="/viewer/issues" className="font-medium text-brand-fg hover:underline">
                Browse all issues
              </Link>
            </p>

            <ResolveDialog issue={resolving} onClose={() => setResolving(null)} />
            <ClaimDialog issue={claiming} onClose={() => setClaiming(null)} />
          </>
        );
      }}
    </ViewerGate>
  );
}
