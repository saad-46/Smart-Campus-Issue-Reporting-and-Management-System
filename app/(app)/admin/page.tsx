"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowRight, CheckCircle2, Layers, Lightbulb, RefreshCw, Siren, Wrench } from "lucide-react";
import { Feedback, Issue, IssueSummary } from "@/types";
import { useAuthContext } from "@/components/AuthProvider";
import {
  ADMIN_ISSUE_WINDOW,
  Actor,
  fetchIssueSummaries,
  getIssueCounts,
  linkIssueToIncident,
  setIssueEscalation,
  subscribeToRecentIssues,
} from "@/lib/firestore";
import { getRecentFeedback, summarizeSatisfaction } from "@/lib/feedback";
import { toIssueSummary } from "@/lib/models";
import { hotspots, resolutionStats, slaSummary, timeSeries } from "@/lib/intelligence/analytics";
import { confirmedClusters, IncidentCluster, suggestClusters } from "@/lib/intelligence/similarity";
import { maintenanceRisk, RISK_MIN_ISSUES, RISK_WINDOW_DAYS } from "@/lib/intelligence/maintenance";
import { generateInsights } from "@/lib/intelligence/insights";
import { describeSla } from "@/lib/intelligence/sla";
import { formatDate, greeting } from "@/lib/dates";
import { getFriendlyErrorMessage, logError } from "@/lib/errors";
import { useSlaConfig } from "@/hooks/useSlaConfig";
import { useNow } from "@/hooks/useNow";
import { useCampusLocations } from "@/hooks/useCampusLocations";
import { useChartTheme } from "@/hooks/useChartTheme";
import CampusMap from "@/components/admin/CampusMap";
import { formatHours } from "@/components/admin/Kpi";
import PageHeader from "@/components/ui/PageHeader";
import Card, { CardBody, CardHeader } from "@/components/ui/Card";
import Badge, { PriorityBadge, BadgeTone } from "@/components/ui/Badge";
import Button, { buttonClasses } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { StatStrip } from "@/components/ui/Data";
import { EmptyState, ErrorState, Notice, Skeleton, SkeletonLines, SkeletonRows } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";

const DAY = 86_400_000;
const RISK_TONE: Record<string, BadgeTone> = { High: "danger", Medium: "warning", Low: "neutral" };

