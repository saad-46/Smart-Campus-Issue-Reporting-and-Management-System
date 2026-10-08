"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Tabs";
import { EmptyState } from "@/components/ui/States";
import { ViewerGate } from "@/components/viewer/parts";
import { NOTIFICATION_ICONS } from "@/components/viewer/notificationIcons";
import { formatRelative } from "@/lib/dates";
import { VIEWER_ROLE_LABELS } from "@/lib/viewer/nav";
import { cn } from "@/lib/cn";

export default function ViewerNotificationsPage() {
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | "unread">("all");

  return (
    <ViewerGate>
      {({ data, role, notifications, unread, markRead, markAllRead }) => {
        const shown = filter === "unread" ? notifications.filter((n) => !n.read) : notifications;
        return (
          <>
            <PageHeader
              title="Notifications"
              description={`What the ${VIEWER_ROLE_LABELS[role].toLowerCase()} perspective would have been told. Opening one marks it read in this demo.`}
              actions={
                <>
                  <Segmented<"all" | "unread"> label="Show" size="sm" value={filter} onChange={setFilter} options={[{ value: "all", label: "All" }, { value: "unread", label: `Unread (${unread})` }]} />
                  <Button size="sm" variant="secondary" disabled={unread === 0} onClick={markAllRead} icon={<CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />}>
                    Mark all read
                  </Button>
                </>
              }
            />
            <Card className="overflow-hidden">
              {shown.length === 0 ? (
                <EmptyState title={filter === "unread" ? "No unread notifications" : "Nothing yet"} description={filter === "unread" ? "You're all caught up." : "Notifications appear when work is assigned, started or resolved."} />
              ) : (
                <ul aria-label="Notifications" className="divide-y divide-border">
                  {shown.map((n) => {
                    const Icon = NOTIFICATION_ICONS[n.kind];
                    return (
                      <li key={n.id}>
                        <button
                          type="button"
                          onClick={() => {
                            markRead(n.id);
                            if (n.issueId) router.push(`/viewer/issues/${n.issueId}`);
                          }}
                          className={cn("flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-surface-hover sm:px-5", !n.read && "bg-brand-subtle/50")}
                        >
                          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-2 text-fg-muted">
                            <Icon className="h-4 w-4" aria-hidden="true" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2 text-sm font-medium text-fg">
                              {n.title}
                              {!n.read && <span className="rounded-full bg-brand px-1.5 text-[10px] font-semibold uppercase text-on-brand">New</span>}
                            </span>
                            <span className="mt-0.5 block text-[13px] text-fg-muted">{n.body}</span>
                          </span>
                          <span className="shrink-0 text-xs text-fg-subtle">{formatRelative(n.at, data.now)}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </>
        );
      }}
    </ViewerGate>
  );
}
