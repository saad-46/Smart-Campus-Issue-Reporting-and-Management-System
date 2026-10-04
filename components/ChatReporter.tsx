"use client";

import React, { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Pencil, QrCode } from "lucide-react";
import { useAuthContext } from "@/components/AuthProvider";
import { createIssue } from "@/lib/firestore";
import { IssueIntelligence, parseChatMessage } from "@/services/aiService";
import { LIMITS } from "@/lib/constants";
import { describeLocation } from "@/lib/campus";
import { getFriendlyErrorMessage, logError } from "@/lib/errors";
import { CampusLocation } from "@/types";
import { useSlowNotice } from "@/hooks/useSlowNotice";
import DuplicateCheck from "@/components/report/DuplicateCheck";
import { Textarea } from "@/components/ui/Field";
import Button from "@/components/ui/Button";
import { PriorityBadge } from "@/components/ui/Badge";
import { Notice } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";

interface ParsedIssue extends IssueIntelligence {
  title: string;
  description: string;
  location: string;
}

interface QuickReportProps {
  onIssueCreated?: (issueId: string) => void;
  /** Place scanned from a location QR code. */
  locationPreset?: CampusLocation | null;
}

/**
 * Quick report: one message in, a structured report out. The extracted
 * title, location and suggested category are shown for review before
 * anything is submitted.
 */
export default function ChatReporter({ onIssueCreated, locationPreset = null }: QuickReportProps) {
  const { userProfile } = useAuthContext();
  const router = useRouter();
  const toast = useToast();
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<ParsedIssue | null>(null);
  const [parsing, setParsing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [duplicateOf, setDuplicateOf] = useState("");
  const [error, setError] = useState("");
  const [touched, setTouched] = useState(false);
  const presetLocation = locationPreset ? describeLocation(locationPreset) : "";
  const submitIsSlow = useSlowNotice(submitting);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const textError = text.trim().length < 8 ? "Describe the problem in a few words, including where it is." : "";

  async function handleReview(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    setError("");
    if (textError || parsing) return;
    setParsing(true);
    try {
      const extracted = await parseChatMessage(text);
      // A scanned QR location is more reliable than one guessed from the text.
      setParsed(presetLocation ? { ...extracted, location: presetLocation } : extracted);
      setDuplicateOf("");
    } catch (err) {
      logError("parseChatMessage", err);
      setError("We couldn't read that. Try adding a little more detail, or use the full form.");
    } finally {
      setParsing(false);
    }
  }

  async function handleSubmit() {
    if (!parsed || !userProfile || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const issueId = await createIssue(
        { title: parsed.title, description: parsed.description, location: parsed.location },
        userProfile.id,
        userProfile.name,
        parsed.category,
        parsed.priority,
        [],
        {
          analysis: { summary: parsed.summary, confidence: parsed.confidence, department: parsed.department },
          locationId: locationPreset?.id,
          duplicateOf,
        }
      );
      toast.success(duplicateOf ? "Issue submitted and linked" : "Issue submitted", "You'll be notified when its status changes.");
      if (onIssueCreated) onIssueCreated(issueId);
      else router.push(`/issues/${issueId}`);
    } catch (err) {
      logError("createIssue", err);
      // Stay on the review step so the same report can simply be retried.
      setError(getFriendlyErrorMessage(err, "Unable to submit your issue right now. Please try again."));
      setSubmitting(false);
    }
  }

  if (!parsed) {
    return (
      <form onSubmit={handleReview} noValidate className="max-w-2xl space-y-4 rounded-lg border border-border bg-surface p-4 sm:p-5">
        <Textarea
          ref={textRef}
          label="What happened, and where?"
          placeholder="e.g. The water cooler near the Block A staircase is leaking onto the floor."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => setTouched(true)}
          error={touched ? textError || undefined : undefined}
          hint={presetLocation ? `Location from QR code: ${presetLocation}` : "Mention the building or room so it can be found."}
          maxLength={LIMITS.description}
          rows={4}
          required
        />
        {error && <Notice tone="danger">{error}</Notice>}
        <div className="flex justify-end">
          <Button type="submit" isLoading={parsing}>
            Review report
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="max-w-2xl space-y-4">
      <section aria-labelledby="quick-review" className="rounded-lg border border-border bg-surface">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
          <h2 id="quick-review" className="text-sm font-semibold text-fg">
            Review before submitting
          </h2>
          <Button variant="ghost" size="sm" icon={<Pencil className="h-3.5 w-3.5" aria-hidden="true" />} onClick={() => setParsed(null)} disabled={submitting}>
            Edit
          </Button>
        </div>
        <div className="space-y-4 px-4 py-4 sm:px-5">
          <div>
            <p className="text-xs text-fg-subtle">Title</p>
            <p className="mt-0.5 break-words text-sm font-medium text-fg">{parsed.title}</p>
          </div>
          <div>
            <p className="text-xs text-fg-subtle">Location</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-fg">
              {presetLocation ? <QrCode className="h-3.5 w-3.5 text-brand-fg" aria-hidden="true" /> : <MapPin className="h-3.5 w-3.5 text-fg-subtle" aria-hidden="true" />}
              {parsed.location === "Unknown" ? <span className="text-fg-muted">Not detected — staff will ask if needed</span> : parsed.location}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4 rounded-md border border-border bg-surface-2/60 p-3 sm:grid-cols-3">
            <div>
              <p className="text-xs text-fg-subtle">Suggested category</p>
              <p className="mt-0.5 text-sm text-fg">{parsed.category}</p>
            </div>
            <div>
              <p className="text-xs text-fg-subtle">Suggested priority</p>
              <div className="mt-1">
                <PriorityBadge priority={parsed.priority} />
              </div>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <p className="text-xs text-fg-subtle">Handled by</p>
              <p className="mt-0.5 text-sm text-fg">{parsed.department}</p>
            </div>
            <p className="col-span-2 text-[13px] text-fg-muted sm:col-span-3">{parsed.explanation}</p>
          </div>
        </div>
      </section>

      <DuplicateCheck
        candidate={{ title: parsed.title, category: parsed.category, location: parsed.location, locationId: locationPreset?.id ?? "" }}
        value={duplicateOf}
        onChange={setDuplicateOf}
      />

      {error && <Notice tone="danger" title="Couldn't submit">{error}</Notice>}
      {submitIsSlow && (
        <Notice tone="warning" title="Still trying to reach the server">
          Your issue hasn&apos;t been saved yet — keep this page open.
        </Notice>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={() => setParsed(null)} disabled={submitting}>
          Back
        </Button>
        <Button onClick={handleSubmit} isLoading={submitting}>
          {duplicateOf ? "Submit and link report" : "Submit issue"}
        </Button>
      </div>
    </div>
  );
}
