"use client";

import React from "react";
import { ShieldCheck } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Card, { CardHeader } from "@/components/ui/Card";
import { LIFECYCLE } from "@/components/viewer/lifecycle";
import { SignInHint } from "@/components/viewer/parts";

export default function ViewerHowItWorksPage() {
  return (
    <>
      <PageHeader
        eyebrow="How it works"
        title="The issue lifecycle"
        description="Seven steps from a student's report to an administrator's analysis — as implemented in the product."
      />

      <ol className="space-y-3" aria-label="Issue lifecycle">
        {LIFECYCLE.map((step, i) => (
          <li key={step.title}>
            <Card className="flex gap-4 p-4 sm:p-5">
              <span className="tabular flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-subtle text-sm font-semibold text-brand-fg" aria-hidden="true">
                {i + 1}
              </span>
              <div className="min-w-0">
                <h2 className="text-[15px] font-semibold text-fg">
                  <span className="sr-only">Step {i + 1}: </span>
                  {step.title}
                </h2>
                <p className="mt-0.5 text-[13px] text-fg-subtle">{step.who}</p>
                <p className="mt-2 text-sm text-fg-muted">{step.detail}</p>
              </div>
            </Card>
          </li>
        ))}
      </ol>

      <Card className="mt-6">
        <CardHeader title="Security" />
        <div className="flex gap-3 px-4 pb-5 pt-3 sm:px-5">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-fg-subtle" aria-hidden="true" />
          <p className="text-sm text-fg-muted">
            Permissions are enforced by the database security rules, not by the interface: administrator access is granted separately, worker access
            is approved by an administrator, receipts are visible only to the worker and administrators, and every payment settles exactly one claim.
            Viewer Mode uses a separate sample dataset and never reads or writes campus records.
          </p>
        </div>
      </Card>

      <SignInHint>Ready to use it for real?</SignInHint>
    </>
  );
}
