// ============================================
// Quick-report assistant client
// ============================================
// Asks the server endpoint for a suggestion and, whatever goes wrong
// (offline, signed out, rate limited, provider down, malformed answer),
// falls back to the same deterministic engine in the browser, so the
// assistant is never a reason a student cannot report.

import { auth } from "@/lib/firebase";
import { AssistOptions, AssistantDraft, assistWithRules, normalizeMessages } from "@/lib/reportAssistant";

export interface AssistResult {
  draft: AssistantDraft;
  /** Why the server's answer was not used, when it was not. */
  degraded?: string;
}

const CLIENT_TIMEOUT_MS = 12_000;

export async function requestAssist(rawMessages: string[], options: AssistOptions = {}): Promise<AssistResult> {
  const messages = normalizeMessages(rawMessages);
  const early = assistWithRules(messages, options);
  // Nothing to classify: don't spend a request.
  if (early.refusal) return { draft: early };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);
  try {
    const token = await auth.currentUser?.getIdToken();
    if (!token) return { draft: early, degraded: "signed-out" };
    const res = await fetch("/api/report-assist", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ messages, presetLocation: options.presetLocation, locationAnswer: options.locationAnswer }),
      signal: controller.signal,
    });
    if (!res.ok) return { draft: early, degraded: res.status === 429 ? "rate-limited" : "unavailable" };
    const data = (await res.json()) as { draft?: AssistantDraft; degraded?: string };
    if (!data.draft || typeof data.draft.title !== "string") return { draft: early, degraded: "invalid" };
    return { draft: data.draft, degraded: data.degraded };
  } catch {
    return { draft: early, degraded: "unavailable" };
  } finally {
    clearTimeout(timer);
  }
}
