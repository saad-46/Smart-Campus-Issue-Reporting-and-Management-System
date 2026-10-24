"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ConfirmationResult } from "firebase/auth";
import { OtpRequestError, sendEmailOtp, verifyEmailOtp } from "@/lib/otpClient";
import { abandonPhoneSession, confirmPhoneOtp, phoneOtpEnabled, sendPhoneOtp } from "@/lib/phoneAuth";
import { normalizePhone } from "@/lib/phone";
import { getFriendlyErrorMessage, logError } from "@/lib/errors";
import { isValidEmail, sanitizeOtpInput } from "@/lib/validation";

export type OtpStatus = "idle" | "sending" | "sent" | "verifying" | "verified";

export interface ContactOtp {
  status: OtpStatus;
  error: string;
  code: string;
  setCode: (v: string) => void;
  /** Seconds until another code may be requested (0 = now). */
  cooldown: number;
  /** The exact contact the code went to (normalised); empty before sending. */
  sentTo: string;
  /** True only while the contact currently typed is the one that was verified. */
  verified: boolean;
  send: () => Promise<void>;
  verify: () => Promise<void>;
  reset: () => void;
  available: boolean;
}

function useCooldown() {
  const [until, setUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (until <= Date.now()) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [until]);
  return { seconds: Math.max(0, Math.ceil((until - now) / 1000)), start: (s: number) => { setNow(Date.now()); setUntil(Date.now() + s * 1000); }, clear: () => setUntil(0) };
}

/** Email OTP: send, verify on the server, hold the one-time ticket. Editing the address starts over. */
export function useEmailOtp(email: string): ContactOtp & { ticket: string } {
  const normalized = email.trim().toLowerCase();
  const [status, setStatus] = useState<OtpStatus>("idle");
  const [error, setError] = useState("");
  const [code, setCodeState] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [ticket, setTicket] = useState("");
  const challenge = useRef("");
  const cool = useCooldown();

  const reset = useCallback(() => {
    setStatus("idle");
    setError("");
    setCodeState("");
    setSentTo("");
    setTicket("");
    challenge.current = "";
    cool.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Changing the address after a code was sent or verified invalidates it.
  useEffect(() => {
    if (sentTo && sentTo !== normalized) reset();
  }, [normalized, sentTo, reset]);

  const send = useCallback(async () => {
    if (!isValidEmail(normalized) || status === "sending" || status === "verifying") return;
    setStatus("sending");
    setError("");
    try {
      const result = await sendEmailOtp(normalized);
      challenge.current = result.challengeId;
      setSentTo(normalized);
      setCodeState("");
      setTicket("");
      cool.start(result.cooldownSeconds);
      setStatus("sent");
    } catch (err) {
      if (err instanceof OtpRequestError && err.retryAfterSeconds) cool.start(Math.min(err.retryAfterSeconds, 3600));
      setError(getFriendlyErrorMessage(err, "We couldn't send the code. Please try again."));
      setStatus(sentTo ? "sent" : "idle");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalized, status, sentTo]);

  const verify = useCallback(async () => {
    if (status !== "sent" || !/^\d{6}$/.test(code)) return;
    setStatus("verifying");
    setError("");
    try {
      setTicket(await verifyEmailOtp({ challengeId: challenge.current, email: normalized, code }));
      setStatus("verified");
    } catch (err) {
      logError("verifyEmailOtp", err);
      setError(getFriendlyErrorMessage(err, "That code isn't right. Check it and try again."));
      setStatus("sent");
    }
  }, [status, code, normalized]);

  return {
    status,
    error,
    code,
    setCode: (v) => setCodeState(sanitizeOtpInput(v)),
    cooldown: cool.seconds,
    sentTo,
    verified: status === "verified" && sentTo === normalized,
    send,
    verify,
    reset,
    available: true,
    ticket,
  };
}

/** Phone OTP through Firebase. Editing the number signs the half-finished phone session out. */
export function usePhoneOtp(phone: string, container: string, hold: (on: boolean) => void): ContactOtp {
  const normalized = normalizePhone(phone) ?? "";
  const [status, setStatus] = useState<OtpStatus>("idle");
  const [error, setError] = useState("");
  const [code, setCodeState] = useState("");
  const [sentTo, setSentTo] = useState("");
  const confirmation = useRef<ConfirmationResult | null>(null);
  const cool = useCooldown();

  const reset = useCallback(() => {
    setStatus("idle");
    setError("");
    setCodeState("");
    setSentTo("");
    confirmation.current = null;
    cool.clear();
    hold(false);
    void abandonPhoneSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hold]);

  useEffect(() => {
    if (sentTo && sentTo !== normalized) reset();
  }, [normalized, sentTo, reset]);

  // Leaving the page with a half-finished phone session must not leave the browser signed in as it,
  // nor leave profile loading switched off for whoever signs in next.
  useEffect(
    () => () => {
      hold(false);
      void abandonPhoneSession();
    },
    [hold]
  );

  const send = useCallback(async () => {
    if (!phoneOtpEnabled || !normalized || status === "sending" || status === "verifying") return;
    setStatus("sending");
    setError("");
    hold(true);
    try {
      confirmation.current = await sendPhoneOtp(normalized, container);
      setSentTo(normalized);
      setCodeState("");
      cool.start(60);
      setStatus("sent");
    } catch (err) {
      setError(getFriendlyErrorMessage(err, "We couldn't send the code. Please try again."));
      setStatus(sentTo ? "sent" : "idle");
      if (!sentTo) hold(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalized, status, container, hold, sentTo]);

  const verify = useCallback(async () => {
    if (status !== "sent" || !confirmation.current || !/^\d{6}$/.test(code)) return;
    setStatus("verifying");
    setError("");
    try {
      await confirmPhoneOtp(confirmation.current, code);
      setStatus("verified");
    } catch (err) {
      setError(getFriendlyErrorMessage(err, "That code isn't right. Check it and try again."));
      // A number that already has an account was signed out again: start over for that number.
      setStatus("sent");
    }
  }, [status, code]);

  return {
    status,
    error,
    code,
    setCode: (v) => setCodeState(sanitizeOtpInput(v)),
    cooldown: cool.seconds,
    sentTo,
    verified: status === "verified" && sentTo === normalized,
    send,
    verify,
    reset,
    available: phoneOtpEnabled,
  };
}
