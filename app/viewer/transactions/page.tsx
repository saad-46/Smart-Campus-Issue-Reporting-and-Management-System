"use client";

import React, { useMemo } from "react";
import TransactionsLedger from "@/components/admin/TransactionsLedger";
import PageHeader from "@/components/ui/PageHeader";
import { ViewerGate } from "@/components/viewer/parts";
import { buildRows } from "@/lib/financeLedger";
import { DEMO_BUDGET_TOTAL } from "@/lib/viewer/demoData";
import type { DemoStats } from "@/lib/viewer/demoStats";

const SCOPE =
  "Sample data: nothing here is a real payment. The ledger works as it does in the signed-in app: incoming is funds added, outgoing is a payment recorded for an approved claim, and only posted entries count in the amounts.";

export default function ViewerTransactionsPage() {
  return (
    <ViewerGate>
      {({ stats, workerName, data }) => <DemoTransactions stats={stats} workerName={workerName} generatedAt={data.now} />}
    </ViewerGate>
  );
}

function DemoTransactions({
  stats,
  workerName,
  generatedAt,
}: {
  stats: DemoStats;
  workerName: (id: string) => string;
  generatedAt: Date;
}) {
  const rows = useMemo(() => {
    const payments = stats.finance.transactions.map((t) => ({
      id: t.id,
      workerId: t.workerId,
      workerName: workerName(t.workerId),
      amount: t.amount,
      status: "approved",
      issueId: t.issueId,
      note: t.note,
      createdAt: t.at,
    }));
    // The demo keeps one running total of funds added, not one entry per addition.
    const added = Math.round((stats.finance.budget - DEMO_BUDGET_TOTAL) * 100) / 100;
    const funds = added > 0 ? [{ id: "demo-funds-added", amount: added, source: "other", description: "Funds added during this demo visit", createdAt: generatedAt }] : [];
    return buildRows(payments, funds);
  }, [stats, workerName, generatedAt]);

  return (
    <>
      <PageHeader title="Transactions" description="Every payment and funds addition in the demo, newest first." />
      <TransactionsLedger rows={rows} loading={false} issueHref={(id) => `/viewer/issues/${id}`} scopeNote={SCOPE} />
    </>
  );
}
