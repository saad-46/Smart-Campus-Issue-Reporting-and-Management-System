"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { HardHat, ShieldCheck, UserRound } from "lucide-react";
import { useAuthContext } from "@/components/AuthProvider";
import AuthLayout from "@/components/shell/AuthLayout";
import OtpPanel from "@/components/OtpPanel";
import StudentFields, { EMPTY_STUDENT, StudentDraft } from "@/components/StudentFields";
import { Input, Select } from "@/components/ui/Field";
import Button from "@/components/ui/Button";
import { Notice } from "@/components/ui/States";
import { useEmailOtp, usePhoneOtp } from "@/hooks/useContactOtp";
import { abandonPhoneSession, isLabelledTestNumber, phoneOtpEnabled } from "@/lib/phoneAuth";
import { DEPARTMENTS, LIMITS } from "@/lib/constants";
import { getFriendlyErrorMessage } from "@/lib/errors";
import { normalizePhone, phoneError as phoneErrorFor } from "@/lib/phone";
import { dashboardPathForRole } from "@/lib/roles";
import { RegistrationRequest } from "@/lib/auth";
import { cleanText, getPasswordError, isValidEmail, sanitizePinInput, studentProfileErrors, validateRegistration } from "@/lib/validation";
import { cn } from "@/lib/cn";

type Kind = RegistrationRequest["kind"];

const ROLES: { value: Kind; icon: React.ReactNode; title: string; desc: string }[] = [
  { value: "student", icon: <UserRound className="h-4 w-4" aria-hidden="true" />, title: "Report issues", desc: "Student" },
  { value: "worker", icon: <HardHat className="h-4 w-4" aria-hidden="true" />, title: "Resolve issues", desc: "Maintenance staff" },
  { value: "admin", icon: <ShieldCheck className="h-4 w-4" aria-hidden="true" />, title: "Manage campus", desc: "Administrator" },
];

const ROLE_NOTE: Record<Kind, string> = {
  student: "Students report problems and follow them until they're fixed.",
  worker: "Worker access needs an administrator's approval. You can report issues straight away.",
  admin: "Administrator access is granted by the campus team. Your request is reviewed by an existing administrator; until then this is a regular account.",
};

const PHONE_CONTAINER = "phone-recaptcha";

export default function RegisterPage() {
  const { signUp, holdProfileLoad, userProfile, loading, activeRole } = useAuthContext();
  const router = useRouter();

  const [kind, setKind] = useState<Kind>("student");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [student, setStudent] = useState<StudentDraft>(EMPTY_STUDENT);
  const [workArea, setWorkArea] = useState("");
  const [touched, setTouched] = useState({ name: false, email: false, phone: false, password: false });
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const emailOtp = useEmailOtp(email);
  const phoneOtp = usePhoneOtp(phone, PHONE_CONTAINER, holdProfileLoad);

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
  const phoneError = phoneErrorFor(phone);
  const passwordError = getPasswordError(password) ?? "";
  const studentErrors = kind === "student" ? studentProfileErrors(student) : {};
  const workAreaError = kind === "worker" && !DEPARTMENTS.includes(workArea) ? "Choose the team you work with." : "";
  const verified = emailOtp.verified || phoneOtp.verified;
  const verifyError = submitted && !verified ? "Verify your email or phone number with a one-time code before creating your account." : "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    setSubmitted(true);
    setError("");
    if (nameError || emailError || phoneError || passwordError || workAreaError || Object.keys(studentErrors).length > 0 || !verified) return;
    try {
      validateRegistration({ name, email, password, role: kind === "worker" ? "worker" : "user" });
    } catch (err) {
      setError(getFriendlyErrorMessage(err));
      return;
    }
    setIsLoading(true);
    try {
      justSignedUp.current = true;
      // A verified email wins when both are verified; the phone session is then not needed.
      const viaEmail = emailOtp.verified;
      if (viaEmail) await abandonPhoneSession();
      await signUp({
        kind,
        name,
        email,
        password,
        phone: normalizePhone(phone) ?? phone,
        verification: viaEmail ? { via: "email", ticket: emailOtp.ticket } : { via: "phone" },
        student: kind === "student" ? student : undefined,
        workArea: kind === "worker" ? workArea : undefined,
      });
      // Redirect happens once the profile loads.
    } catch (err: unknown) {
      justSignedUp.current = false;
      setError(getFriendlyErrorMessage(err, "Failed to create account. Please try again."));
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      wide
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
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-fg">How will you use UniFix?</legend>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="How will you use UniFix?">
            {ROLES.map((r) => {
              const active = kind === r.value;
              return (
                <button
                  key={r.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setKind(r.value)}
                  className={cn(
                    "flex min-w-0 flex-col items-start gap-1.5 rounded-md border px-2.5 py-2.5 text-left transition-[border-color,background-color,box-shadow] duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:px-3",
                    active ? "border-brand bg-brand-subtle ring-1 ring-brand" : "border-border hover:border-border-strong hover:bg-surface-hover"
                  )}
                >
                  <span className={cn("flex min-w-0 flex-col items-start gap-1 text-[13px] font-medium leading-tight sm:flex-row sm:items-center sm:gap-1.5 sm:text-sm", active ? "text-brand-fg" : "text-fg")}>
                    {r.icon}
                    <span className="min-w-0 break-words">{r.title}</span>
                  </span>
                  <span className="text-xs leading-tight text-fg-subtle">{r.desc}</span>
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[13px] text-fg-subtle">{ROLE_NOTE[kind]}</p>
        </fieldset>

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

        <div>
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
          <OtpPanel otp={emailOtp} noun="email" contactValid={!emailError} idPrefix="email" />
        </div>

        <div>
          <Input
            label="Phone number"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onBlur={blur("phone")}
            error={show("phone") ? phoneError : undefined}
            hint="With country code if it isn't in India, e.g. +44 20 7946 0958"
            required
          />
          <OtpPanel otp={phoneOtp} noun="phone" contactValid={!phoneError} idPrefix="phone" unavailableNote={phoneOtpEnabled ? undefined : "Text-message verification isn't available yet. Verify your email instead."} />
          {isLabelledTestNumber(normalizePhone(phone)) && (
            <p className="mt-2 text-[13px] text-fg-subtle">Test phone number: no text message is sent. Use the test code set up for it in the test Firebase project.</p>
          )}
          <div id={PHONE_CONTAINER} />
        </div>

        {verifyError && <p role="alert" className="text-[13px] text-danger">{verifyError}</p>}

        <Input
          label={`${LIMITS.pinLength}-digit PIN`}
          type="password"
          inputMode="numeric"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(sanitizePinInput(e.target.value))}
          onBlur={blur("password")}
          error={show("password") ? passwordError : undefined}
          valid={touched.password && !passwordError}
          hint={`Exactly ${LIMITS.pinLength} digits. You'll use it to sign in.`}
          required
        />

        {kind === "student" && <StudentFields value={student} onChange={setStudent} errors={studentErrors} showErrors={submitted} />}

        {kind === "worker" && (
          <Select label="Team you work with" value={workArea} onChange={(e) => setWorkArea(e.target.value)} error={submitted ? workAreaError : undefined} hint="Shows you the issues for your team first." required>
            <option value="">Choose…</option>
            {DEPARTMENTS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </Select>
        )}

        {error && <Notice tone="danger">{error}</Notice>}

        <Button type="submit" isLoading={isLoading} className="w-full" size="lg">
          Create account
        </Button>
      </form>
    </AuthLayout>
  );
}
