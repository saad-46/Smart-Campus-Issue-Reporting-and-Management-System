// ============================================
// Quick-report assistant endpoint
// ============================================
// POST /api/report-assist  { messages: string[], presetLocation?, locationAnswer? }
//
// Signed-in users only (a Firebase ID token in the Authorization header,
// checked against Firebase Auth). It returns a *suggested* draft; it cannot
// create, submit, assign or pay anything, and it has no access to Firestore.
//
// With ANTHROPIC_API_KEY set on the server it asks a model for a structured
// suggestion and validates the answer (lib/reportAssistant.validateModelDraft).
// Without a key, or when the provider is slow, rate-limited or returns
// something malformed, it answers from the deterministic rules engine and
// says so in `source`. The key is read from the server environment only and
// never reaches the browser.

import { NextResponse } from "next/server";
import {
  AssistantDraft,
  MODEL_SYSTEM_PROMPT,
  assistWithRules,
  buildModelUserMessage,
  normalizeMessages,
  parseModelJson,
  validateModelDraft,
} from "@/lib/reportAssistant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 8 * 1024;
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 12;
const AUTH_TIMEOUT_MS = 5_000;
const MODEL_TIMEOUT_MS = 8_000;

// Best-effort limiter: per server instance, so it bounds one client hammering
// one instance but is not a global quota. A spend limit on the provider key is
// the real ceiling (see docs/CHAT_AI_FINANCE.md).
const hits = new Map<string, number[]>();

function limited(uid: string, now = Date.now()): boolean {
  const recent = (hits.get(uid) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_REQUESTS_PER_WINDOW) {
    hits.set(uid, recent);
    return true;
  }
  recent.push(now);
  hits.set(uid, recent);
  if (hits.size > 5_000) for (const [k, v] of hits) if (v.every((t) => now - t >= WINDOW_MS)) hits.delete(k);
  return false;
}

async function timeoutFetch(url: string, init: RequestInit, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** The uid the ID token belongs to, or null. Asks Firebase Auth itself rather than trusting a decoded claim. */
async function verifyIdToken(token: string): Promise<string | null> {
  const key = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!key || token.length < 20 || token.length > 4096) return null;
  try {
    const res = await timeoutFetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(key)}`,
      { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ idToken: token }) },
      AUTH_TIMEOUT_MS
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { users?: { localId?: string; disabled?: boolean }[] };
    const user = data.users?.[0];
    return user?.localId && !user.disabled ? user.localId : null;
  } catch {
    return null;
  }
}

async function askModel(messages: string[]): Promise<{ raw: unknown } | { error: "unavailable" | "timeout" | "provider" | "invalid" }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { error: "unavailable" };
  try {
    const res = await timeoutFetch(
      "https://api.anthropic.com/v1/messages",
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: process.env.REPORT_ASSIST_MODEL || "claude-haiku-5-5",
          max_tokens: 400,
          temperature: 0,
          system: MODEL_SYSTEM_PROMPT,
          messages: [{ role: "user", content: buildModelUserMessage(messages) }],
        }),
      },
      MODEL_TIMEOUT_MS
    );
    if (!res.ok) return { error: "provider" };
    const body = (await res.json()) as { content?: { type?: string; text?: string }[] };
    const text = body.content?.find((c) => c.type === "text")?.text ?? "";
    const raw = parseModelJson(text);
    return raw ? { raw } : { error: "invalid" };
  } catch (err) {
    return { error: (err as Error)?.name === "AbortError" ? "timeout" : "provider" };
  }
}

export async function POST(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const uid = token ? await verifyIdToken(token) : null;
  if (!uid) return NextResponse.json({ error: "Sign in to use the assistant." }, { status: 401 });

  if (limited(uid)) {
    return NextResponse.json({ error: "Too many requests. Wait a minute and try again." }, { status: 429, headers: { "retry-after": "60" } });
  }

  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) return NextResponse.json({ error: "That message is too long." }, { status: 413 });
  let body: { messages?: unknown; presetLocation?: unknown; locationAnswer?: unknown };
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) return NextResponse.json({ error: "That message is too long." }, { status: 413 });
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const messages = normalizeMessages(body.messages);
  if (messages.length === 0) return NextResponse.json({ error: "Describe the problem first." }, { status: 400 });
  const options = {
    presetLocation: typeof body.presetLocation === "string" ? body.presetLocation.slice(0, 200) : undefined,
    locationAnswer: typeof body.locationAnswer === "string" ? body.locationAnswer.slice(0, 200) : undefined,
  };

  const rules = assistWithRules(messages, options);
  // Nothing to classify (abuse, noise): no provider call, no cost.
  if (rules.refusal) return NextResponse.json({ draft: rules, source: "rules" });

  const answer = await askModel(messages);
  if ("raw" in answer) {
    const draft: AssistantDraft | null = validateModelDraft(answer.raw, messages, options);
    if (draft) return NextResponse.json({ draft, source: draft.source });
    return NextResponse.json({ draft: rules, source: "rules", degraded: "invalid" });
  }
  return NextResponse.json({ draft: rules, source: "rules", degraded: answer.error });
}
