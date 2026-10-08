"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import IssueForm from "@/components/IssueForm";
import ChatReporter from "@/components/ChatReporter";
import { useAuthContext } from "@/components/AuthProvider";
import PageHeader from "@/components/ui/PageHeader";
import { Segmented } from "@/components/ui/Tabs";
import { Notice, Skeleton } from "@/components/ui/States";
import { dashboardPathForRole } from "@/lib/roles";
import { getCampusLocation } from "@/lib/locations";
import { logError } from "@/lib/errors";
import { CampusLocation } from "@/types";

const LOCATION_ID = /^[a-z0-9-]{1,60}$/;

function FormSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-surface p-5" role="status" aria-label="Loading">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-4 h-9 w-full" />
      <Skeleton className="mt-4 h-28 w-full" />
      <Skeleton className="mt-4 h-9 w-2/3" />
    </div>
  );
}

function ReportContent() {
  const { activeRole } = useAuthContext();
  const searchParams = useSearchParams();
  const locationParam = searchParams.get("location") ?? "";
  const [mode, setMode] = useState<"form" | "quick">("form");
  // undefined = still loading; null = none / not recognised.
  const [preset, setPreset] = useState<CampusLocation | null | undefined>(locationParam ? undefined : null);
  const [presetMissing, setPresetMissing] = useState(false);

  useEffect(() => {
    if (!locationParam) return;
    if (!LOCATION_ID.test(locationParam)) {
      setPreset(null);
      setPresetMissing(true);
      return;
    }
    let cancelled = false;
    getCampusLocation(locationParam)
      .then((loc) => {
        if (cancelled) return;
        setPreset(loc);
        setPresetMissing(!loc);
      })
      .catch((err) => {
        logError("getCampusLocation", err);
        if (!cancelled) {
          setPreset(null);
          setPresetMissing(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [locationParam]);

  return (
    <>
      <PageHeader
        eyebrow={
          <Link href={dashboardPathForRole(activeRole)} className="inline-flex items-center gap-1 rounded hover:text-fg">
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Back to dashboard
          </Link>
        }
        title="Report an issue"
        description="Tell us what's wrong and where. A category and priority are suggested automatically — you can review everything before submitting."
        actions={
          <Segmented
            label="Report mode"
            value={mode}
            onChange={setMode}
            options={[
              { value: "form", label: "Full form" },
              { value: "quick", label: "Quick report" },
            ]}
          />
        }
      />

      {presetMissing && (
        <Notice tone="warning" title="QR location not recognised" className="mb-6">
          It may have been removed. Please type the location instead.
        </Notice>
      )}

      {preset === undefined ? (
        <FormSkeleton />
      ) : mode === "quick" ? (
        <ChatReporter key={preset?.id ?? "none"} locationPreset={preset} />
      ) : (
        <IssueForm key={preset?.id ?? "none"} locationPreset={preset} />
      )}
    </>
  );
}

export default function ReportIssuePage() {
  return (
    <Suspense fallback={<FormSkeleton />}>
      <ReportContent />
    </Suspense>
  );
}
