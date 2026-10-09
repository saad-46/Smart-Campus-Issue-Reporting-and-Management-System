"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, BellRing, ChartLine, GraduationCap, HardHat, Map as MapIcon, Play, ShieldCheck, Sparkles } from "lucide-react";
import Card from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/PageHeader";
import Button, { buttonClasses } from "@/components/ui/Button";
import { KpiCard, KpiGrid } from "@/components/ui/Kpi";
import { LIFECYCLE } from "@/components/viewer/lifecycle";
import { ViewerGate, WorkflowSteps } from "@/components/viewer/parts";
import { VIEWER_PERSPECTIVES } from "@/lib/viewer/nav";
import { formatHours } from "@/components/admin/Kpi";
import { Eye, ListChecks, Clock, CheckCircle2, Timer } from "lucide-react";

const ICONS = { student: GraduationCap, worker: HardHat, admin: ShieldCheck } as const;

const HIGHLIGHTS = [
  { icon: Sparkles, title: "Suggestions and duplicate detection", text: "A category, priority and team are suggested as you type, and similar open reports are flagged." },
  { icon: BellRing, title: "Deadlines and notifications", text: "Every priority has a target. Deadlines turn amber and red, and people are told what changed." },
  { icon: ChartLine, title: "Analytics", text: "Trends, categories, department results and when problems are reported." },
  { icon: MapIcon, title: "Campus map", text: "Issue density, incidents, maintenance risk and deadline hotspots by building." },
];

export default function ViewerHomePage() {
  return (
    <ViewerGate>
      {({ stats, openTour }) => (
        <>
          <Card className="depth-2 relative mb-8 overflow-hidden rounded-2xl p-6 sm:p-8">
            <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-20 h-80 w-80 rounded-full bg-[radial-gradient(closest-side,var(--glow),transparent)]" />
            <div className="relative max-w-2xl">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-subtle-border bg-brand-subtle px-2.5 py-0.5 text-xs font-semibold text-brand-fg">
                <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                Interactive demo · no sign-in
              </span>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-fg sm:text-4xl">
                The whole platform, <span className="text-gradient">on a sample campus.</span>
              </h1>
              <p className="mt-3 text-fg-muted">
                Report a problem as a student, resolve it as a worker, then watch it appear in the administrator&apos;s analytics. Everything works, nothing is saved,
                and no real campus data is involved.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button size="lg" onClick={() => openTour(true)} icon={<Play className="h-4 w-4" aria-hidden="true" />}>
                  Take the guided tour
                </Button>
                <Link href="/viewer/admin" className={buttonClasses("secondary", "lg")}>
                  Explore as Admin
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            </div>
          </Card>

          <KpiGrid className="mb-8 xl:grid-cols-4">
            <KpiCard label="Issues in the demo" value={stats.total} icon={<ListChecks />} hint="Last 30 days" spark={stats.spark.reported} />
            <KpiCard label="Open now" value={stats.openCount} icon={<Clock />} tone="warning" hint={`${stats.openHighPriority} high priority`} spark={stats.spark.backlog} />
            <KpiCard label="Resolved" value={stats.status.Resolved} icon={<CheckCircle2 />} tone="success" hint={`${stats.resolution.count} with a recorded time`} spark={stats.spark.resolved} />
            <KpiCard label="Average resolution" value={formatHours(stats.resolution.averageHours) ?? "—"} icon={<Timer />} tone="brand" hint="From report to resolved" />
          </KpiGrid>

          <SectionHeader title="Choose a perspective" description="You can switch at any time from the bar at the top." />
          <div className="mb-8 grid gap-4 md:grid-cols-3">
            {VIEWER_PERSPECTIVES.map((p) => {
              const Icon = ICONS[p.role];
              return (
                <Link key={p.role} href={p.href} className="glass lift group flex flex-col rounded-xl p-5 focus-visible:outline-2 focus-visible:outline-offset-2">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-brand-subtle-border bg-brand-subtle text-brand-fg">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h2 className="mt-4 text-base font-semibold text-fg">{p.label}</h2>
                  <p className="mt-1 flex-1 text-sm text-fg-muted">{p.summary}</p>
                  <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand-fg">
                    Open the {p.label.toLowerCase()} view
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                  </span>
                </Link>
              );
            })}
          </div>

          <SectionHeader title="From report to resolution" description="The same seven steps the real product follows." />
          <div className="mb-8">
            <WorkflowSteps label="Issue lifecycle" steps={LIFECYCLE.map((s) => ({ title: s.title, text: s.short }))} />
          </div>

          <SectionHeader title="What to look at" />
          <div className="grid gap-4 sm:grid-cols-2">
            {HIGHLIGHTS.map((h) => (
              <Card key={h.title} className="flex gap-3 p-4">
                <h.icon className="mt-0.5 h-5 w-5 shrink-0 text-brand-fg" aria-hidden="true" />
                <div>
                  <h3 className="text-sm font-semibold text-fg">{h.title}</h3>
                  <p className="mt-0.5 text-[13px] text-fg-muted">{h.text}</p>
                </div>
              </Card>
            ))}
          </div>

          <Card className="mt-8 flex flex-col gap-2 p-4 text-sm text-fg-muted sm:flex-row sm:items-center sm:justify-between">
            <span>Ready to use it for real?</span>
            <Link href="/login" prefetch={false} className="font-medium text-brand-fg hover:underline">
              Sign in
            </Link>
          </Card>
        </>
      )}
    </ViewerGate>
  );
}
