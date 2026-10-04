"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BarChart3,
  BellRing,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Eye,
  Lock,
  MapPin,
  QrCode,
  ShieldCheck,
  Tags,
  Users,
} from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { useAuthContext } from "@/components/AuthProvider";
import Logo from "@/components/shell/Logo";
import { buttonClasses } from "@/components/ui/Button";
import Badge, { PriorityBadge, StatusBadge } from "@/components/ui/Badge";
import { dashboardPathForRole } from "@/lib/roles";

const STEPS = [
  { icon: QrCode, title: "Report", body: "Scan the QR code at the location or describe the problem. A category and priority are suggested — you confirm." },
  { icon: Users, title: "Assign", body: "Administrators see similar reports grouped together and assign an approved worker, with a ranked suggestion." },
  { icon: ClipboardCheck, title: "Resolve", body: "Workers update progress; every step is recorded on the issue timeline against a clear deadline." },
  { icon: BarChart3, title: "Learn", body: "Reporters rate the fix. Trends, hotspots and recurring faults surface from the recorded history." },
];

const CAPABILITIES = [
  {
    icon: Tags,
    title: "Campus intelligence",
    points: ["Suggested category and priority, with the reason shown", "Similar open reports flagged before submitting", "Recurring faults highlighted per building"],
  },
  {
    icon: BellRing,
    title: "Real-time operations",
    points: ["Live status for reporters, workers and administrators", "Deadlines per priority with early warnings", "In-app notifications for every status change"],
  },
  {
    icon: CheckCircle2,
    title: "Transparent resolution",
    points: ["A timeline of what happened, and when", "Expense claims reviewed and paid exactly once", "Feedback from the people who reported the issue"],
  },
];

const SECURITY = [
  { icon: ShieldCheck, text: "Every permission is enforced by the database rules, not only the interface." },
  { icon: Users, text: "Administrator and worker access is granted by people, never self-assigned." },
  { icon: Lock, text: "Receipts are visible only to the worker who filed them and administrators." },
  { icon: Clock, text: "Rate limits and validation protect the system from spam and malformed data." },
];

