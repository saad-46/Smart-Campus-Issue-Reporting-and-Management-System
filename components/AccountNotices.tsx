"use client";

import { useState } from "react";
import { useAuthContext } from "./AuthProvider";
import { refreshEmailVerified, resendVerificationEmail } from "@/lib/auth";
import { getFriendlyErrorMessage, logError } from "@/lib/errors";
import { Notice } from "./ui/States";
import Button from "./ui/Button";

/**
 * Account-level notices shown on the dashboard:
 *  - a worker-access request that is waiting for (or was refused by) an admin
 *  - an email address that hasn't been verified yet
 *
 * Verification is encouraged, not enforced: nothing is blocked for an
 * unverified account (see the audit report for how to enforce it).
 */
export default function AccountNotices() {
  const { user, userProfile } = useAuthContext();
  const [verified, setVerified] = useState(user?.emailVerified ?? true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  if (!user || !userProfile) return null;

  const handleResend = async () => {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      await resendVerificationEmail();
      setMessage("Verification email sent. Check your inbox.");
    } catch (err) {
      logError("resendVerificationEmail", err);
      setMessage(getFriendlyErrorMessage(err, "Couldn't send the email. Please try again later."));
    } finally {
      setBusy(false);
    }
  };

  const handleRefresh = async () => {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const nowVerified = await refreshEmailVerified();
      setVerified(nowVerified);
      if (!nowVerified) setMessage("Not verified yet. Open the link in the email we sent you.");
    } catch (err) {
      logError("refreshEmailVerified", err);
      setMessage(getFriendlyErrorMessage(err, "Couldn't check right now. Please try again."));
    } finally {
      setBusy(false);
    }
  };

  const request = userProfile.workerRequest;
  const showWorkerNotice = userProfile.role !== "worker" && (request === "pending" || request === "rejected");

  if (verified && !showWorkerNotice) return null;

  return (
    <div className="mb-6 space-y-3">
      {showWorkerNotice && (
        <Notice tone={request === "pending" ? "info" : "warning"} title={request === "pending" ? "Worker access requested" : "Worker access not approved"}>
          {request === "pending"
            ? "An administrator will review your request. You can report issues in the meantime."
            : "Contact an administrator if you think this is a mistake."}
        </Notice>
      )}

      {!verified && (
        <Notice
          tone="warning"
          title="Verify your email address"
          action={
            <>
              <Button size="sm" variant="secondary" onClick={handleResend} disabled={busy}>
                Resend email
              </Button>
              <Button size="sm" onClick={handleRefresh} isLoading={busy}>
                I&apos;ve verified
              </Button>
            </>
          }
        >
          We sent a link to {userProfile.email}.
          {message && <span className="mt-1 block font-medium text-fg">{message}</span>}
        </Notice>
      )}
    </div>
  );
}