export default function AdminOverviewPage() {
  const { userProfile } = useAuthContext();
  const toast = useToast();
  const chart = useChartTheme();
  const adminId = userProfile?.id ?? "";
  const admin = useMemo<Actor | null>(() => (adminId ? { id: adminId, role: "admin" } : null), [adminId]);
  const slaConfig = useSlaConfig();
  const now = useNow();
  const { buildingMap, nameMap } = useCampusLocations();

  // Live: the newest ADMIN_ISSUE_WINDOW issues (deadlines, incidents, hotspots).
  const [live, setLive] = useState<Issue[] | null>(null);
  const [liveError, setLiveError] = useState("");
  // One-off: 90 days of lightweight rows (trend, risk, insights).
  const [history, setHistory] = useState<{ issues: IssueSummary[]; capped: boolean } | null>(null);
  const [historyError, setHistoryError] = useState("");
  const [counts, setCounts] = useState<{ total: number; unresolved: number } | null>(null);
  const [feedback, setFeedback] = useState<Feedback[] | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [busy, setBusy] = useState("");
  const [pendingCluster, setPendingCluster] = useState<IncidentCluster | null>(null);

  useEffect(() => {
    setLiveError("");
    return subscribeToRecentIssues(
      setLive,
      (err) => {
        logError("subscribeToRecentIssues", err);
        setLiveError(getFriendlyErrorMessage(err, "Live issues couldn't be loaded."));
      },
      ADMIN_ISSUE_WINDOW
    );
  }, [refreshKey]);

  useEffect(() => {
    let cancelled = false;
    setHistoryError("");
    fetchIssueSummaries({ since: new Date(Date.now() - RISK_WINDOW_DAYS * DAY) })
      .then((result) => {
        if (!cancelled) setHistory(result);
      })
      .catch((err) => {
        logError("fetchIssueSummaries", err);
        if (!cancelled) setHistoryError(getFriendlyErrorMessage(err, "Historical data couldn't be loaded."));
      });
    getIssueCounts()
      .then((c) => {
        if (!cancelled) setCounts(c);
      })
      .catch((err) => logError("getIssueCounts", err));
    getRecentFeedback()
      .then((f) => {
        if (!cancelled) setFeedback(f);
      })
      .catch((err) => {
        logError("getRecentFeedback", err);
        if (!cancelled) setFeedback([]);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const liveSummaries = useMemo(() => (live ?? []).map(toIssueSummary), [live]);
  const openLive = useMemo(() => liveSummaries.filter((i) => i.status !== "Resolved"), [liveSummaries]);
  const sla = useMemo(() => slaSummary(openLive, slaConfig, now), [openLive, slaConfig, now]);
  const confirmed = useMemo(() => confirmedClusters(liveSummaries), [liveSummaries]);
  const suggested = useMemo(() => suggestClusters(liveSummaries), [liveSummaries]);
  const liveHotspots = useMemo(() => hotspots(openLive, buildingMap), [openLive, buildingMap]);
  const highOpen = openLive.filter((i) => i.priority === "High").length;

  const historyIssues = useMemo(() => history?.issues ?? [], [history]);
  const resolution30d = useMemo(() => resolutionStats(historyIssues.filter((i) => i.createdAt.getTime() >= now.getTime() - 30 * DAY)), [historyIssues, now]);
  const trend = useMemo(() => {
    const to = new Date();
    const from = new Date(to.getTime() - 29 * DAY);
    return timeSeries(historyIssues, from, to, "day");
  }, [historyIssues]);
  const trendTotal = trend.reduce((s, t) => s + t.reported, 0);
  const risk = useMemo(() => maintenanceRisk(historyIssues, now, buildingMap, nameMap), [historyIssues, now, buildingMap, nameMap]);
  const insights = useMemo(() => generateInsights(historyIssues, 30, slaConfig, now, buildingMap), [historyIssues, slaConfig, now, buildingMap]);
  const satisfaction = useMemo(() => (feedback ? summarizeSatisfaction(feedback) : null), [feedback]);
  const topHotspots = [...liveHotspots.buildings].filter((b) => b.open > 0).sort((a, b) => b.open - a.open).slice(0, 4);

  const escalate = useCallback(
    async (issueId: string) => {
      setBusy(issueId);
      try {
        await setIssueEscalation(issueId, true);
        toast.success("Issue escalated", "It now appears first in the assigned worker's list.");
      } catch (err) {
        logError("setIssueEscalation", err);
        toast.error("Couldn't escalate the issue", getFriendlyErrorMessage(err, "Please try again."));
      } finally {
        setBusy("");
      }
    },
    [toast]
  );

  const confirmCluster = useCallback(async () => {
    const cluster = pendingCluster;
    if (!admin || !cluster) return;
    setBusy(cluster.masterIssueId);
    let linked = 0;
    try {
      for (const id of cluster.relatedIssueIds) {
        await linkIssueToIncident(id, cluster.masterIssueId, admin);
        linked++;
      }
      toast.success(`Linked ${linked} report${linked === 1 ? "" : "s"} into one incident`, "Each report keeps its own status and updates.");
    } catch (err) {
      logError("linkIssueToIncident", err);
      toast.error(`${linked} linked before an error`, getFriendlyErrorMessage(err, "Couldn't link the remaining reports."));
    } finally {
      setBusy("");
      setPendingCluster(null);
    }
  }, [admin, pendingCluster, toast]);

  const firstName = userProfile?.name?.split(" ")[0];
  const liveCount = live?.length ?? 0;

  return (
    <>
      <PageHeader
        eyebrow={firstName ? `${greeting()}, ${firstName}` : undefined}
        title="Campus operations"
        description="Open issues, deadlines and maintenance hotspots at a glance."
        actions={
          <>
            <Button variant="secondary" icon={<RefreshCw className="h-4 w-4" aria-hidden="true" />} onClick={() => setRefreshKey((k) => k + 1)}>
              Refresh
            </Button>
            <Link href="/admin/issues" className={buttonClasses("primary")}>
              All issues
            </Link>
          </>
        }
      />

      {(liveError || historyError) && (
        <Notice tone="danger" title="Some data couldn't be loaded" className="mb-6" action={<Button size="sm" variant="secondary" onClick={() => setRefreshKey((k) => k + 1)}>Try again</Button>}>
          {liveError || historyError}
        </Notice>
      )}

      <StatStrip
        className="mb-6"
        stats={[
          { label: "Open issues", value: counts?.unresolved, loading: !counts, hint: counts ? `${counts.total} reported in total` : undefined },
          { label: "High priority", value: highOpen, loading: live === null, hint: "Open, high priority", tone: highOpen ? "warning" : "default" },
          {
            label: "Overdue",
            value: sla.counts.breached,
            loading: live === null,
            tone: sla.counts.breached ? "danger" : "default",
            hint: sla.counts.approaching ? `${sla.counts.approaching} due soon` : "Past their target time",
          },
          {
            label: "Median resolution",
            value: formatHours(resolution30d.medianHours) ?? "—",
            loading: history === null && !historyError,
            hint: resolution30d.count ? `${resolution30d.count} resolved · 30 days` : "None resolved in 30 days",
          },
          {
            label: "Satisfaction",
            value: satisfaction?.average != null ? `${satisfaction.average}/5` : "—",
            loading: feedback === null,
            hint: satisfaction?.count ? `${satisfaction.count} ratings` : "No ratings yet",
          },
        ]}
      />
      {(history?.capped || liveCount >= ADMIN_ISSUE_WINDOW) && (
        <p className="-mt-4 mb-6 text-xs text-fg-subtle">
          Live figures cover the newest {liveCount} issues{history?.capped ? `; history uses the newest ${historyIssues.length} from the last ${RISK_WINDOW_DAYS} days (query limit)` : ""}.
        </p>
      )}

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Issue trend"
            description="Reported and resolved per day, last 30 days"
            action={
              <Link href="/admin/analytics" className="inline-flex items-center gap-1 text-[13px] font-medium text-brand-fg hover:underline">
                Analytics <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            }
          />
          <CardBody>
            {history === null ? (
              historyError ? <ErrorState compact description="Trend data unavailable." /> : <Skeleton className="h-56 w-full" />
            ) : trendTotal === 0 ? (
              <EmptyState compact title="No issues in the last 30 days" description="The trend will appear once issues are reported." />
            ) : (
              <div className="h-56" role="img" aria-label={`Issue trend: ${trendTotal} reported in the last 30 days`}>
                <ResponsiveContainer initialDimension={{ width: 320, height: 200 }}>
                  <AreaChart data={trend} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid stroke={chart.grid} vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: chart.axis }} tickLine={false} axisLine={{ stroke: chart.grid }} interval="preserveStartEnd" minTickGap={24} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: chart.axis }} tickLine={false} axisLine={false} width={40} />
                    <Tooltip contentStyle={chart.tooltip} labelStyle={chart.tooltipLabel} itemStyle={chart.tooltipItem} cursor={{ stroke: chart.grid }} />
                    <Legend iconType="plainline" wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                    <Area type="monotone" dataKey="reported" name="Reported" stroke={chart.primary} strokeWidth={2} fill={chart.primarySoft} activeDot={{ r: 4 }} />
                    <Area type="monotone" dataKey="resolved" name="Resolved" stroke={chart.secondary} strokeWidth={2} fill="transparent" activeDot={{ r: 4 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Needs attention" description={live ? `${sla.alerts.length} open issue${sla.alerts.length === 1 ? "" : "s"} near or past target` : undefined} />
          <div className="mt-3 border-t border-border">
            {live === null ? (
              <SkeletonRows rows={4} />
            ) : sla.alerts.length === 0 ? (
              <EmptyState compact icon={<CheckCircle2 />} title="Everything is on track" description="No open issue is near or past its target time." />
            ) : (
              <ul className="max-h-[22rem] divide-y divide-border overflow-y-auto">
                {sla.alerts.slice(0, 12).map((a) => (
                  <li key={a.issue.id} className="px-4 py-3 sm:px-5">
                    <Link href={`/issues/${a.issue.id}`} className="line-clamp-2 text-sm font-medium text-fg hover:text-brand-fg hover:underline">
                      {a.issue.title}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <Badge tone={a.state === "breached" ? "danger" : "warning"}>
                        {describeSla({ state: a.state, deadline: a.deadline, remainingMs: a.remainingMs, elapsedFraction: 0 })}
                      </Badge>
                      <PriorityBadge priority={a.issue.priority} />
                      {!a.issue.assignedTo && <Badge>Unassigned</Badge>}
                      {a.issue.escalated ? (
                        <Badge tone="danger" icon={<Siren aria-hidden="true" />}>
                          Escalated
                        </Badge>
                      ) : (
                        <Button variant="tertiary" size="sm" className="h-6 px-1.5 text-xs" onClick={() => escalate(a.issue.id)} isLoading={busy === a.issue.id} disabled={busy !== "" && busy !== a.issue.id} aria-label={`Escalate “${a.issue.title}”`}>
                          Escalate
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Campus hotspots"
            description="Open issues by building"
            action={
              <Link href="/admin/map" className="inline-flex items-center gap-1 text-[13px] font-medium text-brand-fg hover:underline">
                Full map <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            }
          />
          <CardBody>
            {live === null ? (
              <Skeleton className="aspect-[100/64] w-full" />
            ) : (
              <>
                <CampusMap hotspots={liveHotspots.buildings} unplaced={liveHotspots.unplaced} compact />
                {topHotspots.length > 0 && (
                  <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[13px]">
                    {topHotspots.map((h) => (
                      <li key={h.buildingId} className="flex justify-between gap-2">
                        <span className="truncate text-fg-muted">{h.name}</span>
                        <span className="tabular font-medium text-fg">{h.open}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Maintenance risks" description={`Places with recurring issues · last ${RISK_WINDOW_DAYS} days`} />
          <CardBody>
            {history === null ? (
              historyError ? <p className="text-[13px] text-fg-subtle">Unavailable.</p> : <SkeletonLines lines={5} />
            ) : !risk.sufficient ? (
              <EmptyState compact icon={<Wrench />} title="Not enough data yet" description={risk.reason} />
            ) : risk.indicators.length === 0 ? (
              <EmptyState compact icon={<Wrench />} title="No recurring problems" description="No place has enough repeated issues to score." />
            ) : (
              <>
                <ul className="divide-y divide-border">
                  {risk.indicators.slice(0, 6).map((r) => (
                    <li key={r.key} className="flex items-start justify-between gap-3 py-2.5 first:pt-0">
                      <div className="min-w-0">
                        <p className="break-words text-sm text-fg">{r.label}</p>
                        <p className="text-xs text-fg-subtle">
                          {r.issuesInWindow} issues ({r.issuesLast30Days} in 30 days)
                          {r.repeatedCategory ? ` · ${r.repeatedCount}× ${r.repeatedCategory}` : ""} · last {r.daysSinceLastIssue}d ago
                        </p>
                      </div>
                      <Badge tone={RISK_TONE[r.level]}>{r.level}</Badge>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-xs text-fg-subtle">Rule-based indicator from frequency, recurrence, recency and priority — not a prediction. Needs at least {RISK_MIN_ISSUES} issues.</p>
              </>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Incidents" description="Reports of the same problem, grouped" />
          <CardBody>
            {live === null ? (
              <SkeletonLines lines={4} />
            ) : confirmed.length === 0 && suggested.length === 0 ? (
              <EmptyState compact icon={<Layers />} title="No grouped reports" description={`No linked or similar reports among the newest ${liveCount} issues.`} />
            ) : (
              <div className="space-y-5">
                {suggested.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-medium text-fg-subtle">Suggested — please review</p>
                    <ul className="space-y-2">
                      {suggested.slice(0, 4).map((c) => (
                        <li key={c.masterIssueId} className="rounded-md border border-border px-3 py-2.5">
                          <p className="text-sm text-fg">
                            <span className="font-medium">{c.reportCount} similar reports</span> · {c.title}
                          </p>
                          <p className="text-xs text-fg-subtle">
                            {c.location} · {formatDate(c.firstReportedAt)} – {formatDate(c.lastReportedAt)}
                          </p>
                          <div className="mt-1.5 flex gap-1">
                            <Link href={`/issues/${c.masterIssueId}`} className={buttonClasses("ghost", "sm", "h-7 px-2 text-xs")}>
                              Review
                            </Link>
                            <Button variant="tertiary" size="sm" className="h-7 px-2 text-xs" onClick={() => setPendingCluster(c)} disabled={busy !== ""}>
                              Group as one incident
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {confirmed.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-medium text-fg-subtle">Confirmed</p>
                    <ul className="divide-y divide-border">
                      {confirmed.slice(0, 5).map((c) => (
                        <li key={c.masterIssueId} className="flex items-center justify-between gap-3 py-2">
                          <Link href={`/issues/${c.masterIssueId}`} className="min-w-0 truncate text-sm text-fg hover:text-brand-fg hover:underline">
                            {c.title}
                          </Link>
                          <span className="shrink-0 text-xs text-fg-subtle">
                            {c.reportCount} reports · {c.status}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Insights" description="Computed from recorded issues only" />
          <CardBody>
            {history === null ? (
              <SkeletonLines lines={4} />
            ) : (
              <ul className="space-y-3">
                {insights.map((ins) => (
                  <li key={ins.id} className="flex gap-2.5 text-sm">
                    <Lightbulb className={`mt-0.5 h-4 w-4 shrink-0 ${ins.hasData ? "text-brand-fg" : "text-fg-subtle"}`} aria-hidden="true" />
                    <span className={ins.hasData ? "text-fg" : "text-fg-subtle"}>{ins.text}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      <ConfirmDialog
        open={!!pendingCluster}
        title="Group these reports as one incident?"
        description={
          pendingCluster
            ? `${pendingCluster.relatedIssueIds.length} report${pendingCluster.relatedIssueIds.length === 1 ? "" : "s"} will be linked to “${pendingCluster.title}”. Each keeps its own status and its reporter still gets updates. You can unlink any of them later.`
            : undefined
        }
        confirmLabel="Group reports"
        busy={!!pendingCluster && busy === pendingCluster.masterIssueId}
        onConfirm={confirmCluster}
        onCancel={() => setPendingCluster(null)}
      />
    </>
  );
}
