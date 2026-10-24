"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Receipt, ShieldCheck, UserCheck } from "lucide-react";
import Card, { CardHeader } from "@/components/ui/Card";
import Button, { buttonClasses } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { Issue, User } from "@/types";
import { subscribeToPendingClaims } from "@/lib/firestore";
import { setWorkerAccess, subscribeToAdminRequests, subscribeToWorkerRequests } from "@/lib/finance";
import { decideAdminAccess } from "@/lib/otpClient";
import { getFriendlyErrorMessage, logError } from "@/lib/errors";

const currency = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const LIST = "max-h-[22rem] divide-y divide-border overflow-y-auto";

/**
 * The two queues an administrator acts on from the overview: expense claims
 * waiting for a decision and accounts asking for worker access. Read-only
 * for claims (the decision needs the Finance page's payment details); a
 * worker-access decision uses the same trusted write as the Workers page.
 * Both reads are limited by Firestore rules to administrators.
 */
export default function DashboardQueues({ adminId }: { adminId: string }) {
  const toast = useToast();
  const [claims, setClaims] = useState<Issue[] | null>(null);
  const [requests, setRequests] = useState<User[] | null>(null);
  const [claimsError, setClaimsError] = useState("");
  const [requestsError, setRequestsError] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  const [pending, setPending] = useState<{ user: User; decision: "approve" | "reject" } | null>(null);
  const [adminRequests, setAdminRequests] = useState<User[] | null>(null);
  const [adminError, setAdminError] = useState("");
  const [pendingAdmin, setPendingAdmin] = useState<{ user: User; decision: "approve" | "reject" } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setClaimsError("");
    return subscribeToPendingClaims(setClaims, (err) => {
      logError("subscribeToPendingClaims", err);
      setClaimsError(getFriendlyErrorMessage(err, "Claims couldn't be loaded."));
    });
  }, [retryKey]);

  useEffect(() => {
    setRequestsError("");
    return subscribeToWorkerRequests(setRequests, (err) => {
      logError("subscribeToWorkerRequests", err);
      setRequestsError(getFriendlyErrorMessage(err, "Requests couldn't be loaded."));
    });
  }, [retryKey]);

  useEffect(() => {
    setAdminError("");
    return subscribeToAdminRequests(setAdminRequests, (err) => {
      logError("subscribeToAdminRequests", err);
      setAdminError(getFriendlyErrorMessage(err, "Administrator requests couldn't be loaded."));
    });
  }, [retryKey]);

  const waiting = useMemo(() => (claims ?? []).filter((i) => (i.claimAmount ?? 0) > 0), [claims]);
  const total = waiting.reduce((sum, i) => sum + (i.claimAmount ?? 0), 0);

  const decide = async () => {
    if (!pending || busy) return;
    setBusy(true);
    try {
      await setWorkerAccess(pending.user.id, pending.decision, adminId);
      toast.success(pending.decision === "approve" ? `${pending.user.name} is now a worker` : "Request rejected", "They've been notified.");
      setPending(null);
    } catch (err) {
      logError("setWorkerAccess", err);
      toast.error("Couldn't update that account", getFriendlyErrorMessage(err, "Please try again."));
    } finally {
      setBusy(false);
    }
  };

  const decideAdmin = async () => {
    if (!pendingAdmin || busy) return;
    setBusy(true);
    try {
      // Decided on the server, which checks the caller really is an administrator.
      await decideAdminAccess(pendingAdmin.user.id, pendingAdmin.decision);
      toast.success(pendingAdmin.decision === "approve" ? `${pendingAdmin.user.name} is now an administrator` : "Request declined", pendingAdmin.decision === "approve" ? "They can open the admin pages next time they sign in as Admin." : "Their account stays a regular account.");
      setPendingAdmin(null);
    } catch (err) {
      logError("decideAdminAccess", err);
      toast.error("Couldn't update that request", getFriendlyErrorMessage(err, "Please try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader
          title="Claims to review"
          description={claims === null ? undefined : `${waiting.length} waiting · ${currency(total)}`}
          action={
            <Link href="/admin/finance" className="inline-flex items-center gap-1 text-[13px] font-medium text-brand-fg hover:underline">
              Finance <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          }
        />
        <div className="mt-3 border-t border-border">
          {claimsError ? (
            <ErrorState title="Couldn't load claims" description={claimsError} onRetry={() => setRetryKey((k) => k + 1)} />
          ) : claims === null ? (
            <SkeletonRows rows={3} label="Loading claims" />
          ) : waiting.length === 0 ? (
            <EmptyState compact icon={<Receipt />} title="No claims waiting" />
          ) : (
            <ul className={LIST}>
              {waiting.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-fg">{i.claimDescription || "Expense claim"}</p>
                    <p className="truncate text-[13px] text-fg-subtle">{i.title}</p>
                  </div>
                  <Link href="/admin/finance" className={buttonClasses("secondary", "sm")} aria-label={`Review ${currency(i.claimAmount ?? 0)} claim for “${i.title}”`}>
                    Review {currency(i.claimAmount ?? 0)}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Worker access requests"
          description="Only an administrator can approve these"
          action={
            <Link href="/admin/workers" className="inline-flex items-center gap-1 text-[13px] font-medium text-brand-fg hover:underline">
              Workers <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          }
        />
        <div className="mt-3 border-t border-border">
          {requestsError ? (
            <ErrorState title="Couldn't load requests" description={requestsError} onRetry={() => setRetryKey((k) => k + 1)} />
          ) : requests === null ? (
            <SkeletonRows rows={2} label="Loading requests" />
          ) : requests.length === 0 ? (
            <EmptyState compact icon={<UserCheck />} title="No requests" />
          ) : (
            <ul className={LIST}>
              {requests.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
                  <span className="block min-w-0 truncate text-sm font-medium text-fg">{r.name}</span>
                  <span className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => setPending({ user: r, decision: "reject" })} aria-label={`Decline ${r.name}`}>
                      Decline
                    </Button>
                    <Button size="sm" onClick={() => setPending({ user: r, decision: "approve" })} aria-label={`Approve ${r.name}`}>
                      Approve
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader title="Administrator access requests" description="Granting access gives full control of campus data. Check you know who is asking." />
        <div className="mt-3 border-t border-border">
          {adminError ? (
            <ErrorState title="Couldn't load requests" description={adminError} onRetry={() => setRetryKey((k) => k + 1)} />
          ) : adminRequests === null ? (
            <SkeletonRows rows={2} label="Loading administrator requests" />
          ) : adminRequests.length === 0 ? (
            <EmptyState compact icon={<ShieldCheck />} title="No administrator requests" />
          ) : (
            <ul className={LIST}>
              {adminRequests.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-fg">{r.name}</span>
                    <span className="block truncate text-[13px] text-fg-subtle">
                      {r.email} · {r.phone ?? "no phone"} · verified by {r.verifiedVia ?? "unknown"}
                    </span>
                  </span>
                  <span className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => setPendingAdmin({ user: r, decision: "reject" })} aria-label={`Decline administrator request from ${r.name}`}>
                      Decline
                    </Button>
                    <Button size="sm" onClick={() => setPendingAdmin({ user: r, decision: "approve" })} aria-label={`Approve administrator request from ${r.name}`}>
                      Approve
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      <ConfirmDialog
        open={!!pendingAdmin}
        title={pendingAdmin?.decision === "approve" ? "Make this person an administrator?" : "Decline this request?"}
        description={
          pendingAdmin
            ? pendingAdmin.decision === "approve"
              ? `${pendingAdmin.user.name} (${pendingAdmin.user.email}) will be able to see and change all campus data, finance and worker access. Only continue if you know who they are.`
              : `${pendingAdmin.user.name} stays a regular account.`
            : undefined
        }
        confirmLabel={pendingAdmin?.decision === "approve" ? "Make administrator" : "Decline"}
        tone={pendingAdmin?.decision === "approve" ? "danger" : "primary"}
        busy={busy}
        onConfirm={decideAdmin}
        onCancel={() => setPendingAdmin(null)}
      />

      <ConfirmDialog
        open={!!pending}
        title={pending?.decision === "approve" ? "Give this account worker access?" : "Decline this request?"}
        description={
          pending
            ? pending.decision === "approve"
              ? `${pending.user.name} will be able to claim and resolve issues and submit expense claims.`
              : `${pending.user.name} stays a regular account and is notified.`
            : undefined
        }
        confirmLabel={pending?.decision === "approve" ? "Approve" : "Decline"}
        tone={pending?.decision === "approve" ? "primary" : "danger"}
        busy={busy}
        onConfirm={decide}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}
