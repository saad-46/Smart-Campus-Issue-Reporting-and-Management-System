"use client";

import React, { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  ChartLine,
  CircleQuestionMark,
  ClipboardList,
  Eye,
  FilePlus2,
  GraduationCap,
  HardHat,
  History,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Map as MapIcon,
  MapPin,
  Search,
  Settings,
  ShieldCheck,
  Users,
  Wallet,
  Workflow,
  Wrench,
  Globe2,
} from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { IconButton, buttonClasses } from "@/components/ui/Button";
import { Tooltip } from "@/components/ui/Data";
import Logo from "@/components/shell/Logo";
import ShellFrame from "@/components/shell/ShellFrame";
import type { NavGroup } from "@/components/shell/nav";
import { cn } from "@/lib/cn";
import { navForViewerRole, VIEWER_PERSPECTIVES, ViewerIcon, VIEWER_ROLE_LABELS } from "@/lib/viewer/nav";
import { useViewer } from "./viewerContext";
import ViewerNotificationBell from "./ViewerNotificationBell";

const ICONS: Record<ViewerIcon, React.ElementType> = {
  overview: LayoutDashboard,
  student: GraduationCap,
  worker: Wrench,
  admin: ShieldCheck,
  issues: ListChecks,
  community: Globe2,
  report: FilePlus2,
  map: MapIcon,
  analytics: ChartLine,
  workers: Users,
  finance: Wallet,
  locations: MapPin,
  settings: Settings,
  notifications: Bell,
  search: Search,
  timeline: History,
  how: Workflow,
};

// Shown by the shell's nav items in the tour (some items reuse the role icon for the dashboard).
const ROLE_HOME_ICONS = { student: ClipboardList, worker: HardHat, admin: LayoutDashboard } as const;

export function ViewerNavIcon({ icon }: { icon: ViewerIcon }) {
  const Icon = ICONS[icon];
  return <Icon aria-hidden="true" />;
}

export function ViewerBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border border-brand-subtle-border bg-brand-subtle px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-brand-fg",
        className
      )}
    >
      <Eye className="h-3 w-3" aria-hidden="true" />
      Viewer mode
    </span>
  );
}