/** Static illustration of the product (sample content, not live data). */
function ProductPreview() {
  return (
    <figure className="relative">
      <div aria-hidden="true" className="overflow-hidden rounded-lg border border-border bg-surface shadow-md">
        <div className="flex items-center gap-1.5 border-b border-border bg-surface-2 px-3 py-2">
          <span className="h-2.5 w-2.5 rounded-full bg-border-strong" />
          <span className="h-2.5 w-2.5 rounded-full bg-border-strong" />
          <span className="h-2.5 w-2.5 rounded-full bg-border-strong" />
        </div>
        <div className="grid gap-0 sm:grid-cols-[1fr_11rem]">
          <div className="p-5">
            <div className="flex flex-wrap items-center gap-1.5">
              <StatusBadge status="In Progress" />
              <PriorityBadge priority="High" />
              <Badge>Electrical</Badge>
            </div>
            <p className="mt-3 text-base font-semibold text-fg">Power sockets not working in Lab 204</p>
            <p className="mt-1 flex items-center gap-1 text-[13px] text-fg-subtle">
              <MapPin className="h-3.5 w-3.5" /> Laboratory Complex · Floor 2 · Room 204
            </p>
            <div className="mt-5 space-y-3 border-l border-border pl-4">
              {[
                ["Reported", "10:32"],
                ["Suggested: Electrical · High", "10:32"],
                ["Assigned to a worker", "10:40"],
                ["Work started", "11:15"],
              ].map(([label, time], i) => (
                <div key={label} className="relative">
                  <span className={`absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border-2 ${i === 3 ? "border-brand bg-surface" : "border-brand bg-brand"}`} />
                  <p className="text-[13px] text-fg">{label}</p>
                  <p className="text-xs text-fg-subtle">Today · {time}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="border-t border-border bg-surface-2/50 p-5 sm:border-l sm:border-t-0">
            <p className="text-xs text-fg-subtle">Deadline</p>
            <p className="mt-0.5 text-sm font-medium text-fg">2h 14m left</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border">
              <div className="h-full w-[62%] rounded-full bg-brand" />
            </div>
            <p className="mt-5 text-xs text-fg-subtle">Similar reports</p>
            <p className="mt-0.5 text-sm text-fg">2 linked</p>
            <p className="mt-5 text-xs text-fg-subtle">Suggested team</p>
            <p className="mt-0.5 text-sm text-fg">Electrical Maintenance</p>
          </div>
        </div>
      </div>
      <figcaption className="mt-3 text-center text-xs text-fg-subtle">Illustration with sample content</figcaption>
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
    <div className="min-h-dvh bg-canvas">
      <header className="sticky top-0 z-40 border-b border-border bg-surface">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 sm:px-6">
          <Logo />
          <nav aria-label="Sections" className="hidden items-center gap-1 md:flex">
            {[
              ["How it works", "#how-it-works"],
              ["Capabilities", "#capabilities"],
              ["Security", "#security"],
            ].map(([label, href]) => (
              <a key={href} href={href} className="rounded-md px-2.5 py-1.5 text-sm text-fg-muted transition-colors hover:bg-surface-hover hover:text-fg">
                {label}
              </a>
            ))}
            <Link href="/viewer" className="rounded-md px-2.5 py-1.5 text-sm text-fg-muted transition-colors hover:bg-surface-hover hover:text-fg">
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
        <section className="border-b border-border bg-surface">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:py-24">
            <div>
              <p className="text-sm font-medium text-brand-fg">Campus maintenance and facilities</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-fg sm:text-5xl sm:leading-[1.08]">
                Smart campus operations, without the operational chaos.
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-fg-muted">
                UniFix gives students, maintenance staff and administrators one place to report, assign, resolve and learn from every
                campus issue — with a clear record of who did what, and when.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Link href="/login" className={buttonClasses("primary", "lg")}>
                  Sign in
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link href="/register" className={buttonClasses("secondary", "lg")}>
                  Create account
                </Link>
                <Link href="/viewer" className={buttonClasses("tertiary", "lg")}>
                  <Eye className="h-4 w-4" aria-hidden="true" />
                  Explore as Viewer
                </Link>
              </div>
              <p className="mt-4 text-[13px] text-fg-subtle">
                Explore the campus operations experience without signing in — Viewer Mode is read-only sample data.
              </p>
            </div>
            <ProductPreview />
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="scroll-mt-16 border-b border-border">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
            <h2 className="text-2xl font-semibold tracking-tight text-fg">How it works</h2>
            <p className="mt-2 max-w-2xl text-fg-muted">One flow from the moment something breaks to the moment it&apos;s confirmed fixed.</p>
            <ol className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
              {STEPS.map((step, i) => (
                <li key={step.title} className="relative">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-surface text-brand-fg">
                      <step.icon className="h-[18px] w-[18px]" aria-hidden="true" />
                    </span>
                    <span className="tabular text-xs font-medium text-fg-subtle">Step {i + 1}</span>
                    {i < STEPS.length - 1 && <span aria-hidden="true" className="hidden h-px flex-1 bg-border lg:block" />}
                  </div>
                  <h3 className="mt-4 font-semibold text-fg">{step.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Capabilities */}
        <section id="capabilities" className="scroll-mt-16 border-b border-border bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
            <h2 className="text-2xl font-semibold tracking-tight text-fg">Built for the people who keep a campus running</h2>
            <div className="mt-10 grid gap-10 md:grid-cols-3">
              {CAPABILITIES.map((c) => (
                <div key={c.title}>
                  <c.icon className="h-5 w-5 text-brand-fg" aria-hidden="true" />
                  <h3 className="mt-3 font-semibold text-fg">{c.title}</h3>
                  <ul className="mt-3 space-y-2">
                    {c.points.map((p) => (
                      <li key={p} className="flex gap-2 text-sm text-fg-muted">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-fg-subtle" aria-hidden="true" />
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="mt-14 grid items-center gap-8 rounded-lg border border-border bg-canvas p-6 sm:p-8 lg:grid-cols-[1fr_1.2fr]">
              <div>
                <h3 className="text-lg font-semibold text-fg">See where problems cluster</h3>
                <p className="mt-2 text-sm leading-relaxed text-fg-muted">
                  A campus map shows open issues by building, and a maintenance indicator points to places where the same fault keeps
                  coming back — so repairs can be planned instead of repeated.
                </p>
              </div>
              <figure>
                <div aria-hidden="true" className="grid grid-cols-5 gap-1.5">
                  {[1, 2, 0, 1, 3, 2, 4, 1, 0, 2, 0, 1, 5, 2, 1].map((level, i) => (
                    <div key={i} className="h-10 rounded-sm border border-border" style={{ background: `var(--heat-${level})` }} />
                  ))}
                </div>
                <figcaption className="mt-2 text-xs text-fg-subtle">Illustration of the campus heatmap</figcaption>
              </figure>
            </div>
          </div>
        </section>

        {/* Security */}
        <section id="security" className="scroll-mt-16 border-b border-border">
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
        <section className="bg-surface">
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-14 sm:px-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-fg">Seen something that needs fixing?</h2>
              <p className="mt-1 text-fg-muted">It takes under a minute to report, and you can follow it until it&apos;s resolved.</p>
            </div>
            <div className="flex gap-3">
              <Link href="/login" className={buttonClasses("secondary", "lg")}>
                Sign in
              </Link>
              <Link href="/register" className={buttonClasses("primary", "lg")}>
                Create account
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-fg-subtle sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <Logo />
          <p>Built for the DEV ARENA Hackathon by GDG, UCE-OU.</p>
        </div>
      </footer>
    </div>
  );
}
