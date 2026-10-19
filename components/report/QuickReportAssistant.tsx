"use client";

import React, { useEffect, useRef, useState } from "react";
import { Bot, Send, ShieldAlert, Sparkles, User } from "lucide-react";
import { ASSISTANT_LIMITS, AssistantDraft, SAFETY_ADVICE } from "@/lib/reportAssistant";
import { ISSUE_CATEGORIES, LIMITS, PRIORITIES, departmentFor } from "@/lib/constants";
import { Priority } from "@/types";
import { useSlowNotice } from "@/hooks/useSlowNotice";
import { Input, Select, Textarea } from "@/components/ui/Field";
import Button from "@/components/ui/Button";
import { Notice } from "@/components/ui/States";
import { cn } from "@/lib/cn";

// The quick-report conversation, with no data layer of its own. The signed-in
// app (components/ChatReporter.tsx) and Explore Mode (app/viewer/report) both
// render it and supply where suggestions come from and where a report goes, so
// the experience is one component and Explore never imports Firebase.

type Asked = "description" | "location" | "detail" | "focus";
interface Bubble {
  from: "assistant" | "student";
  text: string;
}

export interface QuickReportValues {
  title: string;
  description: string;
  /** The place as text (signed-in), or the display name of the chosen option. */
  location: string;
  /** The chosen option id when `locationOptions` is used, else "". */
  locationId: string;
  category: string;
  priority: Priority;
  confidence: number;
  duplicateOf: string;
}

export interface QuickReportAssistantProps {
  /** Where suggestions come from. Must resolve with the best draft it has; never throw for "unavailable". */
  assist: (messages: string[], options: { locationAnswer?: string }) => Promise<{ draft: AssistantDraft; degraded?: string }>;
  /** Saves the report. Throw an Error with a readable message to show it and stay on the review. */
  onSubmit: (values: QuickReportValues, draft: AssistantDraft) => Promise<void>;
  /** Explore Mode: the places to choose from, instead of typing one. */
  locationOptions?: { id: string; name: string }[];
  /** Maps the place the assistant found to an option id. */
  resolveLocationId?: (placeText: string) => string;
  /** The page's own duplicate / similar-report check. */
  renderDuplicateCheck?: (c: { title: string; category: string; location: string; locationId: string; value: string; onChange: (v: string) => void }) => React.ReactNode;
  /** Suggestions are made by rules in the browser and nothing is saved (Explore Mode). */
  simulated?: boolean;
  submitLabel?: string;
  footnote?: string;
}

const GREETING = "What problem are you experiencing on campus? Describe it in your own words, and say where it is if you can.";
/** Follow-up rounds before the assistant stops asking and shows its best draft. */
const MAX_ROUNDS = 2;

/**
 * Quick report with an assistant. The student describes the problem; the
 * assistant asks what is missing, suggests a category and priority, and
 * prepares a draft. Nothing is submitted until the student has reviewed
 * the draft, edited whatever is wrong and pressed Submit.
 */
