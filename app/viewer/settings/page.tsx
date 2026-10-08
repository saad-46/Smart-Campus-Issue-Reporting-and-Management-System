"use client";

import React, { useState } from "react";
import PageHeader from "@/components/ui/PageHeader";
import Card, { CardBody, CardFooter, CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Notice } from "@/components/ui/States";
import { ViewerGate } from "@/components/viewer/parts";
import { DEFAULT_SLA_HOURS, PRIORITIES, SLA_HOURS_MAX, SLA_HOURS_MIN } from "@/lib/constants";
import { Priority } from "@/types";
import type { ViewerContextValue } from "@/components/viewer/viewerContext";

function SlaForm({ viewer }: { viewer: ViewerContextValue }) {
  const [hours, setHours] = useState<Record<Priority, string>>(() => ({
    High: String(viewer.slaConfig.hours.High),
    Medium: String(viewer.slaConfig.hours.Medium),
    Low: String(viewer.slaConfig.hours.Low),
  }));
  const [error, setError] = useState("");

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = { High: Number(hours.High), Medium: Number(hours.Medium), Low: Number(hours.Low) };
    const problem = viewer.saveSla(parsed);
    setError(problem ?? "");
  };

  return (
    <form onSubmit={save} noValidate>
      <Card data-tour="settings-sla">
        <CardHeader title="Deadline targets" description="Hours from report to resolution, per priority. Every deadline and compliance figure follows these." />
        <CardBody className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            {PRIORITIES.slice()
              .reverse()
              .map((p) => (
                <Input
                  key={p}
                  label={`${p} priority`}
                  type="number"
                  inputMode="numeric"
                  min={SLA_HOURS_MIN}
                  max={SLA_HOURS_MAX}
                  value={hours[p]}
                  onChange={(e) => {
                    setHours((h) => ({ ...h, [p]: e.target.value }));
                    setError("");
                  }}
                  hint={`Default ${DEFAULT_SLA_HOURS[p]} h`}
                />
              ))}
          </div>
          {error && (
            <Notice tone="danger" title="Check the targets">
              {error}
            </Notice>
          )}
          {!viewer.slaConfig.isDefault && (
            <Notice tone="info">These targets differ from the defaults, for this visit only.</Notice>
          )}
        </CardBody>
        <CardFooter>
          <Button
            variant="secondary"
            type="button"
            onClick={() => {
              setHours({ High: String(DEFAULT_SLA_HOURS.High), Medium: String(DEFAULT_SLA_HOURS.Medium), Low: String(DEFAULT_SLA_HOURS.Low) });
              setError("");
              viewer.saveSla({ ...DEFAULT_SLA_HOURS });
            }}
          >
            Restore defaults
          </Button>
          <Button type="submit">Save targets (demo)</Button>
        </CardFooter>
      </Card>
    </form>
  );
}

export default function ViewerSettingsPage() {
  return (
    <>
      <PageHeader title="Settings" description="Configuration an administrator can change. Here, changes last only until you leave." />
      <div className="max-w-3xl space-y-6">
        <ViewerGate>{(viewer) => <SlaForm viewer={viewer} />}</ViewerGate>
        <Card padded>
          <h2 className="text-[15px] font-semibold text-fg">Access</h2>
          <p className="mt-1 text-sm text-fg-muted">
            In the real product administrator access is granted separately and can&apos;t be self-assigned. Worker accounts are approved by an administrator, and every rule is
            enforced by the database, not only by the interface. None of that is configurable from this demo.
          </p>
        </Card>
      </div>
    </>
  );
}
