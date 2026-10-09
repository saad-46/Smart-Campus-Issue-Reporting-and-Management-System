"use client";

// Explore counterparts of the signed-in issue panels (components/issue/
// AdminIssueControls, IncidentPanel and the Discussion on the issue page).
// Same controls, wording and rules; the actions go to the demo engine.

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Layers, Lock, MessageSquare, Send, Siren, UserPlus } from "lucide-react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { DescriptionList } from "@/components/ui/Data";
import Panel from "@/components/issue/Panel";
import { DUPLICATE_WINDOW_DAYS, findDuplicates } from "@/lib/intelligence/similarity";
import { LIMITS } from "@/lib/constants";
import { DemoIssue } from "@/lib/viewer/demoData";
import { formatDate, formatTime } from "@/lib/dates";
import { cn } from "@/lib/cn";
import { useViewer } from "./viewerContext";

const ROLE_LABEL = { student: "Student", worker: "Worker", admin: "Admin" } as const;

/** Assign, escalate and unassign: what an administrator can do to an issue. */
export function ManagePanel({ issue, onAssign }: { issue: DemoIssue; onAssign: () => void }) {
  const { workerName, setEscalation, unassignIssue } = useViewer();
  const [confirmUnassign, setConfirmUnassign] = useState(false);
  const resolved = issue.status === "Resolved";
  const assignee = issue.assignedTo ? workerName(issue.assignedTo) : null;

  return (
    <Panel title="Manage issue" description="Demo only: nothing is saved.">
      <DescriptionList
        items={[
          { label: "Assigned to", value: assignee ?? <span className="text-fg-subtle">Unassigned</span> },
          {
            label: "Escalation",
            value: issue.escalated ? (
              <Badge tone="danger" icon={<Siren aria-hidden="true" />}>
                Escalated
              </Badge>
            ) : (
              <span className="text-fg-subtle">Not escalated</span>
            ),
          },
        ]}
      />
      {!resolved ? (
        <div className="mt-4 flex flex-wrap gap-2" data-tour="issue-assign">
          <Button size="sm" icon={<UserPlus className="h-3.5 w-3.5" aria-hidden="true" />} onClick={onAssign}>
            {issue.assignedTo ? "Reassign worker" : "Assign worker"}
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setEscalation(issue.id, !issue.escalated)}>
            {issue.escalated ? "Clear escalation" : "Escalate"}
          </Button>
          {issue.assignedTo && (
            <Button size="sm" variant="ghost" onClick={() => setConfirmUnassign(true)}>
              Unassign
            </Button>
          )}
        </div>
      ) : (
        <p className="mt-3 text-xs text-fg-subtle" data-tour="issue-assign">
          Resolved issues can&apos;t be reassigned or escalated.
        </p>
      )}
      <ConfirmDialog
        open={confirmUnassign}
        title="Unassign this issue?"
        description={`${assignee ?? "The current assignee"} will no longer see it in their tasks.${issue.status === "Open" ? " It returns to the open pool for any worker to claim." : " It will need a new assignee to be finished."}`}
        confirmLabel="Unassign"
        tone="danger"
        onConfirm={() => {
          unassignIssue(issue.id);
          setConfirmUnassign(false);
        }}
        onCancel={() => setConfirmUnassign(false)}
      />
    </Panel>
  );
}

