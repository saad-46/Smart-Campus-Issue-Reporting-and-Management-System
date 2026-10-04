"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, Lock, MapPin, MessageSquare, SendHorizontal, Siren } from "lucide-react";
import { useAuthContext } from "@/components/AuthProvider";
import AdminIssueControls from "@/components/issue/AdminIssueControls";
import AnalysisPanel from "@/components/issue/AnalysisPanel";
import FeedbackPanel from "@/components/issue/FeedbackPanel";
import IncidentPanel from "@/components/issue/IncidentPanel";
import IssueTimeline from "@/components/issue/IssueTimeline";
import Panel from "@/components/issue/Panel";
import { SlaMeter } from "@/components/issue/SlaBadge";
import ImageModal from "@/components/ImageModal";
import Badge, { PriorityBadge, StatusBadge } from "@/components/ui/Badge";
import Button, { IconButton } from "@/components/ui/Button";
import { DescriptionList } from "@/components/ui/Data";
import { ErrorState, EmptyState, Skeleton, SkeletonLines } from "@/components/ui/States";
import { Actor, getIssueImages, subscribeToSingleIssue } from "@/lib/firestore";
import { subscribeToIssueChat, sendChatMessage } from "@/services/chatService";
import { Issue, ChatMessage } from "@/types";
import { LIMITS } from "@/lib/constants";
import { formatDate, formatRelative, formatTime } from "@/lib/dates";
import { getFriendlyErrorMessage, logError } from "@/lib/errors";
import { dashboardPathForRole } from "@/lib/roles";
import { cn } from "@/lib/cn";

const ROLE_NAMES = { user: "Reporter", worker: "Worker", admin: "Admin" } as const;

function IssueSkeleton() {
  return (
    <div role="status" aria-label="Loading issue">
      <Skeleton className="h-4 w-28" />
      <div className="mt-4 flex gap-2">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <Skeleton className="mt-3 h-7 w-2/3" />
      <Skeleton className="mt-2 h-4 w-1/3" />
      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          <div className="rounded-lg border border-border bg-surface p-5">
            <SkeletonLines lines={4} />
          </div>
          <div className="rounded-lg border border-border bg-surface p-5">
            <SkeletonLines lines={3} />
          </div>
        </div>
        <div className="rounded-lg border border-border bg-surface p-5">
          <SkeletonLines lines={5} />
        </div>
      </div>
    </div>
  );
}

