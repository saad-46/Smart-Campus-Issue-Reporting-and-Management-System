"use client";

import React, { useEffect, useState } from "react";
import { Priority } from "@/types";
import { saveSlaConfig } from "@/lib/locations";
import { PRIORITIES, SLA_HOURS_MAX, SLA_HOURS_MIN, SLA_WARNING_FRACTION } from "@/lib/constants";
import { DEFAULT_SLA_CONFIG, validateSlaHours } from "@/lib/intelligence/sla";
import { getFriendlyErrorMessage, logError } from "@/lib/errors";
import { useSlaConfig } from "@/hooks/useSlaConfig";
import PageHeader from "@/components/ui/PageHeader";
import Card, { CardFooter, CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge, { PriorityBadge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Field";
import { Notice } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";

function humanHours(h: number): string {
  if (!Number.isFinite(h) || h <= 0) return "";
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"}`;
  const days = Math.round((h / 24) * 10) / 10;
  return `${days} day${days === 1 ? "" : "s"}`;
}

export default function AdminSettingsPage() {
  const config = useSlaConfig();
  const toast = useToast();
  const [hours, setHours] = useState<Record<Priority, string>>({ High: "", Medium: "", Low: "" });
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (dirty) return;
    setHours({ High: String(config.hours.High), Medium: String(config.hours.Medium), Low: String(config.hours.Low) });
  }, [config, dirty]);

  const parsed = { High: Number(hours.High), Medium: Number(hours.Medium), Low: Number(hours.Low) };
  const problem = dirty ? validateSlaHours(parsed) : null;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const issue = validateSlaHours(parsed);
    if (issue) {
      setError(issue);
      return;
    }
    setSaving(true);
    setError("");
    try {
      await saveSlaConfig(parsed);
      setDirty(false);
      toast.success("Changes saved", "Every dashboard uses the new targets immediately.");
    } catch (err) {
      logError("saveSlaConfig", err);
      setError(getFriendlyErrorMessage(err, "The targets couldn't be saved."));
    } finally {
      setSaving(false);
    }
  };

  const resetToDefaults = () => {
    setDirty(true);
    setHours({ High: String(DEFAULT_SLA_CONFIG.hours.High), Medium: String(DEFAULT_SLA_CONFIG.hours.Medium), Low: String(DEFAULT_SLA_CONFIG.hours.Low) });
  };

  return (
    <>
      <PageHeader title="Settings" description="Configure how campus operations are measured." />

      <Card as="section" aria-labelledby="sla-settings" className="max-w-3xl">
        <form onSubmit={save} noValidate>
          <CardHeader
            id="sla-settings"
            title="Resolution targets"
            description={`Hours from report to resolution, per priority. An issue is "due soon" at ${Math.round(SLA_WARNING_FRACTION * 100)}% of its target and "overdue" after it.`}
            action={config.isDefault ? <Badge>Using defaults</Badge> : <Badge tone="info">Custom</Badge>}
          />
          <div className="divide-y divide-border px-4 pt-2 sm:px-5">
            {PRIORITIES.slice().reverse().map((p) => (
              <div key={p} className="grid items-center gap-3 py-4 sm:grid-cols-[1fr_12rem]">
                <div>
                  <PriorityBadge priority={p} />
                  <p className="mt-1.5 text-[13px] text-fg-subtle">
                    {p === "High" ? "Safety risks and outages affecting many people." : p === "Medium" ? "Things that disrupt work or study." : "Minor problems and cosmetic issues."}
                  </p>
                </div>
                <Input
                  aria-label={`${p} priority target in hours`}
                  type="number"
                  inputMode="numeric"
                  min={SLA_HOURS_MIN}
                  max={SLA_HOURS_MAX}
                  step={1}
                  value={hours[p]}
                  onChange={(e) => {
                    setDirty(true);
                    setError("");
                    setHours((h) => ({ ...h, [p]: e.target.value }));
                  }}
                  aside={humanHours(Number(hours[p]))}
                  required
                />
              </div>
            ))}
          </div>
          {(problem || error) && (
            <div className="px-4 pb-4 sm:px-5">
              <Notice tone="danger">{error || problem}</Notice>
            </div>
          )}
          <CardFooter className="justify-between">
            <Button variant="ghost" size="sm" onClick={resetToDefaults} disabled={saving}>
              Reset to defaults
            </Button>
            <Button type="submit" isLoading={saving} disabled={!dirty || !!problem}>
              Save changes
            </Button>
          </CardFooter>
        </form>
      </Card>
    </>
  );
}
