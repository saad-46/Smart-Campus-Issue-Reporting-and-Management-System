"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Eye, GraduationCap, HardHat, Play, ShieldCheck } from "lucide-react";
import { useAuthContext } from "@/components/AuthProvider";
import Logo from "@/components/shell/Logo";
import { buttonClasses } from "@/components/ui/Button";
import LandingNav from "@/components/landing/LandingNav";
import ProductPreview from "@/components/landing/ProductPreview";
import { ActivityPanel, AnalyticsPanel, AssignPanel, IssuePanel, MapPanel } from "@/components/landing/Showcases";
import { LIFECYCLE } from "@/components/viewer/lifecycle";
import { dashboardPathForRole } from "@/lib/roles";
import { cn } from "@/lib/cn";

const PROBLEMS = [
  ["Report", "A student describes the problem or scans the QR code at the location. A category, priority and team are suggested, and similar open reports are shown first."],
  ["Resolve", "An administrator assigns a worker from ranked suggestions. Every status change lands on one timeline, against a deadline."],
  ["Understand", "Trends, hotspots, workload and satisfaction come from the same records, so decisions don't depend on memory or spreadsheets."],
] as const;

const FEATURES = [
  {
    id: "issues",
    eyebrow: "Issue management",
    title: "Every report has an owner, a deadline and a history.",
    text: "Reports go into one queue with filters and search. Each priority has a target time, and the deadline state is calculated from timestamps, so it can't drift. Reports of the same fault are linked into a single incident rather than fixed five times.",
    points: ["Deadline per priority, with early warnings", "Duplicate suggestions before a report is submitted", "A timeline of every recorded step"],
    visual: <IssuePanel />,
  },
  {
    id: "workers",
    eyebrow: "Worker coordination",
    title: "Assign the right person, and settle the cost once.",
    text: "Suggestions rank workers by experience in the category, current workload and ratings, and show the reason. Workers see their tasks by urgency. Expense claims carry an amount, what it was for and a receipt, and an administrator reviews each one.",
    points: ["Ranked suggestions with the reason shown", "Worker access approved by an administrator", "Claims reviewed and paid exactly once"],
    visual: <AssignPanel />,
  },
  {
    id: "analytics",
    eyebrow: "Operational analytics",
    title: "See what is happening across the campus.",
    text: "Volume, resolution time, deadline performance and department results update from the same data as the issue queue. Filter by range and category, and export the figures as CSV or JSON without reporter identities.",
    points: ["Trends, categories and priorities", "Deadline compliance by department", "When problems get reported"],
    visual: <AnalyticsPanel />,
  },
  {
    id: "map",
    eyebrow: "Campus map and QR reporting",
    title: "Know where problems cluster.",
    text: "A schematic campus map shades each building by open issues, linked incidents, maintenance risk or overdue work. Every location can have a printable QR code that opens the report form with the place filled in.",
    points: ["Four map layers and a building detail panel", "Recurring-fault indicator per place", "QR codes per location"],
    visual: <MapPanel />,
  },
  {
    id: "activity",
    eyebrow: "Notifications and feedback",
    title: "Keep everyone informed without chasing.",
    text: "Reporters are told when work starts and when it is resolved, workers when a task arrives or a claim is decided, and administrators when something needs review. The reporter then rates the fix once, which feeds worker suggestions.",
    points: ["In-app notifications for status changes", "One rating per resolved issue", "Unread markers and mark all read"],
    visual: <ActivityPanel />,
  },
] as const;

const ROLES = [
  { href: "/viewer/student", icon: GraduationCap, name: "Student", text: "Report, follow and rate" },
  { href: "/viewer/worker", icon: HardHat, name: "Worker", text: "Tasks, resolution and claims" },
  { href: "/viewer/admin", icon: ShieldCheck, name: "Administrator", text: "Assignment, deadlines and analytics" },
] as const;

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-fg">{children}</p>;
}

