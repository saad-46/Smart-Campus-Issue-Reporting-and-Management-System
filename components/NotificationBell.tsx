"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, BellOff, CheckCheck } from "lucide-react";
import { useAuthContext } from "./AuthProvider";
import { useNotifications } from "@/hooks/useNotifications";
import { markAllNotificationsRead, markNotificationRead, renderNotification } from "@/lib/notifications";
import { formatRelative } from "@/lib/dates";
import { getFriendlyErrorMessage, logError } from "@/lib/errors";
import { cn } from "@/lib/cn";
import { Segmented } from "@/components/ui/Tabs";
import { SkeletonRows, EmptyState } from "@/components/ui/States";

/**
 * Notification centre: bell with a small unread count, and a panel with
 * All / Unread, mark read, mark all read and open-the-related-item.
 * Escape or a click outside closes it and focus returns to the bell.
 */
export default function NotificationBell() {
  const { userProfile } = useAuthContext();
  const router = useRouter();
  const { items, unread, loading, error } = useNotifications(userProfile?.id);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [actionError, setActionError] = useState("");
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const emptyRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef(new Map<string, HTMLButtonElement>());
  // Where keyboard focus should land once the live list reflects a "mark read".
  const [pendingFocus, setPendingFocus] = useState<{ id: string | null; next: string | null; prev: string | null } | null>(null);

  const shown = filter === "unread" ? items.filter((n) => !n.readAt) : items;

  useEffect(() => {
    if (!pendingFocus) return;
    const marked = pendingFocus.id ? shown.find((n) => n.id === pendingFocus.id) : undefined;
    const settled = pendingFocus.id ? !marked || !!marked.readAt : shown.every((n) => n.readAt);
    if (!settled) return; // the listener hasn't delivered the change yet
    const target =
      (marked && itemRefs.current.get(marked.id)) ||
      (pendingFocus.next && itemRefs.current.get(pendingFocus.next)) ||
      (pendingFocus.prev && itemRefs.current.get(pendingFocus.prev)) ||
      (shown[0] && itemRefs.current.get(shown[0].id)) ||
      emptyRef.current;
    target?.focus();
    setPendingFocus(null);
  }, [pendingFocus, shown]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onClick = (e: MouseEvent) => {
      if (!panelRef.current?.contains(e.target as Node) && !buttonRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  if (!userProfile) return null;

  const markOne = (id: string) => {
    setActionError("");
    const index = shown.findIndex((n) => n.id === id);
    setPendingFocus({ id, next: shown[index + 1]?.id ?? null, prev: shown[index - 1]?.id ?? null });
    markNotificationRead(id).catch((err) => {
      logError("markNotificationRead", err);
      setPendingFocus(null);
      setActionError(getFriendlyErrorMessage(err, "Couldn't update notifications."));
    });
  };

  const openItem = (id: string, href: string, isUnread: boolean) => {
    setOpen(false);
    if (isUnread) markNotificationRead(id).catch((err) => logError("markNotificationRead", err));
    router.push(href);
  };

  const markAll = async () => {
    if (unread === 0) return;
    setActionError("");
    // In the Unread view every item disappears: land on the first remaining item or the empty message.
    if (filter === "unread") setPendingFocus({ id: null, next: null, prev: null });
    try {
      await markAllNotificationsRead(items.filter((n) => !n.readAt).map((n) => n.id));
    } catch (err) {
      logError("markAllNotificationsRead", err);
      setPendingFocus(null);
      setActionError(getFriendlyErrorMessage(err, "Couldn't update notifications."));
    }
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        className={cn(
          "relative inline-flex h-9 w-9 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-surface-hover hover:text-fg",
          open && "bg-surface-hover text-fg"
        )}
      >
        <Bell className="h-[18px] w-[18px]" aria-hidden="true" />
        {unread > 0 && (
          <span
            aria-hidden="true"
            className="tabular absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-semibold leading-none text-on-brand ring-2 ring-surface"
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Notifications"
          // Anchored to the viewport, not the bell, so it can never run off-screen.
          className="fixed left-2 right-2 top-[3.75rem] z-[60] flex max-h-[min(32rem,calc(100dvh-5rem))] flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-lg animate-pop-in sm:left-auto sm:right-4 sm:w-[24rem]"
        >
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <h2 className="text-[15px] font-semibold text-fg">Notifications</h2>
            <button
              type="button"
              onClick={markAll}
              // aria-disabled (not disabled) so keyboard focus stays here after marking everything read.
              aria-disabled={unread === 0 || undefined}
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[13px] font-medium text-brand-fg transition-colors hover:bg-brand-subtle aria-disabled:cursor-default aria-disabled:text-fg-subtle aria-disabled:hover:bg-transparent"
            >
              <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Mark all as read
            </button>
          </div>
          <div className="px-4 pt-3">
            <Segmented
              label="Filter notifications"
              size="sm"
              value={filter}
              onChange={setFilter}
              options={[
                { value: "all", label: "All" },
                { value: "unread", label: `Unread${unread ? ` (${unread})` : ""}` },
              ]}
            />
          </div>
          {actionError && <p role="alert" className="px-4 pt-2 text-[13px] text-danger">{actionError}</p>}
          <div className="min-h-0 flex-1 overflow-y-auto py-2">
            {loading ? (
              <SkeletonRows rows={3} label="Loading notifications" />
            ) : error ? (
              <p role="alert" className="px-4 py-8 text-center text-sm text-fg-muted">Notifications couldn&apos;t be loaded right now.</p>
            ) : shown.length === 0 ? (
              <div ref={emptyRef} tabIndex={-1} className="outline-none">
                <EmptyState
                  compact
                  icon={<BellOff />}
                  title={filter === "unread" ? "You're all caught up" : "No notifications yet"}
                  description={filter === "unread" ? undefined : "Updates about your issues and tasks will appear here."}
                />
              </div>
            ) : (
              <ul>
                {shown.map((n) => {
                  const r = renderNotification(n);
                  const isUnread = !n.readAt;
                  return (
                    <li key={n.id} className="group relative">
                      <button
                        type="button"
                        ref={(el) => {
                          if (el) itemRefs.current.set(n.id, el);
                          else itemRefs.current.delete(n.id);
                        }}
                        onClick={() => openItem(n.id, r.href, isUnread)}
                        className={cn(
                          "flex w-full gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface-hover focus-visible:bg-surface-hover",
                          isUnread && "pr-24"
                        )}
                      >
                        <span aria-hidden="true" className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", isUnread ? "bg-brand" : "bg-transparent")} />
                        <span className="min-w-0 flex-1">
                          <span className={cn("block text-sm", isUnread ? "font-medium text-fg" : "text-fg-muted")}>
                            {isUnread && <span className="sr-only">Unread: </span>}
                            {r.title}
                          </span>
                          <span className="mt-0.5 block break-words text-[13px] text-fg-subtle">{r.message}</span>
                          <time dateTime={n.createdAt.toISOString()} className="mt-1 block text-xs text-fg-subtle">
                            {formatRelative(n.createdAt)}
                          </time>
                        </span>
                      </button>
                      {isUnread && (
                        <button
                          type="button"
                          onClick={() => markOne(n.id)}
                          aria-label={`Mark “${r.title}” as read`}
                          className="absolute right-3 top-2.5 rounded px-1.5 py-0.5 text-xs text-fg-subtle opacity-0 transition-opacity hover:bg-surface-2 hover:text-fg focus-visible:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100"
                        >
                          Mark read
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
