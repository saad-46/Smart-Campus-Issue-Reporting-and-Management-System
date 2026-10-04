"use client";

import React, { useEffect, useRef, useState } from "react";
import { ChartLine, Eye, LayoutDashboard, Workflow } from "lucide-react";
import Dialog from "@/components/ui/Dialog";
import Button from "@/components/ui/Button";
import { cn } from "@/lib/cn";

const STEPS = [
  { icon: LayoutDashboard, title: "Choose a dashboard", text: "Explore the Student, Worker or Admin perspective from the switcher at the top." },
  { icon: Workflow, title: "Explore the workflow", text: "See how an issue moves from reporting to resolution, step by step." },
  { icon: ChartLine, title: "Try the tools", text: "Explore analytics, the campus map, SLA tracking, incidents and feedback." },
  { icon: Eye, title: "You're in Viewer Mode", text: "Everything here is read-only sample data. No account is required." },
];

/** Four-step introduction to Viewer Mode. Closing it any way (Skip, Escape, finish) counts as seen. */
export default function ViewerGuide({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const nextRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  const last = step === STEPS.length - 1;
  const current = STEPS[step];
  const Icon = current.icon;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Welcome to Viewer Mode"
      description={`Step ${step + 1} of ${STEPS.length}`}
      size="sm"
      initialFocus={nextRef}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} className="sm:mr-auto">
            Skip
          </Button>
          {step > 0 && (
            <Button
              variant="secondary"
              onClick={() => {
                // Back disappears on the first step: keep keyboard focus on Next.
                if (step === 1) nextRef.current?.focus();
                setStep((s) => s - 1);
              }}
            >
              Back
            </Button>
          )}
          <Button ref={nextRef} onClick={() => (last ? onClose() : setStep((s) => s + 1))}>
            {last ? "Start exploring" : "Next"}
          </Button>
        </>
      }
    >
      <div aria-live="polite" className="flex gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-subtle text-brand-fg">
          <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-fg">{current.title}</h3>
          <p className="mt-1 text-sm text-fg-muted">{current.text}</p>
        </div>
      </div>
      <div className="mt-5 flex gap-1.5" aria-hidden="true">
        {STEPS.map((s, i) => (
          <span key={s.title} className={cn("h-1 flex-1 rounded-full transition-colors duration-150", i <= step ? "bg-brand" : "bg-surface-2")} />
        ))}
      </div>
    </Dialog>
  );
}