export default function LandingPage() {
  const { isAuthenticated, userProfile, loading, activeRole } = useAuthContext();
  const router = useRouter();

  useEffect(() => {
    if (!loading && isAuthenticated && userProfile) router.replace(dashboardPathForRole(activeRole));
  }, [isAuthenticated, userProfile, loading, activeRole, router]);

  return (
    <div className="min-h-dvh">
      <a href="#main" className="sr-only z-[100] rounded-md bg-surface px-3 py-2 text-sm font-medium text-fg shadow-md focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
        Skip to content
      </a>
      <LandingNav />

      <main id="main" tabIndex={-1} className="outline-none">
        {/* Hero */}
        <section className="relative overflow-x-clip">
          <div className="mx-auto grid max-w-6xl items-center gap-14 px-4 pb-20 pt-12 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.12fr)] lg:gap-10 lg:pb-28 lg:pt-20">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-brand-subtle-border bg-brand-subtle px-3 py-1 text-xs font-medium text-brand-fg">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-fg" aria-hidden="true" />
                Campus issue reporting and operations
              </p>
              <h1 className="mt-5 text-[2.5rem] font-semibold leading-[1.06] tracking-[-0.03em] text-fg sm:text-5xl lg:text-[3.4rem]">
                <span className="block">Every campus issue.</span>
                <span className="text-gradient block">One connected system.</span>
              </h1>
              <p className="mt-5 max-w-xl text-[1.0625rem] leading-relaxed text-fg-muted sm:text-lg">
                UniFix connects reporting, assignment, resolution and analytics for students, maintenance teams and administrators, so every problem has an owner, a
                deadline and a record.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link href="/viewer" className={buttonClasses("primary", "lg", "glow-brand")}>
                  <Play className="h-4 w-4" aria-hidden="true" />
                  Explore the Platform
                </Link>
                <Link href="/login" className={buttonClasses("secondary", "lg")}>
                  Sign in
                </Link>
              </div>
              <p className="mt-4 max-w-md text-[13px] leading-relaxed text-fg-subtle">
                The live demo needs no account. It runs on sample data, and nothing you do is saved. New here?{" "}
                <Link href="/register" className="font-medium text-brand-fg underline-offset-2 hover:underline">
                  Create an account
                </Link>
                .
              </p>
            </div>
            <ProductPreview />
          </div>
        </section>

        {/* Value */}
        <section id="product" className="scroll-mt-20 border-y border-glass-border bg-surface/40">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_1.35fr] lg:gap-16 lg:py-24">
            <div className="lg:sticky lg:top-28 lg:self-start">
              <Eyebrow>Why it exists</Eyebrow>
              <h2 className="mt-3 text-3xl font-semibold leading-tight tracking-tight text-fg sm:text-4xl">Problems on campus shouldn&apos;t depend on who you happened to tell.</h2>
              <p className="mt-4 max-w-md text-fg-muted">
                A broken projector reported by phone, a leak mentioned in passing, a claim on paper: none of it connects. UniFix gives each issue one record from the first
                report to the final rating.
              </p>
            </div>
            <ol className="divide-y divide-glass-border border-y border-glass-border">
              {PROBLEMS.map(([title, text], i) => (
                <li key={title} className="grid grid-cols-[2.5rem_1fr] gap-4 py-6 sm:grid-cols-[3.5rem_1fr] sm:py-8">
                  <span className="tabular font-mono text-sm text-brand-fg">0{i + 1}</span>
                  <div>
                    <h3 className="text-lg font-semibold text-fg">{title}</h3>
                    <p className="mt-1.5 max-w-xl leading-relaxed text-fg-muted">{text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Workflow */}
        <section id="workflow" className="scroll-mt-20">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
            <div className="max-w-2xl">
              <Eyebrow>Workflow</Eyebrow>
              <h2 className="mt-3 text-3xl font-semibold leading-tight tracking-tight text-fg sm:text-4xl">From a report to a rated fix, in seven steps.</h2>
              <p className="mt-3 text-fg-muted">This is the lifecycle the product follows today. Every step is recorded on the issue.</p>
            </div>
            <ol className="relative mt-12 grid gap-0 lg:grid-cols-7 lg:gap-4">
              <span aria-hidden="true" className="absolute bottom-4 left-[1.1rem] top-4 w-px bg-gradient-to-b from-brand via-accent to-transparent lg:bottom-auto lg:left-4 lg:right-4 lg:top-[1.1rem] lg:h-px lg:w-auto lg:bg-gradient-to-r" />
              {LIFECYCLE.map((step, i) => (
                <li key={step.title} className="relative flex gap-4 pb-8 last:pb-0 lg:block lg:pb-0">
                  <span className="tabular relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-brand-subtle-border bg-surface text-sm font-semibold text-brand-fg shadow-sm ring-4 ring-canvas">
                    {i + 1}
                  </span>
                  <div className="lg:mt-4">
                    <h3 className="font-semibold text-fg">{step.title}</h3>
                    <p className="mt-0.5 text-[13px] leading-relaxed text-fg-muted">{step.short}</p>
                    <p className="mt-1 text-xs text-fg-subtle">{step.who}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Capabilities */}
        <section id="capabilities" className="scroll-mt-20 border-t border-glass-border bg-surface/40">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
            <div className="max-w-2xl">
              <Eyebrow>Capabilities</Eyebrow>
              <h2 className="mt-3 text-3xl font-semibold leading-tight tracking-tight text-fg sm:text-4xl">Built around how campus teams actually work.</h2>
            </div>
            <div className="mt-14 space-y-20 lg:space-y-28">
              {FEATURES.map((f, i) => (
                <article key={f.id} id={f.id} className="grid scroll-mt-24 items-center gap-8 lg:grid-cols-2 lg:gap-16">
                  <div className={cn(i % 2 === 1 && "lg:order-2")}>
                    <Eyebrow>{f.eyebrow}</Eyebrow>
                    <h3 className="mt-3 text-2xl font-semibold leading-snug tracking-tight text-fg sm:text-3xl">{f.title}</h3>
                    <p className="mt-3 leading-relaxed text-fg-muted">{f.text}</p>
                    <ul className="mt-5 space-y-2">
                      {f.points.map((p) => (
                        <li key={p} className="flex gap-2.5 text-sm text-fg">
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                          {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className={cn("min-w-0", i % 2 === 1 && "lg:order-1")}>{f.visual}</div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Live demo */}
        <section id="demo" className="scroll-mt-20">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
            <div className="glass depth-2 grid gap-10 rounded-3xl p-6 sm:p-10 lg:grid-cols-[1fr_1.1fr] lg:items-center lg:gap-14">
              <div>
                <Eyebrow>Live demo</Eyebrow>
                <h2 className="mt-3 text-3xl font-semibold leading-tight tracking-tight text-fg sm:text-4xl">See the entire platform in action.</h2>
                <p className="mt-4 leading-relaxed text-fg-muted">
                  Explore the student, worker and administrator views on a sample campus, with a 24-step guided tour. Submit a report, assign a worker, resolve it and watch the
                  analytics change. No sign-in, no real data, and nothing is saved.
                </p>
                <div className="mt-7 flex flex-wrap items-center gap-3">
                  <Link href="/viewer" className={buttonClasses("primary", "lg")}>
                    <Eye className="h-4 w-4" aria-hidden="true" />
                    Explore the Platform
                  </Link>
                  <span className="text-[13px] text-fg-subtle">Opens the demo, not the sign-in page.</span>
                </div>
              </div>
              <ul className="grid gap-3" aria-label="Open the demo as">
                {ROLES.map(({ href, icon: Icon, name, text }) => (
                  <li key={href}>
                    <Link href={href} className="lift group flex items-center gap-4 rounded-2xl border border-glass-border bg-surface/60 p-4">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-brand-subtle-border bg-brand-subtle text-brand-fg">
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold text-fg">{name}</span>
                        <span className="block text-sm text-fg-muted">{text}</span>
                      </span>
                      <ArrowRight className="h-4 w-4 shrink-0 text-fg-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-brand-fg" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Security and honesty */}
        <section id="security" className="scroll-mt-20 border-t border-glass-border">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[1fr_1.4fr] lg:py-20">
            <div>
              <Eyebrow>Access and data</Eyebrow>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-fg sm:text-3xl">Permissions live in the database, not just the interface.</h2>
            </div>
            <ul className="grid gap-x-8 gap-y-4 text-sm leading-relaxed text-fg-muted sm:grid-cols-2">
              <li>Administrator access is granted separately and can&apos;t be self-assigned; worker accounts are approved by an administrator.</li>
              <li>Receipts are visible only to the worker who filed them and to administrators.</li>
              <li>Each payment settles exactly one claim, and a settled claim can&apos;t be rewritten.</li>
              <li>The public demo uses a separate generated dataset and never loads the sign-in system or reads campus records.</li>
            </ul>
          </div>
        </section>

        {/* Final CTA */}
        <section className="border-t border-glass-border bg-surface/40">
          <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-16 sm:px-6 md:flex-row md:items-center md:justify-between lg:py-20">
            <h2 className="max-w-xl text-2xl font-semibold leading-snug tracking-tight text-fg sm:text-3xl">Explore a clearer way to manage campus operations.</h2>
            <div className="flex flex-wrap items-center gap-3">
              <Link href="/viewer" className={buttonClasses("primary", "lg")}>
                Explore the Platform
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link href="/login" className={buttonClasses("secondary", "lg")}>
                Sign in
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-glass-border">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <div className="grid gap-10 sm:grid-cols-[1.4fr_1fr_1fr_1fr]">
            <div>
              <Logo href="/" />
              <p className="mt-3 max-w-xs text-sm text-fg-muted">Campus issue reporting, assignment and analytics in one connected system.</p>
            </div>
            <nav aria-label="Product">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-fg-subtle">Product</p>
              <ul className="mt-3 space-y-2 text-sm">
                {[
                  ["Workflow", "#workflow"],
                  ["Capabilities", "#capabilities"],
                  ["Access and data", "#security"],
                ].map(([label, href]) => (
                  <li key={href}>
                    <a href={href} className="text-fg-muted hover:text-fg">
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
            <nav aria-label="Explore">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-fg-subtle">Explore</p>
              <ul className="mt-3 space-y-2 text-sm">
                <li>
                  <Link href="/viewer" className="text-fg-muted hover:text-fg">
                    Live demo
                  </Link>
                </li>
                <li>
                  <Link href="/viewer/how-it-works" className="text-fg-muted hover:text-fg">
                    How it works
                  </Link>
                </li>
              </ul>
            </nav>
            <nav aria-label="Account">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-fg-subtle">Account</p>
              <ul className="mt-3 space-y-2 text-sm">
                <li>
                  <Link href="/login" className="text-fg-muted hover:text-fg">
                    Sign in
                  </Link>
                </li>
                <li>
                  <Link href="/register" className="text-fg-muted hover:text-fg">
                    Create account
                  </Link>
                </li>
              </ul>
            </nav>
          </div>
          <div className="mt-10 flex flex-col gap-2 border-t border-glass-border pt-6 text-sm text-fg-subtle sm:flex-row sm:items-center sm:justify-between">
            <p>© 2026 UniFix</p>
            <p>Built with love by SoloDev</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