export default function IssueDetailPage() {
  const { id } = useParams() as { id: string };
  const { userProfile, activeRole, isAdmin } = useAuthContext();
  const router = useRouter();
  const isStaff = activeRole === "admin" || activeRole === "worker";
  const adminId = isAdmin ? userProfile?.id ?? "" : "";
  // Memoised so child effects don't restart on every render.
  const adminActor = useMemo<Actor | null>(() => (adminId ? { id: adminId, role: "admin" } : null), [adminId]);

  const [issue, setIssue] = useState<Issue | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [chatError, setChatError] = useState("");
  const [sending, setSending] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setLoadError("");
    return subscribeToSingleIssue(
      id,
      (fetched) => {
        setIssue(fetched);
        setLoading(false);
      },
      (err) => {
        logError("subscribeToSingleIssue", err);
        setLoadError(getFriendlyErrorMessage(err, "We couldn't load this issue. Please try again."));
        setLoading(false);
      }
    );
  }, [id, retryKey]);

  // Full-size photos are separate documents, loaded once per issue (not per
  // snapshot); the thumbnails on the issue are shown until they arrive.
  const latestIssue = useRef(issue);
  useEffect(() => {
    latestIssue.current = issue;
  });
  const [fullImages, setFullImages] = useState<string[]>([]);
  const imageCount = issue?.imageCount ?? 0;
  const issueId = issue?.id;
  useEffect(() => {
    setFullImages([]);
    const current = latestIssue.current;
    if (!current || imageCount === 0) return;
    let cancelled = false;
    getIssueImages(current)
      .then((loaded) => {
        if (!cancelled) setFullImages(loaded);
      })
      .catch((err) => logError("getIssueImages", err));
    return () => {
      cancelled = true;
    };
  }, [issueId, imageCount]);
  const displayImages = (issue?.thumbnails ?? []).map((thumb, i) => fullImages[i] ?? thumb);

  // The thread is private to the issue's author and staff (the security
  // rules enforce this; the check here just avoids a doomed subscription).
  const issueAuthor = issue?.createdBy;
  const canChat = !!userProfile && !!issueAuthor && (userProfile.id === issueAuthor || activeRole === "worker" || activeRole === "admin");

  useEffect(() => {
    if (!id || !canChat) return;
    setChatError("");
    return subscribeToIssueChat(id, setMessages, (err) => {
      logError("subscribeToIssueChat", err);
      setChatError(getFriendlyErrorMessage(err, "We couldn't load the discussion."));
    });
  }, [id, canChat]);

  // Keep the newest message in view inside the thread (not the page).
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = chatInput.trim();
    if (!text || !userProfile || !issue || sending) return;
    setSending(true);
    setChatError("");
    try {
      await sendChatMessage(id, text, userProfile.id, userProfile.name, activeRole);
      setChatInput(""); // only cleared once the message is actually saved
    } catch (err) {
      logError("sendChatMessage", err);
      setChatError(getFriendlyErrorMessage(err, "Your message couldn't be sent. Please try again."));
    } finally {
      setSending(false);
    }
  };

  const back = (
    <button type="button" onClick={() => (window.history.length > 1 ? router.back() : router.push(dashboardPathForRole(activeRole)))} className="inline-flex items-center gap-1 rounded text-[13px] text-fg-subtle transition-colors hover:text-fg">
      <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
      Back
    </button>
  );

  if (loading) return <IssueSkeleton />;

  if (!issue) {
    return (
      <div>
        {back}
        <div className="mt-6 rounded-lg border border-border bg-surface">
          {loadError ? (
            <ErrorState title="Couldn't load this issue" description={loadError} onRetry={() => setRetryKey((k) => k + 1)} />
          ) : (
            <EmptyState title="Issue not found" description="It may have been withdrawn by the reporter or removed by an administrator." />
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        {back}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <StatusBadge status={issue.status} />
          <PriorityBadge priority={issue.priority} />
          <Badge>{issue.category}</Badge>
          {issue.escalated && issue.status !== "Resolved" && (
            <Badge tone="danger" icon={<Siren aria-hidden="true" />}>
              Escalated
            </Badge>
          )}
        </div>
        <h1 className="mt-2.5 break-words text-xl font-semibold tracking-tight text-fg sm:text-2xl">{issue.title}</h1>
        <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-fg-subtle">
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
            {issue.location}
          </span>
          <span aria-hidden="true">·</span>
          <span>
            Reported by {issue.createdByName} {formatRelative(issue.createdAt)}
          </span>
        </p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:grid-rows-[auto_1fr]">
        {/* Primary details: first on phones, top of the right rail on desktop */}
        <div className="space-y-4 lg:col-start-2 lg:row-start-1">
          <Panel title="Details">
            <div className="space-y-4">
              <div>
                <p className="mb-1.5 text-xs text-fg-subtle">Deadline</p>
                <SlaMeter issue={issue} />
              </div>
              <DescriptionList
                items={[
                  { label: "Status", value: <StatusBadge status={issue.status} /> },
                  { label: "Reported", value: `${formatDate(issue.createdAt)} · ${formatTime(issue.createdAt)}` },
                  ...(issue.resolvedAt ? [{ label: "Resolved", value: `${formatDate(issue.resolvedAt)} · ${formatTime(issue.resolvedAt)}` }] : []),
                  { label: "Reference", value: <span className="tabular font-mono text-xs">#{issue.id.slice(0, 8)}</span> },
                ]}
              />
            </div>
          </Panel>
          {adminActor && <AdminIssueControls issue={issue} admin={adminActor} />}
          {userProfile && <FeedbackPanel issue={issue} userId={userProfile.id} isAdmin={isAdmin} />}
        </div>

        {/* Main content */}
        <div className="min-w-0 space-y-6 lg:col-start-1 lg:row-span-2 lg:row-start-1">
          <Panel title="Description">
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-fg">{issue.description}</p>
            {displayImages.length > 0 && (
              <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {displayImages.map((url, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => setSelectedImageUrl(url)}
                      aria-label={`Enlarge photo ${i + 1}`}
                      className="group block aspect-[4/3] w-full overflow-hidden rounded-md border border-border bg-surface-2"
                    >
                      <img src={url} alt="" className="h-full w-full cursor-zoom-in object-cover transition-opacity duration-150 group-hover:opacity-90" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <IssueTimeline issue={issue} />

          <Panel
            title="Discussion"
            description={canChat ? "Visible to the reporter, workers and administrators." : undefined}
            flush
          >
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
                      const isMe = msg.authorId === userProfile?.id;
                      return (
                        <div key={msg.id} className={cn("flex max-w-[85%] flex-col", isMe ? "ml-auto items-end" : "items-start")}>
                          <p className="mb-1 flex items-center gap-1.5 px-0.5 text-xs text-fg-subtle">
                            <span className="font-medium text-fg-muted">{isMe ? "You" : msg.authorName}</span>
                            {!isMe && msg.authorRole !== "user" && <Badge tone="info">{ROLE_NAMES[msg.authorRole]}</Badge>}
                            <time dateTime={msg.createdAt.toISOString()}>{formatTime(msg.createdAt)}</time>
                          </p>
                          <div
                            className={cn(
                              "max-w-full whitespace-pre-wrap break-words rounded-lg px-3 py-2 text-sm",
                              isMe ? "bg-brand text-on-brand" : "border border-border bg-surface-2 text-fg"
                            )}
                          >
                            {msg.text}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
                {chatError && (
                  <p role="alert" className="border-t border-danger-border bg-danger-subtle px-4 py-2 text-[13px] text-danger">
                    {chatError}
                  </p>
                )}
                <form onSubmit={handleSend} className="flex gap-2 border-t border-border p-3">
                  <label htmlFor="chat-input" className="sr-only">
                    Message
                  </label>
                  <input
                    id="chat-input"
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Write a message…"
                    maxLength={LIMITS.chatMessage}
                    autoComplete="off"
                    className="h-9 min-w-0 flex-1 rounded-md border border-border bg-surface px-3 text-sm text-fg placeholder:text-fg-subtle transition-[border-color,box-shadow] hover:border-border-strong focus:border-brand focus:outline-none focus:ring-3 focus:ring-brand/15"
                  />
                  <Button type="submit" disabled={!chatInput.trim()} isLoading={sending} className="max-sm:hidden">
                    Send
                  </Button>
                  <IconButton type="submit" label="Send message" variant="primary" disabled={!chatInput.trim() || sending} className="sm:hidden">
                    <SendHorizontal className="h-4 w-4" aria-hidden="true" />
                  </IconButton>
                </form>
              </>
            )}
          </Panel>
        </div>

        {/* Secondary context */}
        <div className="space-y-4 lg:col-start-2 lg:row-start-2">
          <AnalysisPanel issue={issue} showConfidence={isStaff} />
          <IncidentPanel issue={issue} admin={adminActor} />
        </div>
      </div>

      {selectedImageUrl && <ImageModal imageUrl={selectedImageUrl} alt={`Photo attached to ${issue.title}`} onClose={() => setSelectedImageUrl(null)} />}
    </div>
  );
}