export default function QuickReportAssistant({
  assist,
  onSubmit,
  locationOptions,
  resolveLocationId,
  renderDuplicateCheck,
  simulated = false,
  submitLabel = "Submit issue",
  footnote = "Nothing is sent until you press submit. To attach photos, use the full form.",
}: QuickReportAssistantProps) {
  const [bubbles, setBubbles] = useState<Bubble[]>([{ from: "assistant", text: GREETING }]);
  const [messages, setMessages] = useState<string[]>([]);
  const [locationAnswer, setLocationAnswer] = useState("");
  const [asked, setAsked] = useState<Asked>("description");
  const [rounds, setRounds] = useState(0);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [degraded, setDegraded] = useState<string | undefined>();

  const [draft, setDraft] = useState<AssistantDraft | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("General");
  const [priority, setPriority] = useState<Priority>("Low");
  const [location, setLocation] = useState("");
  const [locationId, setLocationId] = useState("");
  const [duplicateOf, setDuplicateOf] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const submitIsSlow = useSlowNotice(submitting);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [bubbles.length, thinking]);

  const say = (b: Bubble) => setBubbles((list) => [...list, b]);

  function openReview(d: AssistantDraft) {
    setDraft(d);
    setTitle(d.title);
    setDescription(d.description);
    setCategory(d.category);
    setPriority(d.priority);
    setLocation(d.location);
    setLocationId(locationOptions ? (resolveLocationId?.(d.location) ?? "") : "");
    setDuplicateOf("");
    setError("");
  }

  /** Ask for the most useful missing piece, or fall through to the review. */
  function nextStep(d: AssistantDraft, roundsSoFar: number) {
    if (d.safetyFlags.length > 0) {
      say({ from: "assistant", text: `${d.safetyFlags.join(". ")}. ${SAFETY_ADVICE}` });
    }
    const wantsLocation = d.missingInformation.includes("location");
    const question = (wantsLocation && d.clarifyingQuestions.find((q) => /where/i.test(q))) || d.clarifyingQuestions[0];
    if (question && roundsSoFar < MAX_ROUNDS) {
      const kind: Asked = wantsLocation && /where/i.test(question) ? "location" : d.missingInformation.includes("focus") ? "focus" : "detail";
      setAsked(kind);
      setRounds(roundsSoFar + 1);
      say({ from: "assistant", text: question });
      return;
    }
    say({ from: "assistant", text: "Here is a draft report. Check each field, change anything that is wrong, and submit when it looks right." });
    openReview(d);
  }

  async function handleSend(e?: React.FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || thinking) return;
    if (text.length > LIMITS.description) {
      setError(`Please keep a message under ${LIMITS.description} characters.`);
      return;
    }
    setError("");
    setInput("");
    say({ from: "student", text });

    let nextMessages = messages;
    let nextLocation = locationAnswer;
    if (asked === "location") {
      nextLocation = text;
      setLocationAnswer(text);
    } else {
      nextMessages = [...messages, text].slice(-ASSISTANT_LIMITS.maxMessages);
      setMessages(nextMessages);
    }

    setThinking(true);
    try {
      const result = await assist(nextMessages, { locationAnswer: nextLocation || undefined });
      setDegraded(result.degraded);
      const d = result.draft;
      if (d.refusal) {
        // Don't keep text the assistant can't use.
        if (asked !== "location") setMessages(messages);
        say({ from: "assistant", text: d.refusal });
        setAsked("description");
        return;
      }
      nextStep(d, rounds);
    } catch {
      say({ from: "assistant", text: "I couldn't read that just now. You can try again, or use the full form." });
    } finally {
      setThinking(false);
    }
  }

  /** Stop asking and review what there is. */
  async function skipQuestions() {
    if (messages.length === 0 || thinking) return;
    setThinking(true);
    try {
      const result = await assist(messages, { locationAnswer: locationAnswer || undefined });
      setDegraded(result.degraded);
      if (result.draft.refusal) say({ from: "assistant", text: result.draft.refusal });
      else openReview(result.draft);
    } catch {
      say({ from: "assistant", text: "I couldn't read that just now. You can try again, or use the full form." });
    } finally {
      setThinking(false);
    }
  }

  async function handleSubmit() {
    if (!draft || submitting) return;
    if (title.trim().length < 3) return setError("Give the problem a short title.");
    if (description.trim().length < 10) return setError("Describe what is wrong in at least a few words.");
    if (locationOptions && !locationId) return setError("Choose where the problem is.");
    setSubmitting(true);
    setError("");
    try {
      await onSubmit(
        {
          title: title.trim(),
          description: description.trim(),
          location: locationOptions ? (locationOptions.find((o) => o.id === locationId)?.name ?? "") : location.trim(),
          locationId,
          category,
          priority,
          confidence: draft.confidence,
          duplicateOf,
        },
        draft
      );
    } catch (err) {
      // Stay on the review step so the same report can simply be retried.
      setError(err instanceof Error && err.message ? err.message : "Unable to submit your issue right now. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const sourceNote = simulated
    ? "Demo: suggested by built-in keyword rules running in your browser (simulated). It can be wrong; check it."
    : draft?.source === "model"
      ? "Suggested by an AI model from what you wrote. It can be wrong; check it."
      : "Suggested by keyword rules from what you wrote. It can be wrong; check it.";

  if (draft) {
    return (
      <div className="max-w-2xl space-y-4" data-testid="quick-review">
        <section aria-labelledby="quick-review" className="rounded-lg border border-border bg-surface">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
            <h2 id="quick-review" className="text-sm font-semibold text-fg">
              Review before submitting
            </h2>
            <Button variant="ghost" size="sm" onClick={() => setDraft(null)} disabled={submitting}>
              Back to chat
            </Button>
          </div>

          <div className="space-y-4 px-4 py-4 sm:px-5">
            {draft.safetyFlags.length > 0 && (
              <Notice tone="danger" title="This may be a safety hazard">
                <span className="flex items-start gap-2">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>
                    {draft.safetyFlags.join(". ")}. {SAFETY_ADVICE}
                  </span>
                </span>
              </Notice>
            )}

            <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={LIMITS.title} />
            <Textarea label="What is wrong" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} maxLength={LIMITS.description} hint="Your own words. Edit them if anything is missing." />
            {locationOptions ? (
              <Select
                label="Location"
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                hint={locationId ? "Picked from your message when it names a known place. Check it." : "Choose where the problem is."}
              >
                <option value="">Choose a place…</option>
                {locationOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </Select>
            ) : (
              <Input
                label="Location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                maxLength={LIMITS.location}
                hint={draft.locationSource === "unknown" && !location ? "Not given. Add a block, room or landmark so a worker can find it." : "As you described it. Change it if it is not right."}
              />
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Select label="Category" value={category} onChange={(e) => setCategory(e.target.value)}>
                {ISSUE_CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
              <Select label="Priority" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
                {PRIORITIES.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </Select>
            </div>
            <p className="flex items-start gap-1.5 text-[13px] text-fg-muted">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-fg" aria-hidden="true" />
              <span>
                {sourceNote} {draft.explanation} Handled by {departmentFor(category)}.
                {draft.confidence < 0.55 && " Confidence is low, so please check the category."}
              </span>
            </p>
            {!simulated && degraded && degraded !== "unavailable" && degraded !== "signed-out" && (
              <p className="text-xs text-fg-subtle">The AI service was not used for this suggestion ({degraded.replace("-", " ")}); the built-in rules were.</p>
            )}
          </div>
        </section>

        {renderDuplicateCheck?.({ title, category, location, locationId, value: duplicateOf, onChange: setDuplicateOf })}

        {error && (
          <Notice tone="danger" title="Couldn't submit">
            {error}
          </Notice>
        )}
        {submitIsSlow && (
          <Notice tone="warning" title="Still trying to reach the server">
            Your issue hasn&apos;t been saved yet; keep this page open.
          </Notice>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={() => setDraft(null)} disabled={submitting}>
            Back
          </Button>
          <Button onClick={handleSubmit} isLoading={submitting}>
            {duplicateOf ? "Submit and link report" : submitLabel}
          </Button>
        </div>
        <p className="text-xs text-fg-subtle">{footnote}</p>
      </div>
    );
  }

  return (
    <section aria-label="Report assistant" className="max-w-2xl rounded-lg border border-border bg-surface">
      <div ref={logRef} role="log" aria-live="polite" aria-label="Conversation with the report assistant" className="max-h-[26rem] min-h-[10rem] space-y-3 overflow-y-auto px-4 py-4 sm:px-5">
        {bubbles.map((b, i) => (
          <div key={i} className={cn("flex gap-2", b.from === "student" ? "justify-end" : "justify-start")}>
            {b.from === "assistant" && <Bot className="mt-1 h-4 w-4 shrink-0 text-brand-fg" aria-hidden="true" />}
            <p
              className={cn(
                "max-w-[85%] whitespace-pre-wrap break-words rounded-lg px-3 py-2 text-sm",
                b.from === "student" ? "bg-brand text-on-brand" : "border border-border bg-surface-2 text-fg"
              )}
            >
              <span className="sr-only">{b.from === "student" ? "You: " : "Assistant: "}</span>
              {b.text}
            </p>
            {b.from === "student" && <User className="mt-1 h-4 w-4 shrink-0 text-fg-subtle" aria-hidden="true" />}
          </div>
        ))}
        {thinking && (
          <p className="text-[13px] text-fg-subtle" role="status">
            Reading your message…
          </p>
        )}
      </div>

      <form onSubmit={handleSend} noValidate className="space-y-3 border-t border-border p-3 sm:p-4">
        <Textarea
          label={asked === "location" ? "Where is it?" : asked === "description" ? "Your message" : "Your answer"}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") void handleSend();
          }}
          rows={3}
          maxLength={LIMITS.description}
          placeholder={asked === "location" ? "e.g. Block 4, second floor, near the stairs" : "e.g. The fan in my classroom is not working."}
          hint={
            simulated
              ? "Demo: suggestions are simulated with built-in rules and nothing leaves your browser. Ctrl or ⌘ + Enter sends."
              : "Ctrl or ⌘ + Enter sends. You stay in control: nothing is submitted until you review the draft."
          }
          disabled={thinking}
        />
        {error && <Notice tone="danger">{error}</Notice>}
        <div className="flex flex-wrap items-center justify-between gap-2">
          {messages.length > 0 ? (
            <Button type="button" variant="ghost" size="sm" onClick={skipQuestions} disabled={thinking}>
              Skip questions and review
            </Button>
          ) : (
            <span />
          )}
          <Button type="submit" icon={<Send className="h-4 w-4" aria-hidden="true" />} isLoading={thinking} disabled={!input.trim()}>
            Send
          </Button>
        </div>
      </form>
    </section>
  );
}
