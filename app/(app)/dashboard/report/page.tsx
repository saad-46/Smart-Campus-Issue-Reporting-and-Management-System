"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import IssueForm from "@/components/IssueForm";
import ChatReporter from "@/components/ChatReporter";
import { useAuthContext } from "@/components/AuthProvider";
import PageHeader from "@/components/ui/PageHeader";
import { Segmented } from "@/components/ui/Tabs";
import { Skeleton } from "@/components/ui/States";
import { dashboardPathForRole } from "@/lib/roles";

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
  const router = useRouter();
  const [mode, setMode] = useState<"form" | "quick">("form");

  // Reporting is for students (and administrators). A worker who opens this address
  // directly is sent to their own workspace; they are never shown the form.
  const isWorker = activeRole === "worker";
  useEffect(() => {
    if (isWorker) router.replace(dashboardPathForRole("worker"));
  }, [isWorker, router]);
  if (isWorker) return <FormSkeleton />;

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

      {mode === "quick" ? <ChatReporter /> : <IssueForm />}
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
