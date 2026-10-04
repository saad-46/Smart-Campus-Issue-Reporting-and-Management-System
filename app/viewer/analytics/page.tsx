"use client";

import React from "react";
import { Lock } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Card, { CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { StatStrip } from "@/components/ui/Data";
import { useViewer } from "@/components/viewer/ViewerProvider";
import { SampleNote, ViewerLoading } from "@/components/viewer/parts";
import { HorizontalBars, ShareList, TrendChart } from "@/components/viewer/charts";
import { formatHours } from "@/components/admin/Kpi";
import { DEMO_WINDOW_DAYS } from "@/lib/viewer/demoStats";

export default function ViewerAnalyticsPage() {
  const { stats, promptSignIn } = useViewer();

  const header = (
    <PageHeader
      eyebrow="Analytics · sample"
      title="Analytics"
      description="Trends, resolution performance and satisfaction, computed from the sample dataset."
      actions={
        <Button variant="secondary" icon={<Lock className="h-4 w-4" aria-hidden="true" />} onClick={() => promptSignIn("Exporting analytics")}>
          Export
        </Button>
      }
    />
  );
  if (!stats) return (<>{header}<ViewerLoading /></>);

  const resolvedSla = stats.sla.counts.met + stats.sla.counts.missed;
  const onTime = resolvedSla ? Math.round((stats.sla.counts.met / resolvedSla) * 100) : null;
  const locations = stats.map.buildings.filter((b) => b.total > 0).sort((a, b) => b.total - a.total).slice(0, 6);

  return (
    <>
      {header}
      <SampleNote>
        Sample analytics: every chart below is calculated from the {stats.total} sample issues with the same functions as the real Analytics page. The
        real page adds date ranges, filters and exports for signed-in administrators.
      </SampleNote>

      <StatStrip
        className="mb-6 lg:grid-cols-4"
        stats={[
          { label: "Reported", value: stats.total, hint: `Last ${DEMO_WINDOW_DAYS} days` },
          { label: "Resolved", value: stats.status.Resolved, hint: `${Math.round((stats.status.Resolved / stats.total) * 100)}% of reported` },
          { label: "Avg. resolution", value: formatHours(stats.resolution.averageHours) ?? "—", hint: `Median ${formatHours(stats.resolution.medianHours) ?? "—"}` },
          { label: "On time", value: onTime !== null ? `${onTime}%` : "—", hint: `${stats.sla.counts.met} of ${resolvedSla} resolved within target` },
        ]}
      />

      <Card className="mb-6">
        <CardHeader title="Issues over time" description="Reported and resolved per day" />
        <div className="px-3 pb-4 pt-3 sm:px-5">
          <TrendChart data={stats.trend} caption={`Issues reported and resolved per day over the last ${DEMO_WINDOW_DAYS} days`} />
        </div>
      </Card>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Categories" description="Reported issues by category" />
          <div className="px-3 pb-4 pt-3 sm:px-5">
            <HorizontalBars data={stats.categories} caption="Number of sample issues per category" valueLabel="Issues" />
          </div>
        </Card>
        <Card>
          <CardHeader title="Resolution performance" description="Average time to resolve, by category" />
          <div className="px-3 pb-4 pt-3 sm:px-5">
            <HorizontalBars
              data={stats.resolutionByCategory.map((r) => ({ name: r.name, value: r.averageHours }))}
              caption="Average hours from report to resolution, per category"
              valueLabel="Average hours"
              unit="h"
            />
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title="Priority" />
          <div className="px-4 pb-5 pt-3 sm:px-5">
            <ShareList
              label="Issues by priority"
              items={[
                { name: "High", value: stats.priority.High, tone: "danger" },
                { name: "Medium", value: stats.priority.Medium, tone: "warning" },
                { name: "Low", value: stats.priority.Low, tone: "neutral" },
              ]}
            />
          </div>
        </Card>
        <Card>
          <CardHeader title="Locations" description="Buildings with the most reports" />
          <div className="px-4 pb-5 pt-3 sm:px-5">
            <ShareList label="Issues by building" items={locations.map((b) => ({ name: b.name, value: b.total }))} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Satisfaction" description={`${stats.satisfaction.count} ratings · average ${stats.satisfaction.average ?? "—"}/5`} />
          <div className="px-4 pb-5 pt-3 sm:px-5">
            <ShareList
              label="Ratings by number of stars"
              items={[...stats.satisfaction.distribution].reverse().map((d) => ({ name: `${d.stars} star${d.stars === 1 ? "" : "s"}`, value: d.count }))}
            />
          </div>
        </Card>
      </div>
    </>
  );
}
