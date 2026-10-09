"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BarChart3,
  BellRing,
  ClipboardCheck,
  Clock,
  Eye,
  GraduationCap,
  HardHat,
  Lock,
  Map as MapIcon,
  QrCode,
  ShieldCheck,
  Sparkles,
  Users,
  Wrench,
} from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { useAuthContext } from "@/components/AuthProvider";
import Logo from "@/components/shell/Logo";
import { buttonClasses } from "@/components/ui/Button";
import Badge, { PriorityBadge, StatusBadge } from "@/components/ui/Badge";
import { dashboardPathForRole } from "@/lib/roles";

const STEPS = [
  { icon: QrCode, title: "Report", body: "Scan the QR code at the location or describe the problem. A category and priority are suggested; you confirm." },
  { icon: Users, title: "Assign", body: "Administrators see similar reports grouped together and assign an approved worker, with a ranked suggestion." },
  { icon: ClipboardCheck, title: "Resolve", body: "Workers update progress. Every step is recorded on the issue timeline against a clear deadline." },
  { icon: BarChart3, title: "Learn", body: "Reporters rate the fix. Trends, hotspots and recurring faults surface from the recorded history." },
];

const CAPABILITIES = [
  { icon: ClipboardCheck, title: "Issue management", text: "One queue for every report, with filters, deadlines, a timeline and an audit trail on each issue." },
  { icon: Sparkles, title: "Operational intelligence", text: "Suggested category and priority with the reason shown, duplicate detection and incident linking." },
  { icon: BarChart3, title: "Analytics", text: "Volume, deadline performance, department results and when problems get reported." },
  { icon: MapIcon, title: "Campus map", text: "Issue density, incidents, maintenance risk and deadline hotspots by building." },
  { icon: HardHat, title: "Worker workflow", text: "Assigned tasks by urgency, expense claims with receipts, paid exactly once." },
  { icon: BellRing, title: "Notifications", text: "People are told when work is assigned, started or resolved, and when a claim is decided." },
];

const ROLES = [
  { icon: GraduationCap, title: "Students", text: "Report in under a minute, follow progress, rate the fix." },
  { icon: Wrench, title: "Workers", text: "A prioritised queue, one-tap status updates, claims." },
  { icon: ShieldCheck, title: "Administrators", text: "Assignment, deadlines, finance and campus-wide analytics." },
];

const SECURITY = [
  { icon: ShieldCheck, text: "Every permission is enforced by the database rules, not only the interface." },
  { icon: Users, text: "Administrator and worker access is granted by people, never self-assigned." },
  { icon: Lock, text: "Receipts are visible only to the worker who filed them and administrators." },
  { icon: Clock, text: "Rate limits and validation protect the system from spam and malformed data." },
];

