"use client";

import React from "react";
import Link from "next/link";
import { Lightbulb, Link2, Siren, UserPlus } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Card, { CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge, { StatusBadge } from "@/components/ui/Badge";
import { StatStrip, TableWrap, td, th, trHover } from "@/components/ui/Data";
import { EmptyState } from "@/components/ui/States";
import { useViewer } from "@/components/viewer/ViewerProvider";
import { DemoIssueList, SampleNote, SignInHint, ViewerLoading } from "@/components/viewer/parts";
import { ShareList, TrendChart } from "@/components/viewer/charts";
import { Stars } from "@/components/viewer/SampleIssueDialog";
import { currency, formatHours } from "@/components/admin/Kpi";
import { SLA_LABELS } from "@/lib/intelligence/sla";
import { technicianLabel } from "@/lib/viewer/demoData";
import { DEMO_WINDOW_DAYS } from "@/lib/viewer/demoStats";

export default function ViewerAdminPage() {
  const { data, stats, promptSignIn, openIssue } = useViewer();

  const header = (
    <PageHeader
      eyebrow="Admin view · sample"
      title="Campus operations"
      description="Open issues, deadlines, workload, spending and satisfaction at a glance."
    />
  );
  if (!data || !stats) return (<>{header}<ViewerLoading /></>);

  const alerts = stats.sla.alerts.map((a) => data.issues.find((i) => i.id === a.issue.id)!).filter(Boolean);
  const open = stats.status.Open + stats.status["In Progress"];
  const f = stats.finance;

  return (
    <>
      {header}
      <SampleNote>
        An operations overview for administrators, computed from the sample dataset. Assigning, escalating, paying claims and changing settings
        need a signed-in administrator.
      </SampleNote>

      <StatStrip
        className="mb-6"
        stats={[
          { label: "Open issues", value: open, hint: `${stats.total} reported in total` },
          { label: "High priority", value: stats.openHighPriority, hint: "Open, high priority", tone: stats.openHighPriority ? "warning" : "default" },
          { label: "Overdue", value: stats.overdue, hint: `${stats.sla.counts.approaching} due soon`, tone: stats.overdue ? "danger" : "default" },
          { label: "Median resolution", value: formatHours(stats.resolution.medianHours) ?? "—", hint: `${stats.resolution.count} resolved` },
          { label: "Satisfaction", value: stats.satisfaction.average !== null ? `${stats.satisfaction.average}/5` : "—", hint: `${stats.satisfaction.count} ratings` },
        ]}
      />

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Issue trend" description={`Reported and resolved per day, last ${DEMO_WINDOW_DAYS} days`} action={<Link href="/viewer/analytics" className="text-[13px] font-medium text-brand-fg hover:underline">Analytics</Link>} />
          <div className="px-3 pb-4 pt-3 sm:px-5">
            <TrendChart data={stats.trend} caption={`Issues reported and resolved per day over the last ${DEMO_WINDOW_DAYS} days`} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Needs attention" description={`${alerts.length} open issues near or past their target`} />
          <div className="mt-3 border-t border-border">
            {alerts.length ? (
              <DemoIssueList
                issues={alerts}
                now={data.now}
                label="Issues near or past their deadline"
                actionFor={(i) => (
                  <div className="flex flex-wrap gap-1.5">
                    {!i.assignedTo && (
                      <Button size="sm" variant="secondary" icon={<UserPlus className="h-3.5 w-3.5" aria-hidden="true" />} onClick={() => promptSignIn("Assigning a worker")} aria-label={`Assign “${i.title}”`}>
                        Assign
                      </Button>
                    )}
                    {!i.escalated && (
                      <Button size="sm" variant="tertiary" icon={<Siren className="h-3.5 w-3.5" aria-hidden="true" />} onClick={() => promptSignIn("Escalating an issue")} aria-label={`Escalate “${i.title}”`}>
                        Escalate
                      </Button>
                    )}
                  </div>
                )}
              />
            ) : (
              <EmptyState compact title="Nothing near its deadline" />
            )}
          </div>
        </Card>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title="Status" />
          <div className="px-4 pb-5 pt-3 sm:px-5">
            <ShareList
              label="Issues by status"
              items={[
                { name: "Open", value: stats.status.Open, tone: "brand" },
                { name: "In progress", value: stats.status["In Progress"], tone: "warning" },
                { name: "Resolved", value: stats.status.Resolved, tone: "success" },
              ]}
            />
          </div>
        </Card>
        <Card>
          <CardHeader title="Priority" />
          <div className="px-4 pb-5 pt-3 sm:px-5">
            <ShareList
              label="Issues by priority"
              items={[
                { name: "High", value: stats.priority.High, tone: "danger" },
                { name: "Medium", value: stats.priority.Medium, tone: "warning" },
                { name: "Low", value: stats.priority.Low, tone: "neutral" },
              ]}
            />
          </div>
        </Card>
        <Card>
          <CardHeader title="Deadlines (SLA)" description="Targets: High 6h · Medium 24h · Low 72h" />
          <div className="px-4 pb-5 pt-3 sm:px-5">
            <ShareList
              label="Issues by deadline state"
              items={[
                { name: SLA_LABELS["on-track"], value: stats.sla.counts["on-track"], tone: "brand" },
                { name: SLA_LABELS.approaching, value: stats.sla.counts.approaching, tone: "warning" },
                { name: SLA_LABELS.breached, value: stats.sla.counts.breached, tone: "danger" },
                { name: SLA_LABELS.met, value: stats.sla.counts.met, tone: "success" },
                { name: SLA_LABELS.missed, value: stats.sla.counts.missed, tone: "neutral" },
              ]}
            />
          </div>
        </Card>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Worker workload" description="Sample technicians (not real staff)" />
          <div className="mt-3 border-t border-border">
            <TableWrap label="Worker workload">
              <thead>
                <tr>
                  <th className={th}>Technician</th>
                  <th className={`${th} text-right`}>Active</th>
                  <th className={`${th} text-right`}>Resolved</th>
                  <th className={`${th} text-right`}>Avg. time</th>
                </tr>
              </thead>
              <tbody>
                {stats.workload.map((w) => (
                  <tr key={w.technician.id} className={trHover}>
                    <td className={td}>
                      <span className="font-medium">{w.technician.label}</span>
                      <span className="block text-xs text-fg-subtle">{w.technician.speciality}</span>
                    </td>
                    <td className={`${td} tabular text-right`}>{w.active}</td>
                    <td className={`${td} tabular text-right`}>{w.resolved}</td>
                    <td className={`${td} tabular whitespace-nowrap text-right`}>{formatHours(w.averageResolutionHours) ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          </div>
        </Card>

        <Card>
          <CardHeader title="Incidents" description="Reports linked as the same problem" />
          <div className="mt-3 border-t border-border">
            {stats.incidents.length ? (
              <ul className="divide-y divide-border">
                {stats.incidents.map((c) => (
                  <li key={c.masterIssueId} className="flex items-start justify-between gap-3 px-4 py-3 sm:px-5">
                    <div className="min-w-0">
                      <button type="button" onClick={() => openIssue(c.masterIssueId)} aria-label={`Open incident “${c.title}”`} className="text-left text-sm font-medium text-fg hover:text-brand-fg hover:underline">
                        {c.title}
                      </button>
                      <p className="text-[13px] text-fg-subtle">
                        {c.location} · {c.category}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Badge icon={<Link2 aria-hidden="true" />}>{c.reportCount} reports</Badge>
                      <StatusBadge status={c.status} />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState compact title="No linked incidents" />
            )}
          </div>
        </Card>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Finance" description="Sample maintenance budget and expense claims" />
          <div className="px-4 pt-3 sm:px-5">
            <dl className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <dt className="text-[13px] text-fg-subtle">Available</dt>
                <dd className="tabular font-semibold text-fg">{currency(f.available)}</dd>
              </div>
              <div>
                <dt className="text-[13px] text-fg-subtle">Paid</dt>
                <dd className="tabular font-semibold text-fg">{currency(f.spent)}</dd>
              </div>
              <div>
                <dt className="text-[13px] text-fg-subtle">Awaiting review</dt>
                <dd className="tabular font-semibold text-fg">{currency(f.pendingAmount)}</dd>
              </div>
            </dl>
          </div>
          <div className="mt-4 border-t border-border">
            <TableWrap label="Sample expense claims">
              <thead>
                <tr>
                  <th className={th}>Claim</th>
                  <th className={`${th} text-right`}>Amount</th>
                  <th className={th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {f.claims.map(({ issue, claim }) => (
                  <tr key={issue.id} className={trHover}>
                    <td className={`${td} min-w-[12rem]`}>
                      <span className="block">{claim.description}</span>
                      <span className="block text-xs text-fg-subtle">
                        {issue.title} · {technicianLabel(issue.assignedTo)}
                      </span>
                    </td>
                    <td className={`${td} tabular whitespace-nowrap text-right font-medium`}>{currency(claim.amount)}</td>
                    <td className={td}>
                      {claim.status === "pending" ? (
                        <Button size="sm" variant="secondary" onClick={() => promptSignIn("Reviewing and paying claims")} aria-label={`Review claim “${claim.description}”`}>
                          Review
                        </Button>
                      ) : (
                        <Badge tone={claim.status === "approved" ? "success" : "neutral"}>{claim.status === "approved" ? "Paid" : "Rejected"}</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          </div>
        </Card>

        <Card>
          <CardHeader title="Satisfaction" description={`${stats.satisfaction.count} ratings from reporters`} />
          <div className="px-4 pb-5 pt-3 sm:px-5">
            {stats.satisfaction.average !== null && (
              <div className="mb-4 flex items-center gap-2">
                <Stars rating={Math.round(stats.satisfaction.average)} />
                <span className="text-sm text-fg-muted">Average {stats.satisfaction.average} out of 5</span>
              </div>
            )}
            <ShareList
              label="Ratings by number of stars"
              items={[...stats.satisfaction.distribution].reverse().map((d) => ({ name: `${d.stars} star${d.stars === 1 ? "" : "s"}`, value: d.count, tone: d.stars >= 4 ? ("success" as const) : d.stars === 3 ? ("neutral" as const) : ("warning" as const) }))}
            />
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Insights" description="Generated from the sample with the same rules as the real dashboard" />
        <ul className="mt-3 divide-y divide-border border-t border-border">
          {stats.insights.map((i) => (
            <li key={i.id} className="flex gap-3 px-4 py-3 text-sm sm:px-5">
              <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-fg-subtle" aria-hidden="true" />
              <span className={i.hasData ? "text-fg" : "text-fg-muted"}>{i.text}</span>
            </li>
          ))}
        </ul>
      </Card>

      <SignInHint>Need operational access?</SignInHint>
    </>
  );
}
