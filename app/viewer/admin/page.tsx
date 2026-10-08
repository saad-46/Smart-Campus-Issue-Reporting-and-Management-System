"use client";

import React, { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Clock, ListChecks, ShieldCheck, Timer, TriangleAlert, UserPlus } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { KpiCard, KpiGrid } from "@/components/ui/Kpi";
import { EmptyState } from "@/components/ui/States";
import { formatHours, currency } from "@/components/admin/Kpi";
import { DemoIssueList, SectionCard, ViewerGate } from "@/components/viewer/parts";
import { TrendChart } from "@/components/viewer/charts";
import { AssignDialog, PayDialog } from "@/components/viewer/ActionDialogs";
import { DEMO_PERSONA, DemoIssue } from "@/lib/viewer/demoData";
import { Avatar } from "@/components/viewer/DemoImage";
import { formatRelative, greeting } from "@/lib/dates";

export default function ViewerAdminPage() {
  const [assigning, setAssigning] = useState<DemoIssue | null>(null);
  const [paying, setPaying] = useState<DemoIssue | null>(null);

  return (
    <ViewerGate>
      {({ data, stats, slaConfig, workerRequests, approveWorkerRequest }) => {
        const byId = new Map(data.issues.map((i) => [i.id, i]));
        const attention = stats.sla.alerts.slice(0, 5).map((a) => byId.get(a.issue.id)!).filter(Boolean);
        const pendingClaims = data.issues.filter((i) => i.claim?.status === "pending");
        const w = stats.week;

        return (
          <>
            <PageHeader
              eyebrow={`${DEMO_PERSONA.admin.title} · ${greeting(data.now)}, ${DEMO_PERSONA.admin.name}`}
              title="Campus operations"
              description="What needs attention now, and how the campus is doing against its targets."
              actions={
                <Link href="/viewer/analytics" className="text-sm font-medium text-brand-fg hover:underline">
                  Open analytics
                </Link>
              }
            />

            <div data-tour="admin-kpis" className="mb-6">
              <KpiGrid>
                <KpiCard label="Total issues" value={stats.total} icon={<ListChecks />} trend={{ pct: w.reportedChange, upIsGood: false }} hint={`${w.reported} reported this week`} spark={stats.spark.reported} />
                <KpiCard label="Open" value={stats.status.Open} icon={<Clock />} tone="warning" hint={`${stats.unassigned} unassigned`} spark={stats.spark.backlog} />
                <KpiCard label="In progress" value={stats.status["In Progress"]} icon={<Timer />} tone="brand" hint="Being worked on" />
                <KpiCard label="Resolved" value={stats.status.Resolved} icon={<CheckCircle2 />} tone="success" trend={{ pct: w.resolvedChange, upIsGood: true }} hint={`${w.resolved} this week`} spark={stats.spark.resolved} />
                <KpiCard label="Avg resolution" value={formatHours(stats.resolution.averageHours) ?? "—"} icon={<Timer />} trend={{ pct: w.averageHoursChange, upIsGood: false }} hint="Report to resolved" />
                <KpiCard
                  label="SLA compliance"
                  value={stats.slaCompliance === null ? null : stats.slaCompliance}
                  format={(n) => `${n.toLocaleString("en-IN", { maximumFractionDigits: 1 })}%`}
                  icon={<ShieldCheck />}
                  tone={stats.slaCompliance !== null && stats.slaCompliance < 80 ? "warning" : "success"}
                  hint={`${stats.overdue} open past target`}
                />
              </KpiGrid>
            </div>

            <div className="mb-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
              <SectionCard title="Reports and resolutions" description="Last 30 days, per day" href="/viewer/analytics" hrefLabel="Full analytics">
                <TrendChart data={stats.trend} caption="Issues reported and resolved per day over the last 30 days" />
              </SectionCard>
              <SectionCard title="Insights" description="Computed from the demo data">
                <ul className="space-y-3">
                  {stats.insights.map((i) => (
                    <li key={i.id} className="flex gap-2.5 text-sm text-fg-muted">
                      <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                      {i.text}
                    </li>
                  ))}
                </ul>
              </SectionCard>
            </div>

            <div className="mb-6 grid gap-6 lg:grid-cols-2">
              <SectionCard title="Needs attention" description="Closest to, or past, their deadline" href="/viewer/issues" flush>
                {attention.length === 0 ? (
                  <EmptyState title="All on track" description="No open issue is near its deadline." compact />
                ) : (
                  <DemoIssueList
                    issues={attention}
                    now={data.now}
                    config={slaConfig}
                    label="Issues needing attention"
                    actionFor={(i) =>
                      i.assignedTo ? undefined : (
                        <Button size="sm" onClick={() => setAssigning(i)} icon={<UserPlus className="h-3.5 w-3.5" aria-hidden="true" />}>
                          Assign worker
                        </Button>
                      )
                    }
                  />
                )}
              </SectionCard>

              <SectionCard title="Incidents" description="Reports of the same fault, linked into one" tour="admin-incidents" flush>
                {stats.incidents.length === 0 ? (
                  <EmptyState title="No linked incidents" compact />
                ) : (
                  <ul className="divide-y divide-border">
                    {stats.incidents.slice(0, 4).map((c) => (
                      <li key={c.masterIssueId} className="relative px-4 py-3 transition-colors hover:bg-surface-hover sm:px-5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <Link href={`/viewer/issues/${c.masterIssueId}`} className="text-sm font-medium text-fg after:absolute after:inset-0 after:content-[''] hover:text-brand-fg focus-visible:outline-none focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:outline-brand">
                              {c.title}
                            </Link>
                            <p className="mt-0.5 text-[13px] text-fg-subtle">
                              {c.location} · first reported {formatRelative(c.firstReportedAt, data.now)}
                            </p>
                          </div>
                          <Badge tone={c.status === "Resolved" ? "success" : "warning"} icon={<TriangleAlert aria-hidden="true" />}>
                            {c.reportCount} reports
                          </Badge>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </SectionCard>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <SectionCard title="Claims to review" description={`${pendingClaims.length} waiting · ${currency(stats.finance.pendingAmount)}`} href="/viewer/finance" flush>
                {pendingClaims.length === 0 ? (
                  <EmptyState title="No claims waiting" compact />
                ) : (
                  <ul className="divide-y divide-border">
                    {pendingClaims.map((i) => (
                      <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-fg">{i.claim!.description}</p>
                          <p className="text-[13px] text-fg-subtle">{i.title}</p>
                        </div>
                        <Button size="sm" variant="secondary" onClick={() => setPaying(i)}>
                          Review {currency(i.claim!.amount)}
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </SectionCard>

              <SectionCard title="Worker access requests" description="Only an administrator can approve these" href="/viewer/workers" flush>
                {workerRequests.length === 0 ? (
                  <EmptyState title="No requests" compact />
                ) : (
                  <ul className="divide-y divide-border">
                    {workerRequests.map((r) => (
                      <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
                        <span className="flex min-w-0 items-center gap-2.5">
                          <Avatar name={r.name} />
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium text-fg">{r.name}</span>
                            <span className="block text-[13px] text-fg-subtle">{r.team}</span>
                          </span>
                        </span>
                        <span className="flex gap-2">
                          <Button size="sm" variant="secondary" onClick={() => approveWorkerRequest(r.id, false)}>
                            Decline
                          </Button>
                          <Button size="sm" onClick={() => approveWorkerRequest(r.id, true)}>
                            Approve
                          </Button>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </SectionCard>
            </div>

            <AssignDialog issue={assigning} onClose={() => setAssigning(null)} />
            <PayDialog issue={paying} onClose={() => setPaying(null)} />
          </>
        );
      }}
    </ViewerGate>
  );
}
