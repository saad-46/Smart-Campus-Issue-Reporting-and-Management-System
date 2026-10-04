"use client";

import React, { useState } from "react";
import PageHeader from "@/components/ui/PageHeader";
import Card, { CardHeader } from "@/components/ui/Card";
import { Segmented } from "@/components/ui/Tabs";
import { TableWrap, td, th, trHover } from "@/components/ui/Data";
import { EmptyState } from "@/components/ui/States";
import CampusMap from "@/components/admin/CampusMap";
import { useViewer } from "@/components/viewer/ViewerProvider";
import { DemoIssueList, SampleNote, ViewerLoading } from "@/components/viewer/parts";
import { buildingForIssue, getBuilding } from "@/lib/campus";

export default function ViewerMapPage() {
  const { data, stats } = useViewer();
  const [metric, setMetric] = useState<"open" | "total">("open");
  const [selected, setSelected] = useState<string | null>(null);

  const header = (
    <PageHeader
      eyebrow="Campus map · sample"
      title="Campus map"
      description="Where issues are concentrated. A schematic layout of campus buildings, shaded by the number of sample issues."
      actions={
        <Segmented
          label="Count"
          value={metric}
          onChange={setMetric}
          options={[
            { value: "open", label: "Open" },
            { value: "total", label: "All" },
          ]}
        />
      }
    />
  );
  if (!data || !stats) return (<>{header}<ViewerLoading /></>);

  const building = getBuilding(selected);
  const inBuilding = building ? data.issues.filter((i) => buildingForIssue(i)?.id === building.id) : [];
  const rows = stats.map.buildings.filter((b) => b.total > 0).sort((a, b) => b[metric] - a[metric]);

  return (
    <>
      {header}
      <SampleNote>Select a building to see its sample issues. The table below lists the same counts as text.</SampleNote>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Card padded>
          <CampusMap hotspots={stats.map.buildings} unplaced={stats.map.unplaced} metric={metric} selectedId={selected} onSelect={setSelected} />
        </Card>
        <Card>
          <CardHeader title={building ? building.name : "Building details"} description={building ? `${inBuilding.length} sample issue${inBuilding.length === 1 ? "" : "s"}` : "Choose a building on the map"} />
          <div className="mt-3 border-t border-border" aria-live="polite">
            {building ? (
              inBuilding.length ? (
                <DemoIssueList issues={inBuilding} now={data.now} label={`Sample issues in ${building.name}`} />
              ) : (
                <EmptyState compact title="No sample issues here" />
              )
            ) : (
              <EmptyState compact title="No building selected" description="Use the map — buildings can be selected with the keyboard too." />
            )}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Issues by building" description="Text alternative to the map" />
        <div className="mt-3 border-t border-border">
          <TableWrap label="Issues by building">
            <thead>
              <tr>
                <th className={th}>Building</th>
                <th className={`${th} text-right`}>Open</th>
                <th className={`${th} text-right`}>All</th>
                <th className={th}>Most common</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b.buildingId} className={trHover}>
                  <td className={`${td} whitespace-nowrap font-medium`}>{b.name}</td>
                  <td className={`${td} tabular text-right`}>{b.open}</td>
                  <td className={`${td} tabular text-right`}>{b.total}</td>
                  <td className={`${td} text-fg-muted`}>{b.topCategory ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        </div>
      </Card>
    </>
  );
}
