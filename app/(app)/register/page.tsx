"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { HardHat, UserRound } from "lucide-react";
import { useAuthContext } from "@/components/AuthProvider";
import { UserRole } from "@/types";
import AuthLayout from "@/components/shell/AuthLayout";
import { Input } from "@/components/ui/Field";
import Button from "@/components/ui/Button";
import { Notice } from "@/components/ui/States";
import { LIMITS } from "@/lib/constants";
import { getFriendlyErrorMessage } from "@/lib/errors";
import { dashboardPathForRole } from "@/lib/roles";
import { cleanText, getPasswordError, isValidEmail, validateRegistration } from "@/lib/validation";
import { cn } from "@/lib/cn";

const ROLES: { value: UserRole; icon: React.ReactNode; title: string; desc: string }[] = [
  { value: "user", icon: <UserRound className="h-4 w-4" aria-hidden="true" />, title: "Report issues", desc: "Student or staff" },
  { value: "worker", icon: <HardHat className="h-4 w-4" aria-hidden="true" />, title: "Resolve issues", desc: "Maintenance staff" },
];

export default function RegisterPage() {
  const { signUp, userProfile, loading, activeRole } = useAuthContext();
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("user");
  const [touched, setTouched] = useState({ name: false, email: false, password: false });
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Redirect if already signed in on load, or right after signing up.
  const justSignedUp = useRef(false);
  const initialLoadDone = useRef(false);
  useEffect(() => {
    if (loading) return;
    if (!initialLoadDone.current) {
      initialLoadDone.current = true;
      if (userProfile) router.push(dashboardPathForRole(activeRole));
      return;
    }
    if (justSignedUp.current && userProfile) router.push(dashboardPathForRole(activeRole));
  }, [userProfile, loading, activeRole, router]);

  const show = (field: keyof typeof touched) => touched[field] || submitted;
  const blur = (field: keyof typeof touched) => () => setTouched((t) => ({ ...t, [field]: true }));
  const nameError = !cleanText(name) ? "Enter your full name." : "";
  const emailError = !email.trim() ? "Enter your email address." : !isValidEmail(email.trim().toLowerCase()) ? "That email address doesn't look right." : "";
  const passwordError = getPasswordError(password) ?? "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    setSubmitted(true);
    setError("");
    if (nameError || emailError || passwordError) return;
    try {
      validateRegistration({ name, email, password, role });
    } catch (err) {
      setError(getFriendlyErrorMessage(err));
      return;
    }
    setIsLoading(true);
    try {
      justSignedUp.current = true;
      await signUp(email, password, name, role);
      // Redirect happens once the profile loads.
    } catch (err: unknown) {
      justSignedUp.current = false;
      setError(getFriendlyErrorMessage(err, "Failed to create account. Please try again."));
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Create your account"
      description="Report campus issues and follow them until they're fixed."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-brand-fg hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Input
          label="Full name"
          autoComplete="name"
          maxLength={LIMITS.name}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={blur("name")}
          error={show("name") ? nameError : undefined}
          required
        />
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={blur("email")}
          error={show("email") ? emailError : undefined}
          required
        />
        <Input
          label="Password"
          type="password"
          autoComplete="new-password"
          minLength={LIMITS.passwordMin}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onBlur={blur("password")}
          error={show("password") ? passwordError : undefined}
          valid={touched.password && !passwordError}
          hint={`At least ${LIMITS.passwordMin} characters, with a letter and a number.`}
          required
        />

        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-fg">How will you use UniFix?</legend>
          <div className="grid grid-cols-2 gap-2" role="radiogroup">
            {ROLES.map((r) => {
              const active = role === r.value;
              return (
                <button
                  key={r.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setRole(r.value)}
                  className={cn(
                    "flex flex-col items-start gap-1 rounded-md border px-3 py-2.5 text-left transition-[border-color,background-color,box-shadow] duration-150",
                    active ? "border-brand bg-brand-subtle ring-1 ring-brand" : "border-border hover:border-border-strong hover:bg-surface-hover"
                  )}
                >
                  <span className={cn("flex items-center gap-1.5 text-sm font-medium", active ? "text-brand-fg" : "text-fg")}>
                    {r.icon}
                    {r.title}
                  </span>
                  <span className="text-xs text-fg-subtle">{r.desc}</span>
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[13px] text-fg-subtle">
            {role === "worker"
              ? "Worker access needs an administrator's approval. You can report issues straight away."
              : "Administrator access is granted by the campus team, not chosen at sign-up."}
          </p>
        </fieldset>

        {error && <Notice tone="danger">{error}</Notice>}

        <Button type="submit" isLoading={isLoading} className="w-full" size="lg">
          Create account
        </Button>
      </form>
    </AuthLayout>
  );
}
