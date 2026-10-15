"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { RefreshCw, Wallet } from "lucide-react";
import { useAuthContext } from "@/components/AuthProvider";
import TransactionsLedger from "@/components/admin/TransactionsLedger";
import PageHeader from "@/components/ui/PageHeader";
import Button, { buttonClasses } from "@/components/ui/Button";
import { getAllWorkers, subscribeToLedger, subscribeToTransactions } from "@/lib/finance";
import { buildRows } from "@/lib/financeLedger";
import { getFriendlyErrorMessage, logError } from "@/lib/errors";
import { LedgerEntry, Transaction } from "@/types";

const SCOPE =
  "Incoming is funds an administrator recorded as added; outgoing is a payment an administrator recorded as made. Amounts count posted entries only. " +
  "The opening balance and any funds added before the ledger existed are not itemised, so these totals are movements, not the balance; the balance is on the Finance page.";

export default function AdminTransactionsPage() {
  const { userProfile } = useAuthContext();
  const [transactions, setTransactions] = useState<Transaction[] | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[] | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setError("");
    let cancelled = false;
    const onError = (scope: string) => (err: unknown) => {
      logError(scope, err);
      if (!cancelled) setError(getFriendlyErrorMessage(err, "Please try again."));
    };
    const unsubTx = subscribeToTransactions(null, setTransactions, onError("subscribeToTransactions"));
    const unsubLedger = subscribeToLedger(setLedger, onError("subscribeToLedger"));
    getAllWorkers()
      .then((workers) => {
        if (!cancelled) setNames(Object.fromEntries(workers.map((w) => [w.id, w.name])));
      })
      .catch((err) => logError("getAllWorkers", err));
    return () => {
      cancelled = true;
      unsubTx();
      unsubLedger();
    };
  }, [refreshKey]);

  const rows = useMemo(() => buildRows(transactions ?? [], ledger ?? []), [transactions, ledger]);
  const nameOf = useMemo(() => {
    const all = { ...names, ...(userProfile ? { [userProfile.id]: `${userProfile.name} (you)` } : {}) };
    return (uid: string) => all[uid];
  }, [names, userProfile]);

  return (
    <>
      <PageHeader
        title="Transactions"
        description="Every payment and funds addition recorded in UniFix, newest first."
        actions={
          <>
            <Button variant="secondary" icon={<RefreshCw className="h-4 w-4" aria-hidden="true" />} onClick={() => setRefreshKey((k) => k + 1)}>
              Refresh
            </Button>
            <Link href="/admin/finance" className={buttonClasses("primary")}>
              <Wallet className="h-4 w-4" aria-hidden="true" />
              Finance
            </Link>
          </>
        }
      />
      <TransactionsLedger
        rows={rows}
        loading={(transactions === null || ledger === null) && !error}
        error={error || undefined}
        onRetry={() => setRefreshKey((k) => k + 1)}
        issueHref={(id) => `/issues/${id}`}
        nameOf={nameOf}
        scopeNote={SCOPE}
      />
    </>
  );
}
