"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Banknote, Hourglass, PiggyBank, Wallet } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import { Pagination } from "@/components/ui/Filters";
import { KpiCard, KpiGrid } from "@/components/ui/Kpi";
import { TableWrap, td, th, trHover } from "@/components/ui/Data";
import { EmptyState } from "@/components/ui/States";
import { currency } from "@/components/admin/Kpi";
import { Donut } from "@/components/viewer/charts";
import { PayDialog } from "@/components/viewer/ActionDialogs";
import { SectionCard, ViewerGate } from "@/components/viewer/parts";
import { DemoIssue, workerName } from "@/lib/viewer/demoData";
import { formatDate } from "@/lib/dates";
import { cn } from "@/lib/cn";

type Tab = "pending" | "approved" | "rejected" | "all";
const TONE = { pending: "warning", approved: "success", rejected: "danger" } as const;
const LABEL = { pending: "Awaiting review", approved: "Paid", rejected: "Rejected" } as const;

export default function ViewerFinancePage() {
  const [tab, setTab] = useState<Tab>("pending");
  const [page, setPage] = useState(1);
  const [paying, setPaying] = useState<DemoIssue | null>(null);

  return (
    <ViewerGate>
      {({ stats }) => {
        const f = stats.finance;
        const shown = f.claims.filter((c) => tab === "all" || c.claim.status === tab).sort((a, b) => (b.issue.resolvedAt?.getTime() ?? 0) - (a.issue.resolvedAt?.getTime() ?? 0));
        const counts = { pending: f.pendingCount, approved: f.claims.filter((c) => c.claim.status === "approved").length, rejected: f.rejectedCount, all: f.claims.length };
        const usedPct = Math.min(100, Math.round((f.spent / f.budget) * 1000) / 10);
        const pageSize = 8;
        const ledger = f.transactions.slice((page - 1) * pageSize, page * pageSize);

        return (
          <>
            <PageHeader title="Finance" description="Budget, expense claims and the payment ledger. Approving a claim here is a demo: no money moves." />

            <div data-tour="finance-summary" className="mb-6">
              <KpiGrid className="xl:grid-cols-4">
                <KpiCard label="Budget" value={f.budget} format={currency} icon={<Wallet />} hint="Sample annual maintenance budget" />
                <KpiCard label="Spent" value={f.spent} format={currency} icon={<Banknote />} tone="brand" hint={`${usedPct}% of budget`} />
                <KpiCard label="Available" value={f.available} format={currency} icon={<PiggyBank />} tone="success" hint="Before pending claims" />
                <KpiCard label="Pending claims" value={f.pendingCount} icon={<Hourglass />} tone={f.pendingCount ? "warning" : "success"} hint={currency(f.pendingAmount)} />
              </KpiGrid>
              <div className="mt-3" role="img" aria-label={`${usedPct}% of the budget spent`}>
                <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full rounded-full bg-gradient-to-r from-brand to-accent" style={{ width: `${Math.max(1, usedPct)}%` }} />
                </div>
              </div>
            </div>

            <div className="mb-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
              <SectionCard title="Expense claims" description="Reviewed one at a time. Each is paid exactly once." flush>
                <div className="px-4 sm:px-5">
                  <Tabs
                    value={tab}
                    onChange={(t) => setTab(t)}
                    label="Claim status"
                    panelId="claims"
                    options={[
                      { value: "pending", label: "To review", count: counts.pending },
                      { value: "approved", label: "Paid", count: counts.approved },
                      { value: "rejected", label: "Rejected", count: counts.rejected },
                      { value: "all", label: "All", count: counts.all },
                    ]}
                  />
                </div>
                <div id="claims" role="tabpanel" aria-labelledby={`claims-tab-${tab}`}>
                  {shown.length === 0 ? (
                    <EmptyState compact title="No claims here" description={tab === "pending" ? "Everything has been reviewed." : undefined} />
                  ) : (
                    <TableWrap label="Expense claims">
                      <thead>
                        <tr>
                          {["Issue", "Worker", "Spent on", "Amount", "Status", ""].map((h, i) => (
                            <th key={i} scope="col" className={th}>
                              {h || <span className="sr-only">Action</span>}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {shown.map(({ issue, claim }) => (
                          <tr key={issue.id} className={trHover}>
                            <td className={cn(td, "max-w-[16rem]")}>
                              <Link href={`/viewer/issues/${issue.id}`} className="block truncate font-medium text-fg hover:text-brand-fg">
                                {issue.title}
                              </Link>
                              <span className="tabular font-mono text-xs text-fg-subtle">{issue.id}</span>
                            </td>
                            <td className={cn(td, "whitespace-nowrap text-fg-muted")}>{workerName(issue.assignedTo)}</td>
                            <td className={cn(td, "text-fg-muted")}>{claim.description}</td>
                            <td className={cn(td, "tabular whitespace-nowrap font-medium")}>{currency(claim.amount)}</td>
                            <td className={td}>
                              <Badge tone={TONE[claim.status]} dot>
                                {LABEL[claim.status]}
                              </Badge>
                            </td>
                            <td className={td}>
                              {claim.status === "pending" && (
                                <Button size="sm" variant="secondary" onClick={() => setPaying(issue)}>
                                  Review
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </TableWrap>
                  )}
                </div>
              </SectionCard>

              <SectionCard title="Spending by category" description="Paid claims only">
                {f.spendByCategory.length === 0 ? <EmptyState compact title="Nothing paid yet" /> : <Donut data={f.spendByCategory} caption="Paid claims by category" centerLabel="₹ total" />}
              </SectionCard>
            </div>

            <SectionCard title="Payment ledger" description="One entry per paid claim. Demo entries disappear when you leave." flush>
              <TableWrap label="Payment ledger">
                <thead>
                  <tr>
                    {["Reference", "Date", "Worker", "Note", "Amount"].map((h) => (
                      <th key={h} scope="col" className={th}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ledger.map((t) => (
                    <tr key={t.id} className={trHover}>
                      <td className={`${td} tabular font-mono text-xs`}>{t.id}</td>
                      <td className={`${td} whitespace-nowrap text-fg-muted`}>{formatDate(t.at, { month: "short", day: "numeric" })}</td>
                      <td className={`${td} whitespace-nowrap`}>{workerName(t.workerId)}</td>
                      <td className={cn(td, "max-w-[22rem] truncate text-fg-muted")}>{t.note}</td>
                      <td className={`${td} tabular text-right font-medium`}>{currency(t.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
              <Pagination page={page} pageSize={pageSize} total={f.transactions.length} onPage={setPage} className="border-t border-border" />
            </SectionCard>

            <PayDialog issue={paying} onClose={() => setPaying(null)} />
          </>
        );
      }}
    </ViewerGate>
  );
}