/** Student / Worker / Admin switcher. Same-page client navigation; nothing reloads. */
function PerspectiveSwitcher() {
  const { role, setRole } = useViewer();
  return (
    <div className="flex items-center gap-3" data-tour="role-switcher">
      <span className="hidden text-[13px] text-fg-subtle sm:inline">Explore as</span>
      <div role="group" aria-label="Choose a perspective" className="grid flex-1 grid-cols-3 rounded-lg border border-glass-border bg-surface-2/70 p-0.5 sm:flex-none">
        {VIEWER_PERSPECTIVES.map((p) => {
          const active = p.role === role;
          return (
            <button
              key={p.role}
              type="button"
              aria-pressed={active}
              onClick={() => setRole(p.role)}
              className={cn(
                "flex h-9 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium transition-[background-color,color,box-shadow] duration-150 sm:h-8",
                "[&>svg]:h-4 [&>svg]:w-4 [&>svg]:shrink-0",
                active ? "bg-surface text-fg shadow-sm ring-1 ring-brand-subtle-border" : "text-fg-subtle hover:text-fg"
              )}
            >
              <ViewerNavIcon icon={p.icon} />
              {p.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Compact reminder that nothing here is real. */
function DemoStrip() {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 border-b border-brand-subtle-border bg-brand-subtle/60 px-3 py-1.5 text-[13px] text-fg-muted sm:px-4 lg:px-6">
      <ViewerBadge />
      <span>A safe demo on the real SUES campus map: the issues are samples, no real campus data is read or changed, and nothing you do is saved.</span>
    </div>
  );
}

/**
 * Viewer Mode frame, built from the same ShellFrame as the signed-in app so
 * both share one design. Menus follow the selected perspective; the account
 * menu is replaced by an Exit button because there is no account.
 */
export default function ViewerShell({ children }: { children: React.ReactNode }) {
  const { openTour, openSearch, role, data } = useViewer();
  const pathname = usePathname();
  const [isMac, setIsMac] = useState(false);
  useEffect(() => setIsMac(/Mac|iPhone|iPad/.test(navigator.platform)), []);

  const { unread } = useViewer();
  const groups = useMemo<NavGroup[]>(
    () =>
      navForViewerRole(role).map((g) => ({
        label: g.label,
        items: g.items.map((item) => {
          const Icon = item.icon === "overview" || item.icon === "student" || item.icon === "worker" ? ROLE_HOME_ICONS[role] : ICONS[item.icon];
          return {
            label: item.label,
            href: item.href,
            tour: item.tour,
            icon: <Icon aria-hidden="true" />,
            count: item.icon === "notifications" ? unread : undefined,
          };
        }),
      })),
    [role, unread]
  );

  return (
    <ShellFrame
      navLabel="Viewer"
      groups={groups}
      logoHref="/viewer"
      logoSubtitle="Demo workspace"
      sidebarFooter={({ collapsed, onNavigate }) =>
        collapsed ? (
          <Link href="/login" prefetch={false} aria-label="Sign in" title="Sign in" className={buttonClasses("secondary", "md", "w-full px-0")}>
            <LogOut className="h-4 w-4 rotate-180" aria-hidden="true" />
          </Link>
        ) : (
          <p className="text-[13px] text-fg-subtle">
            Want to report a real issue?{" "}
            <Link href="/login" prefetch={false} onClick={onNavigate} className="font-medium text-brand-fg hover:underline">
              Sign in
            </Link>
          </p>
        )
      }
      headerStart={
        <>
          <Logo href="/viewer" className="max-[399px]:hidden lg:hidden" />
          <button
            type="button"
            onClick={openSearch}
            data-tour="search-button"
            className="ml-auto hidden h-9 w-full max-w-xs items-center gap-2 rounded-lg border border-glass-border bg-surface-2/70 px-3 text-sm text-fg-subtle transition-colors hover:border-border-strong hover:text-fg-muted sm:flex lg:ml-0"
          >
            <Search className="h-4 w-4" aria-hidden="true" />
            <span className="flex-1 text-left">Search the demo…</span>
            <kbd className="rounded border border-border bg-surface px-1.5 text-[11px] font-medium">{isMac ? "⌘K" : "Ctrl K"}</kbd>
          </button>
        </>
      }
      headerEnd={
        <>
          <IconButton label="Search" className="sm:hidden" onClick={openSearch}>
            <Search className="h-[18px] w-[18px]" aria-hidden="true" />
          </IconButton>
          <ViewerNotificationBell />
          <Tooltip content="Open the guided tour" side="bottom">
            <button type="button" onClick={() => openTour(true)} aria-label="Open the guided tour" className={buttonClasses("ghost", "md", "px-2 sm:px-3")} data-tour="guide-button">
              <CircleQuestionMark className="h-[18px] w-[18px]" aria-hidden="true" />
              <span className="hidden sm:inline">Guide</span>
            </button>
          </Tooltip>
          <span data-tour="theme-toggle" className="inline-flex">
            <ThemeToggle />
          </span>
          <Link href="/" prefetch={false} className={buttonClasses("secondary", "md", "px-2.5 sm:px-3.5")} aria-label="Exit Viewer">
            <LogOut className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Exit Viewer</span>
          </Link>
        </>
      }
      subHeader={<PerspectiveSwitcher />}
      banner={<DemoStrip />}
    >
      <span className="sr-only" role="status">
        {data ? `${VIEWER_ROLE_LABELS[role]} perspective, ${pathname}` : "Loading the demo"}
      </span>
      {children}
    </ShellFrame>
  );
}
