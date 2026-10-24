"use client";

import React from "react";
import { BadgeCheck } from "lucide-react";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { ContactOtp } from "@/hooks/useContactOtp";

/**
 * "Send OTP" under a contact field, then the six-digit code and "Verify OTP".
 * It only shows what the hook reports: whether a contact counts as verified is
 * decided by the server (email) or Firebase (phone), never by this component.
 */
export default function OtpPanel({
  otp,
  noun,
  contactValid,
  unavailableNote,
  idPrefix,
}: {
  otp: ContactOtp;
  /** "email" or "phone", for the labels. */
  noun: "email" | "phone";
  contactValid: boolean;
  unavailableNote?: string;
  idPrefix: string;
}) {
  if (!otp.available) {
    return unavailableNote ? <p className="mt-2 text-[13px] text-fg-subtle">{unavailableNote}</p> : null;
  }
  const busy = otp.status === "sending" || otp.status === "verifying";
  const sentOrBeyond = otp.status === "sent" || otp.status === "verifying" || otp.status === "verified";
  const sendLabel = otp.status === "sending" ? "Sending…" : otp.cooldown > 0 ? `Resend in ${otp.cooldown}s` : sentOrBeyond ? "Resend OTP" : "Send OTP";

  return (
    <div className="mt-2 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {otp.verified ? (
          <span role="status" className="inline-flex items-center gap-1.5 rounded-md border border-success-border bg-success-subtle px-2.5 py-1 text-[13px] font-medium text-success">
            <BadgeCheck className="h-4 w-4" aria-hidden="true" />
            {noun === "email" ? "Email" : "Phone"} verified
          </span>
        ) : (
          <>
            <Button type="button" size="sm" variant="secondary" onClick={() => void otp.send()} disabled={!contactValid || busy || otp.cooldown > 0} isLoading={otp.status === "sending"}>
              {sendLabel}
            </Button>
            <span className="text-[13px] text-fg-subtle">{sentOrBeyond ? "Not verified yet" : `Verify your ${noun} with a one-time code`}</span>
          </>
        )}
      </div>

      {!otp.verified && (otp.status === "sent" || otp.status === "verifying") && (
        <div className="space-y-2">
          <Input
            id={`${idPrefix}-otp`}
            label={`6-digit code sent to your ${noun}`}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={otp.code}
            onChange={(e) => otp.setCode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void otp.verify();
              }
            }}
            placeholder="123456"
          />
          <Button type="button" size="sm" onClick={() => void otp.verify()} disabled={otp.code.length !== 6 || otp.status === "verifying"} isLoading={otp.status === "verifying"}>
            Verify OTP
          </Button>
        </div>
      )}

      <div aria-live="polite" className="min-h-0">
        {otp.error && <p className="text-[13px] text-danger">{otp.error}</p>}
      </div>
    </div>
  );
}
