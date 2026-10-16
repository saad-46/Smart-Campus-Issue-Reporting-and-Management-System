"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, BellRing, ChartLine, Map as MapIcon, Play, Sparkles } from "lucide-react";
import Card from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/PageHeader";
import Button, { buttonClasses } from "@/components/ui/Button";
import { KpiCard, KpiGrid } from "@/components/ui/Kpi";
import { LIFECYCLE } from "@/components/viewer/lifecycle";
import { ViewerGate, WorkflowSteps } from "@/components/viewer/parts";
import { PerspectiveSwitcher } from "@/components/viewer/ViewerShell";
import { VIEWER_PERSPECTIVES, homeForRole } from "@/lib/viewer/nav";
import { formatHours } from "@/components/admin/Kpi";
import { Eye, ListChecks, Clock, CheckCircle2, Timer } from "lucide-react";

const HIGHLIGHTS = [
  { icon: Sparkles, title: "Suggestions and duplicate detection", text: "A category, priority and team are suggested as you type, and similar open reports are flagged." },
  { icon: BellRing, title: "Deadlines and notifications", text: "Every priority has a target. Deadlines turn amber and red, and people are told what changed." },
  { icon: ChartLine, title: "Analytics", text: "Trends, categories, department results and when problems are reported." },
  { icon: MapIcon, title: "Campus map", text: "Issue density, incidents, maintenance risk and deadline hotspots by building." },
];

export default function ViewerHomePage() {
  return (
    <ViewerGate>
      {({ stats, openTour, role }) => {
        const current = VIEWER_PERSPECTIVES.find((p) => p.role === role)!;
        return (
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
              <div className="mt-6 rounded-xl border border-glass-border bg-surface-2/50 p-3 sm:p-4">
                <p id="explore-as" className="text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-subtle">
                  Explore as
                </p>
                <div className="mt-2">
                  <PerspectiveSwitcher variant="hero" navigate={false} />
                </div>
                <p className="mt-2.5 text-sm text-fg-muted" aria-live="polite">
                  <span className="font-medium text-fg">{current.label}:</span> {current.summary}
                </p>
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <Button size="lg" onClick={() => openTour(true)} icon={<Play className="h-4 w-4" aria-hidden="true" />}>
                  Take the guided tour
                </Button>
                <Link href={homeForRole(role)} className={buttonClasses("secondary", "lg")}>
                  Open the {current.label.toLowerCase()} workspace
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
        </>
        );
      }}
    </ViewerGate>
  );
}
