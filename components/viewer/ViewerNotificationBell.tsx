"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import { IconButton } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { formatRelative } from "@/lib/dates";
import { NOTIFICATION_ICONS } from "./notificationIcons";
import { useViewer } from "./viewerContext";

/** Bell with an unread count and a short list; "View all" opens the full page. */
export default function ViewerNotificationBell() {
  const { notifications, unread, markRead, markAllRead, data } = useViewer();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const now = data?.now ?? new Date();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onDown = (e: MouseEvent) => {
      if (!panelRef.current?.contains(e.target as Node) && !buttonRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    const t = window.setTimeout(() => panelRef.current?.querySelector<HTMLElement>("button, a")?.focus(), 0);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
      window.clearTimeout(t);
    };
  }, [open]);

  return (
    <div className="relative" data-tour="notifications-bell">
      <IconButton
        ref={buttonRef}
        label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((o) => !o)}
        className="relative"
      >
        <Bell className="h-[18px] w-[18px]" aria-hidden="true" />
        {unread > 0 && (
          <span aria-hidden="true" className="tabular absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-semibold text-on-brand ring-2 ring-surface">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </IconButton>
      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Notifications"
          className="glass-blur fixed left-2 right-2 top-[3.75rem] z-[60] flex max-h-[min(30rem,calc(100dvh-5rem))] flex-col overflow-hidden rounded-xl animate-pop-in sm:left-auto sm:right-4 sm:w-[24rem]"
        >
          <div className="flex items-center justify-between gap-2 border-b border-glass-border px-4 py-3">
            <h2 className="text-sm font-semibold text-fg">Notifications</h2>
            <button type="button" onClick={markAllRead} disabled={unread === 0} className="inline-flex items-center gap-1 text-[13px] font-medium text-brand-fg hover:underline disabled:pointer-events-none disabled:opacity-40">
              <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Mark all read
            </button>
          </div>
          <ul className="min-h-0 flex-1 divide-y divide-border overflow-y-auto">
            {notifications.slice(0, 8).map((n) => {
              const Icon = NOTIFICATION_ICONS[n.kind];
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => {
                      markRead(n.id);
                      setOpen(false);
                      if (n.issueId) router.push(`/viewer/issues/${n.issueId}`);
                    }}
                    className={cn("flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-hover", !n.read && "bg-brand-subtle/50")}
                  >
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-2 text-fg-muted">
                      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 text-sm font-medium text-fg">
                        {n.title}
                        {!n.read && <span className="h-1.5 w-1.5 rounded-full bg-brand" aria-label="Unread" />}
                      </span>
                      <span className="mt-0.5 block text-[13px] text-fg-muted">{n.body}</span>
                      <span className="mt-0.5 block text-xs text-fg-subtle">{formatRelative(n.at, now)}</span>
                    </span>
                  </button>
                </li>
              );
            })}
            {notifications.length === 0 && <li className="px-4 py-8 text-center text-sm text-fg-subtle">You&apos;re all caught up.</li>}
          </ul>
          <Link href="/viewer/notifications" onClick={() => setOpen(false)} className="border-t border-glass-border px-4 py-2.5 text-center text-[13px] font-medium text-brand-fg hover:bg-surface-hover">
            View all notifications
          </Link>
        </div>
      )}
    </div>
  );
}
