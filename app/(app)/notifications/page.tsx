"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import { useAuthContext } from "@/components/AuthProvider";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Tabs";
import { EmptyState, ErrorState, Notice, SkeletonRows } from "@/components/ui/States";
import { useNotifications } from "@/hooks/useNotifications";
import { markAllNotificationsRead, markNotificationRead, renderNotification } from "@/lib/notifications";
import { formatRelative } from "@/lib/dates";
import { getFriendlyErrorMessage, logError } from "@/lib/errors";
import { cn } from "@/lib/cn";

export default function NotificationsPage() {
  const { userProfile } = useAuthContext();
  const router = useRouter();
  const { items, unread, loading, error } = useNotifications(userProfile?.id);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);
  const shown = filter === "unread" ? items.filter((n) => !n.readAt) : items;

  const markAll = async () => {
    if (unread === 0 || busy) return;
    setBusy(true);
    setActionError("");
    try {
      await markAllNotificationsRead(items.filter((n) => !n.readAt).map((n) => n.id));
    } catch (err) {
      logError("markAllNotificationsRead", err);
      setActionError(getFriendlyErrorMessage(err, "Couldn't update notifications."));
    } finally {
      setBusy(false);
    }
  };

  const open = (id: string, href: string, isUnread: boolean) => {
    if (isUnread) markNotificationRead(id).catch((err) => logError("markNotificationRead", err));
    router.push(href);
  };

  return (
    <>
      <PageHeader
        title="Notifications"
        description="Assignments, status changes and decisions that concern you. Opening one marks it read."
        actions={
          <>
            <Segmented<"all" | "unread"> label="Show" size="sm" value={filter} onChange={setFilter} options={[{ value: "all", label: "All" }, { value: "unread", label: `Unread (${unread})` }]} />
            <Button size="sm" variant="secondary" disabled={unread === 0 || busy} onClick={markAll} icon={<CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />}>
              Mark all read
            </Button>
          </>
        }
      />
      {actionError && (
        <Notice tone="danger" className="mb-4">
          {actionError}
        </Notice>
      )}
      <Card className="overflow-hidden">
        {error ? (
          <ErrorState title="Couldn't load notifications" description="Please check your connection and reload the page." />
        ) : loading ? (
          <SkeletonRows rows={5} label="Loading notifications" />
        ) : shown.length === 0 ? (
          <EmptyState icon={<Bell />} title={filter === "unread" ? "No unread notifications" : "Nothing yet"} description={filter === "unread" ? "You're all caught up." : "Notifications appear when work is assigned, started or resolved."} />
        ) : (
          <ul aria-label="Notifications" className="divide-y divide-border">
            {shown.map((n) => {
              const r = renderNotification(n);
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => open(n.id, r.href, !n.readAt)}
                    className={cn("flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-surface-hover sm:px-5", !n.readAt && "bg-brand-subtle/50")}
                  >
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-2 text-fg-muted">
                      <Bell className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 text-sm font-medium text-fg">
                        {r.title}
                        {!n.readAt && <span className="rounded-full bg-brand px-1.5 text-[10px] font-semibold uppercase text-on-brand">New</span>}
                      </span>
                      <span className="mt-0.5 block text-[13px] text-fg-muted">{r.message}</span>
                    </span>
                    <span className="shrink-0 text-xs text-fg-subtle">{formatRelative(n.createdAt)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