/** The incident an issue belongs to, and similar open reports an administrator can link. */
export function RelatedPanel({ issue }: { issue: DemoIssue }) {
  const { data, role, linkIssue, unlinkIssue } = useViewer();
  const [confirmUnlink, setConfirmUnlink] = useState(false);
  const issues = useMemo(() => data?.issues ?? [], [data]);
  const admin = role === "admin";
  const master = issue.duplicateOf ? issues.find((i) => i.id === issue.duplicateOf) : undefined;
  const members = issue.duplicateOf ? [] : issues.filter((i) => i.duplicateOf === issue.id);
  const hasMembers = members.length > 0;

  const similar = useMemo(() => {
    if (!data || issue.status === "Resolved") return [];
    const since = data.now.getTime() - DUPLICATE_WINDOW_DAYS * 86_400_000;
    const pool = issues.filter((i) => i.id !== issue.id && i.duplicateOf !== issue.id && i.id !== issue.duplicateOf && i.createdAt.getTime() >= since);
    return findDuplicates(issue, pool, data.now);
  }, [data, issues, issue]);

  if (!issue.duplicateOf && !hasMembers && similar.length === 0 && issue.status === "Resolved") return null;

  return (
    <Panel title="Related reports" description={issue.duplicateOf || hasMembers ? undefined : "Reports of the same problem can be grouped into one incident."}>
      <div className="space-y-3">
        {issue.duplicateOf ? (
          <div className="rounded-md border border-brand-subtle-border bg-brand-subtle px-3 py-2.5 text-sm">
            <p className="flex items-center gap-1.5 font-medium text-fg">
              <Layers className="h-3.5 w-3.5 text-brand-fg" aria-hidden="true" />
              Part of a larger incident
            </p>
            <p className="mt-1 text-[13px] text-fg-muted">
              Linked to{" "}
              <Link href={`/viewer/issues/${issue.duplicateOf}`} className="font-medium text-brand-fg hover:underline">
                {master?.title ?? "the main report"}
              </Link>
              . This report keeps its own status and updates.
            </p>
            {admin && (
              <Button variant="ghost" size="sm" className="-ml-2 mt-1 text-danger hover:text-danger" onClick={() => setConfirmUnlink(true)}>
                Remove from incident
              </Button>
            )}
          </div>
        ) : hasMembers ? (
          <div>
            <p className="flex items-center gap-1.5 text-sm font-medium text-fg">
              <Layers className="h-3.5 w-3.5 text-brand-fg" aria-hidden="true" />
              Main report · {members.length + 1} reports in this incident
            </p>
            <ul className="mt-2 divide-y divide-border rounded-md border border-border">
              {members.map((m) => (
                <li key={m.id} className="px-3 py-2">
                  <Link href={`/viewer/issues/${m.id}`} className="block truncate text-[13px] text-fg hover:text-brand-fg hover:underline">
                    {m.title}
                  </Link>
                  <p className="text-xs text-fg-subtle">
                    {formatDate(m.createdAt)} · {m.status}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {issue.status !== "Resolved" &&
          (similar.length === 0 ? (
            <p className="text-[13px] text-fg-subtle">No similar open reports in the last {DUPLICATE_WINDOW_DAYS} days.</p>
          ) : (
            <div>
              <p className="mb-2 text-[13px] text-fg-muted">Possibly the same problem — similar wording and place. Please verify before linking.</p>
              <ul className="space-y-2">
                {similar.map(({ issue: other, score }) => {
                  const target = other.duplicateOf || other.id;
                  return (
                    <li key={other.id} className="rounded-md border border-border px-3 py-2.5">
                      <Link href={`/viewer/issues/${other.id}`} className="block break-words text-sm text-fg hover:text-brand-fg hover:underline">
                        {other.title}
                      </Link>
                      <p className="mt-0.5 text-xs text-fg-subtle">
                        {other.location} · {formatDate(other.createdAt)} · {other.status} · {Math.round(score * 100)}% similar
                      </p>
                      {admin && !issue.duplicateOf && (
                        <Button
                          variant="tertiary"
                          size="sm"
                          className="-ml-2 mt-1"
                          onClick={() => linkIssue(issue.id, target)}
                          disabled={hasMembers}
                          title={hasMembers ? "This report already has linked reports; link those to the other incident instead." : undefined}
                        >
                          Link this report to that incident
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
      </div>

      <ConfirmDialog
        open={confirmUnlink}
        title="Remove from incident?"
        description="This report will be tracked on its own again. Nothing else changes."
        confirmLabel="Remove link"
        tone="danger"
        onConfirm={() => {
          unlinkIssue(issue.id);
          setConfirmUnlink(false);
        }}
        onCancel={() => setConfirmUnlink(false)}
      />
    </Panel>
  );
}

/** Messages between the reporter and campus staff. */
export function DiscussionPanel({ issue }: { issue: DemoIssue }) {
  const { role, messagesFor, postMessage } = useViewer();
  const messages = messagesFor(issue.id);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const logRef = useRef<HTMLDivElement>(null);
  const canChat = role !== "student" || issue.mine;

  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages.length]);

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    const problem = postMessage(issue.id, text);
    setError(problem ?? "");
    if (!problem) setText("");
  };

  return (
    <Panel title="Discussion" description={canChat ? "Visible to the reporter, workers and administrators. Demo messages last until you leave." : undefined} flush>
      {!canChat ? (
        <div className="flex items-start gap-3 border-t border-border px-4 py-5 text-[13px] text-fg-subtle">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          The discussion is private to the person who reported this issue and campus staff.
        </div>
      ) : (
        <>
          <div ref={logRef} role="log" aria-live="polite" aria-label="Messages" className="max-h-[26rem] min-h-[8rem] space-y-4 overflow-y-auto border-t border-border px-4 py-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center py-6 text-center">
                <MessageSquare className="h-5 w-5 text-fg-subtle" aria-hidden="true" />
                <p className="mt-2 text-[13px] text-fg-subtle">No messages yet. Ask a question or add details here.</p>
              </div>
            ) : (
              messages.map((msg) => {
                const isMe = msg.authorRole === role;
                return (
                  <div key={msg.id} className={cn("flex max-w-[85%] flex-col", isMe ? "ml-auto items-end" : "items-start")}>
                    <p className="mb-1 flex items-center gap-1.5 px-0.5 text-xs text-fg-subtle">
                      <span className="font-medium text-fg-muted">{isMe ? "You" : msg.authorName}</span>
                      {!isMe && msg.authorRole !== "student" && <Badge tone="info">{ROLE_LABEL[msg.authorRole]}</Badge>}
                      <time dateTime={msg.at.toISOString()}>{formatTime(msg.at)}</time>
                    </p>
                    <div className={cn("max-w-full whitespace-pre-wrap break-words rounded-lg px-3 py-2 text-sm", isMe ? "bg-brand text-on-brand" : "border border-border bg-surface-2 text-fg")}>{msg.text}</div>
                  </div>
                );
              })
            )}
          </div>
          {error && (
            <p role="alert" className="border-t border-danger-border bg-danger-subtle px-4 py-2 text-[13px] text-danger">
              {error}
            </p>
          )}
          <form onSubmit={send} className="flex gap-2 border-t border-border p-3">
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={LIMITS.chatMessage}
              aria-label="Message"
              placeholder="Write a message…"
              autoComplete="off"
              className="h-9 min-w-0 flex-1 rounded-md border border-border bg-surface px-3 text-sm text-fg placeholder:text-fg-subtle transition-[border-color,box-shadow] hover:border-border-strong focus:border-brand focus:outline-none focus:ring-3 focus:ring-brand/15"
            />
            <Button type="submit" disabled={!text.trim()} aria-label="Send message" icon={<Send className="h-3.5 w-3.5" aria-hidden="true" />}>
              Send
            </Button>
          </form>
        </>
      )}
    </Panel>
  );
}
