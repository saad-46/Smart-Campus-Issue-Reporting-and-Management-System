"use client";

import React, { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthContext } from "@/components/AuthProvider";
import { createIssue } from "@/lib/firestore";
import { summarizeReport } from "@/services/aiService";
import { requestAssist } from "@/services/reportAssistService";
import { departmentFor } from "@/lib/constants";
import { getFriendlyErrorMessage, logError } from "@/lib/errors";
import DuplicateCheck from "@/components/report/DuplicateCheck";
import QuickReportAssistant, { QuickReportValues } from "@/components/report/QuickReportAssistant";
import { useToast } from "@/components/ui/Toast";

interface QuickReportProps {
  onIssueCreated?: (issueId: string) => void;
}

/**
 * The signed-in Quick report. Suggestions come from the protected
 * /api/report-assist endpoint (an AI model when one is configured on the
 * server), and from the same built-in rules in the browser whenever the
 * endpoint is unavailable. The conversation and review UI is shared with
 * Explore Mode (components/report/QuickReportAssistant.tsx).
 */
export default function ChatReporter({ onIssueCreated }: QuickReportProps) {
  const { userProfile } = useAuthContext();
  const router = useRouter();
  const toast = useToast();

  const assist = useCallback(async (messages: string[], options: { locationAnswer?: string }) => {
    try {
      return await requestAssist(messages, { locationAnswer: options.locationAnswer });
    } catch (err) {
      logError("requestAssist", err);
      throw err;
    }
  }, []);

  const submit = useCallback(
    async (v: QuickReportValues, draft: { confidence: number }) => {
      if (!userProfile) throw new Error("Please sign in again to submit.");
      try {
        const issueId = await createIssue(
          { title: v.title, description: v.description, location: v.location || "Unknown" },
          userProfile.id,
          userProfile.name,
          v.category,
          v.priority,
          [],
          {
            analysis: { summary: summarizeReport(v.description, []), confidence: draft.confidence, department: departmentFor(v.category) },
            duplicateOf: v.duplicateOf,
          }
        );
        toast.success(v.duplicateOf ? "Issue submitted and linked" : "Issue submitted", "You'll be notified when its status changes.");
        if (onIssueCreated) onIssueCreated(issueId);
        else router.push(`/issues/${issueId}`);
      } catch (err) {
        logError("createIssue", err);
        throw new Error(getFriendlyErrorMessage(err, "Unable to submit your issue right now. Please try again."));
      }
    },
    [userProfile, toast, router, onIssueCreated]
  );

  return (
    <QuickReportAssistant
      assist={assist}
      onSubmit={submit}
      renderDuplicateCheck={(c) => <DuplicateCheck candidate={{ title: c.title, category: c.category, location: c.location, locationId: "" }} value={c.value} onChange={c.onChange} />}
    />
  );
}
