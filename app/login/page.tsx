"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, MailCheck } from "lucide-react";
import { useAuthContext } from "@/components/AuthProvider";
import AuthLayout from "@/components/shell/AuthLayout";
import { Input } from "@/components/ui/Field";
import Button, { buttonClasses } from "@/components/ui/Button";
import { Notice } from "@/components/ui/States";
import { ROLE_LABELS } from "@/components/shell/nav";
import { getFriendlyErrorMessage, logError } from "@/lib/errors";
import { dashboardPathForRole } from "@/lib/roles";
import { safeRedirectPath } from "@/lib/navigation";
import { isValidEmail } from "@/lib/validation";
import { sendPasswordReset } from "@/lib/auth";

export default function LoginPage() {
  const { signIn, userProfile, loading, activeRole, isAuthenticated, profileError, reloadProfile } = useAuthContext();
  const router = useRouter();

  const [mode, setMode] = useState<"signin" | "reset">("signin");
  // Switching between sign-in and reset replaces the form: move focus to its first field.
  const emailRef = useRef<HTMLInputElement>(null);
  const modeChanged = useRef(false);
  useEffect(() => {
    if (!modeChanged.current) {
      modeChanged.current = true;
      return;
    }
    emailRef.current?.focus();
  }, [mode]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState({ email: false, password: false });
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  // Only redirect after a sign-in made on this page — not on page load.
  const [justSignedIn, setJustSignedIn] = useState(false);
  // Where to go after signing in (only same-site paths are accepted).
  const [next, setNext] = useState<string | null>(null);
  useEffect(() => {
    setNext(safeRedirectPath(new URLSearchParams(window.location.search).get("next")));
  }, []);

  useEffect(() => {
    if (loading || !justSignedIn) return;
    if (!userProfile) {
      // Signed in, but the profile couldn't be loaded: don't spin forever.
      if (isAuthenticated && profileError) {
        setError("Signed in, but we couldn't load your account. Please check your connection and try again.");
        setIsLoading(false);
      }
      return;
    }
    router.push(next ?? dashboardPathForRole(activeRole));
  }, [loading, userProfile, justSignedIn, activeRole, isAuthenticated, profileError, router, next]);

  const show = (field: "email" | "password") => touched[field] || submitted;
  const emailError = !email.trim() ? "Enter your email address." : !isValidEmail(email.trim().toLowerCase()) ? "That email address doesn't look right." : "";
  const passwordError = !password ? "Enter your password." : "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    setSubmitted(true);
    setError("");
    if (emailError || passwordError) return;
    setIsLoading(true);
    try {
      if (isAuthenticated) {
        // Already signed in from a previous attempt whose profile failed to load.
        setJustSignedIn(true);
        await reloadProfile();
      } else {
        await signIn(email, password);
        setJustSignedIn(true);
      }
    } catch (err: unknown) {
      setError(getFriendlyErrorMessage(err, "Failed to sign in. Please try again."));
      setIsLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setError("");
    if (emailError) return;
    setIsLoading(true);
    try {
      await sendPasswordReset(email);
      setResetSent(true);
    } catch (err) {
      logError("sendPasswordReset", err);
      // Don't reveal whether an account exists; only surface real failures (network, rate limit).
      const message = getFriendlyErrorMessage(err, "");
      if (message && !/password|email/i.test(message)) setError(message);
      else setResetSent(true);
    } finally {
      setIsLoading(false);
    }
  };

  // Already signed in — offer to continue instead of showing the form.
  if (!loading && userProfile && !justSignedIn) {
    return (
      <AuthLayout title="You're signed in" description={`${userProfile.email} · ${ROLE_LABELS[activeRole]}`}>
        <div className="space-y-2">
          <Button className="w-full" size="lg" onClick={() => router.replace(next ?? dashboardPathForRole(activeRole))}>
            {next ? "Continue" : "Go to my dashboard"}
          </Button>
          <Link href="/switch-role" className={buttonClasses("secondary", "lg", "w-full")}>
            Switch view
          </Link>
        </div>
      </AuthLayout>
    );
  }

  if (mode === "reset") {
    return (
      <AuthLayout
        title="Reset your password"
        description="Enter the email you signed up with and we'll send you a reset link."
        footer={
          <button type="button" onClick={() => { setMode("signin"); setResetSent(false); setSubmitted(false); setError(""); }} className="inline-flex items-center gap-1.5 font-medium text-brand-fg hover:underline">
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Back to sign in
          </button>
        }
      >
        {resetSent ? (
          <div className="text-center" role="status">
            <MailCheck className="mx-auto h-8 w-8 text-success" aria-hidden="true" />
            <p className="mt-3 text-sm font-medium text-fg">Check your inbox</p>
            <p className="mt-1 text-[13px] text-fg-muted">
              If an account exists for {email.trim()}, a reset link is on its way. It may take a minute to arrive.
            </p>
          </div>
        ) : (
          <form onSubmit={handleReset} className="space-y-4" noValidate>
            <Input
              label="Email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, email: true }))}
              error={show("email") ? emailError : undefined}
              ref={emailRef}
              required
            />
            {error && <Notice tone="danger">{error}</Notice>}
            <Button type="submit" isLoading={isLoading} className="w-full" size="lg">
              Send reset link
            </Button>
          </form>
        )}
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Welcome back"
      description="Sign in to report and track campus issues."
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link href="/register" className="font-medium text-brand-fg hover:underline">
            Create one
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, email: true }))}
          error={show("email") ? emailError : undefined}
          ref={emailRef}
          required
        />
        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, password: true }))}
          error={show("password") ? passwordError : undefined}
          required
          aside={
            <button type="button" onClick={() => { setMode("reset"); setSubmitted(false); setError(""); }} className="font-medium text-brand-fg hover:underline">
              Forgot password?
            </button>
          }
        />
        {error && <Notice tone="danger">{error}</Notice>}
        <Button type="submit" isLoading={isLoading} className="w-full" size="lg">
          Sign in
        </Button>
      </form>
    </AuthLayout>
  );
}