/** Static illustration of the product (sample content, not live data). Tilted slightly in 3D on wide screens. */
function ProductPreview() {
  const bars = [38, 52, 44, 66, 58, 74, 62, 80, 70, 88, 76, 94];
  return (
    <figure className="stage-3d relative">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 lg:-inset-6 bg-[radial-gradient(closest-side,var(--glow),transparent)]" />
      <div aria-hidden="true" className="tilt-3d glass-blur depth-2 overflow-hidden rounded-2xl">
        <div className="flex items-center gap-1.5 border-b border-glass-border px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-danger/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-warning/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-success/70" />
          <span className="ml-3 h-4 w-40 rounded-full bg-surface-2" />
        </div>
        <div className="grid grid-cols-[3.25rem_1fr] sm:grid-cols-[9rem_1fr]">
          <div className="space-y-1.5 border-r border-glass-border p-2.5 sm:p-3">
            {["Overview", "Issues", "Analytics", "Campus map", "Workers"].map((l, i) => (
              <div key={l} className={`flex h-7 items-center gap-2 rounded-md px-2 text-[11px] ${i === 0 ? "bg-brand-subtle font-medium text-brand-fg" : "text-fg-subtle"}`}>
                <span className="h-3 w-3 shrink-0 rounded-sm bg-current opacity-60" />
                <span className="hidden sm:inline">{l}</span>
              </div>
            ))}
          </div>
          <div className="min-w-0 p-3 sm:p-4">
            <div className="grid grid-cols-3 gap-2">
              {[
                ["Open", "24", "text-warning"],
                ["Resolved", "103", "text-success"],
                ["SLA", "91%", "text-brand-fg"],
              ].map(([label, value, tone]) => (
                <div key={label} className="rounded-lg border border-glass-border bg-surface/60 p-2.5">
                  <p className="text-[9px] font-semibold uppercase tracking-wider text-fg-subtle">{label}</p>
                  <p className={`mt-0.5 text-lg font-semibold ${tone}`}>{value}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 flex h-20 items-end gap-1 rounded-lg border border-glass-border bg-surface/50 p-2">
              {bars.map((h, i) => (
                <span key={i} className="flex-1 rounded-t bg-gradient-to-t from-brand/40 to-accent/80" style={{ height: `${h}%` }} />
              ))}
            </div>
            <div className="mt-3 space-y-2">
              {[
                ["Projector not turning on in Room 104", "In Progress", "High"],
                ["Water leaking in the washroom", "Open", "High"],
              ].map(([title, status, priority]) => (
                <div key={title} className="flex items-center justify-between gap-2 rounded-lg border border-glass-border bg-surface/60 px-2.5 py-2">
                  <span className="truncate text-[11px] font-medium text-fg">{title}</span>
                  <span className="hidden shrink-0 gap-1 sm:flex">
                    <StatusBadge status={status as "Open" | "In Progress"} />
                    <PriorityBadge priority={priority as "High"} />
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <figcaption className="mt-4 text-center text-xs text-fg-subtle">Illustration with sample content</figcaption>
    </figure>
  );
}

export default function LandingPage() {
  const { isAuthenticated, userProfile, loading, activeRole } = useAuthContext();
  const router = useRouter();

  useEffect(() => {
    if (!loading && isAuthenticated && userProfile) router.replace(dashboardPathForRole(activeRole));
  }, [isAuthenticated, userProfile, loading, activeRole, router]);

  return (
    <div className="min-h-dvh">
      <header className="glass-bar sticky top-0 z-40 border-b">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 sm:px-6">
          <Logo />
          <nav aria-label="Sections" className="hidden items-center gap-1 md:flex">
            {[
              ["How it works", "#how-it-works"],
              ["Capabilities", "#capabilities"],
              ["Security", "#security"],
            ].map(([label, href]) => (
              <a key={href} href={href} className="rounded-lg px-2.5 py-1.5 text-sm text-fg-muted transition-colors hover:bg-surface-hover hover:text-fg">
                {label}
              </a>
            ))}
            <Link href="/viewer" className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-brand-fg transition-colors hover:bg-surface-hover">
              Explore as Viewer
            </Link>
          </nav>
          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            <ThemeToggle />
            <Link href="/login" className={buttonClasses("ghost", "md", "max-sm:hidden")}>
              Sign in
            </Link>
            <Link href="/register" className={buttonClasses("primary")}>
              Create account
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="border-b border-glass-border">
          <div className="mx-auto grid max-w-6xl items-center gap-14 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:py-24">
            <div>
              <Badge tone="info" icon={<Sparkles aria-hidden="true" />}>
                Smart campus management
              </Badge>
              <h1 className="mt-4 text-4xl font-semibold tracking-tight text-fg sm:text-5xl sm:leading-[1.08]">
                Campus operations, <span className="text-gradient">under control.</span>
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-fg-muted">
                UniFix gives students, maintenance staff and administrators one place to report, assign, resolve and learn from every campus issue, with a clear record of
                who did what, and when.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Link href="/viewer" className={buttonClasses("primary", "lg", "glow-brand")}>
                  <Eye className="h-4 w-4" aria-hidden="true" />
                  Explore as Viewer
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link href="/login" className={buttonClasses("secondary", "lg")}>
                  Sign in
                </Link>
                <Link href="/register" className={buttonClasses("secondary", "lg")}>
                  Create account
                </Link>
              </div>
              <p className="mt-4 text-[13px] text-fg-subtle">
                The Viewer is the whole product on a sample campus: no account, nothing saved, no real data. Try it as a student, a worker or an administrator.
              </p>
            </div>
            <ProductPreview />
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="scroll-mt-16 border-b border-glass-border">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
            <h2 className="text-2xl font-semibold tracking-tight text-fg">How it works</h2>
            <p className="mt-2 max-w-2xl text-fg-muted">One flow from the moment something breaks to the moment it&apos;s confirmed fixed.</p>
            <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((step, i) => (
                <li key={step.title} className="glass lift rounded-xl p-5">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-brand-subtle-border bg-brand-subtle text-brand-fg">
                      <step.icon className="h-[18px] w-[18px]" aria-hidden="true" />
                    </span>
                    <span className="tabular text-xs font-medium text-fg-subtle">Step {i + 1}</span>
                  </div>
                  <h3 className="mt-4 font-semibold text-fg">{step.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Capabilities */}
        <section id="capabilities" className="scroll-mt-16 border-b border-glass-border">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
            <h2 className="text-2xl font-semibold tracking-tight text-fg">Built for the people who keep a campus running</h2>
            <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {CAPABILITIES.map((c) => (
                <li key={c.title} className="glass lift flex gap-3 rounded-xl p-5">
                  <c.icon className="mt-0.5 h-5 w-5 shrink-0 text-brand-fg" aria-hidden="true" />
                  <div>
                    <h3 className="font-semibold text-fg">{c.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-fg-muted">{c.text}</p>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {ROLES.map((r) => (
                <div key={r.title} className="rounded-xl border border-glass-border bg-surface/40 p-5">
                  <r.icon className="h-5 w-5 text-accent" aria-hidden="true" />
                  <h3 className="mt-3 font-semibold text-fg">{r.title}</h3>
                  <p className="mt-1 text-sm text-fg-muted">{r.text}</p>
                </div>
              ))}
            </div>

            <div className="glass depth-1 mt-10 grid items-center gap-8 rounded-2xl p-6 sm:p-8 lg:grid-cols-[1fr_1.2fr]">
              <div>
                <h3 className="text-lg font-semibold text-fg">See where problems cluster</h3>
                <p className="mt-2 text-sm leading-relaxed text-fg-muted">
                  A campus map shows open issues by building, and a maintenance indicator points to places where the same fault keeps coming back, so repairs can be planned
                  instead of repeated.
                </p>
              </div>
              <figure>
                <div aria-hidden="true" className="grid grid-cols-5 gap-1.5">
                  {[1, 2, 0, 1, 3, 2, 4, 1, 0, 2, 0, 1, 5, 2, 1].map((level, i) => (
                    <div key={i} className="h-10 rounded-md border border-glass-border" style={{ background: `var(--heat-${level})` }} />
                  ))}
                </div>
                <figcaption className="mt-2 text-xs text-fg-subtle">Illustration of the campus heatmap</figcaption>
              </figure>
            </div>
          </div>
        </section>

        {/* Security */}
        <section id="security" className="scroll-mt-16 border-b border-glass-border">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
            <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr]">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-fg">Secure by design</h2>
                <p className="mt-2 text-fg-muted">Access is decided by who you are, checked on every request.</p>
              </div>
              <ul className="grid gap-5 sm:grid-cols-2">
                {SECURITY.map((s) => (
                  <li key={s.text} className="flex gap-3">
                    <s.icon className="mt-0.5 h-5 w-5 shrink-0 text-fg-subtle" aria-hidden="true" />
                    <p className="text-sm leading-relaxed text-fg-muted">{s.text}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Final call to action */}
        <section>
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
            <div className="glass depth-2 flex flex-col items-start gap-6 rounded-2xl p-6 sm:p-8 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-fg">See it before you sign up</h2>
                <p className="mt-1 text-fg-muted">The Viewer needs no account. Or sign in to report something real.</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link href="/viewer" className={buttonClasses("primary", "lg")}>
                  <Eye className="h-4 w-4" aria-hidden="true" />
                  Explore as Viewer
                </Link>
                <Link href="/login" className={buttonClasses("secondary", "lg")}>
                  Sign in
                </Link>
                <Link href="/register" className={buttonClasses("secondary", "lg")}>
                  Create account
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-glass-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-fg-subtle sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <Logo />
          <p>Built for the DEV ARENA Hackathon by GDG, UCE-OU.</p>
        </div>
      </footer>
    </div>
  );
}
