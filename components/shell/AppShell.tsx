"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronsUpDown, LogOut, Menu as MenuIcon, PlusCircle, Search } from "lucide-react";
import { useAuthContext } from "@/components/AuthProvider";
import NotificationBell from "@/components/NotificationBell";
import ThemeToggle from "@/components/ThemeToggle";
import Drawer from "@/components/ui/Drawer";
import Menu from "@/components/ui/Menu";
import { IconButton, buttonClasses } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { dashboardPathForRole } from "@/lib/roles";
import { logError } from "@/lib/errors";
import { cn } from "@/lib/cn";
import { UserRole } from "@/types";
import Logo from "./Logo";
import CommandPalette from "./CommandPalette";
import { NavGroup, ROLE_LABELS, isActive, navForRole } from "./nav";

function initials(name: string | undefined) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "U") + (parts[1]?.[0] ?? "")).toUpperCase();
}

function NavList({ groups, onNavigate }: { groups: NavGroup[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  const tab = useSearchParams().get("tab");
  return (
    <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 py-4">
      {groups.map((group) => (
        <div key={group.label} className="mb-5 last:mb-0">
          <p className="mb-1 px-2 text-xs font-medium text-fg-subtle">{group.label}</p>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active = isActive(item, pathname, tab);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group relative flex h-9 items-center gap-2.5 rounded-md px-2 text-sm transition-colors duration-150",
                      "[&>svg]:h-[18px] [&>svg]:w-[18px] [&>svg]:shrink-0 [&>svg]:transition-colors",
                      active
                        ? "bg-brand-subtle font-medium text-brand-fg [&>svg]:text-brand-fg"
                        : "text-fg-muted hover:bg-surface-hover hover:text-fg [&>svg]:text-fg-subtle hover:[&>svg]:text-fg-muted"
                    )}
                  >
                    {active && <span aria-hidden="true" className="absolute -left-3 top-2 bottom-2 w-[3px] rounded-r bg-brand" />}
                    {item.icon}
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function SidebarContent({ groups, onNavigate, role }: { groups: NavGroup[]; onNavigate?: () => void; role: UserRole }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 shrink-0 items-center border-b border-border px-4">
        <Logo href={dashboardPathForRole(role)} subtitle="Campus operations" />
      </div>
      <Suspense fallback={<div className="flex-1" />}>
        <NavList groups={groups} onNavigate={onNavigate} />
      </Suspense>
      {role !== "user" && (
        <div className="border-t border-border p-3">
          <Link href="/dashboard/report" onClick={onNavigate} className={buttonClasses("secondary", "md", "w-full")}>
            <PlusCircle className="h-4 w-4" aria-hidden="true" />
            Report an issue
          </Link>
        </div>
      )}
    </div>
  );
}

/**
 * Authenticated application frame: sidebar navigation (drawer on small
 * screens), a quiet top bar with search, notifications, theme and the
 * account menu, and a consistent content width.
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const { userProfile, activeRole, availableRoles, switchRole, signOut } = useAuthContext();
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [isMac, setIsMac] = useState(false);

  const groups = useMemo(() => navForRole(activeRole), [activeRole]);
  const pages = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad/.test(navigator.platform));
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => setDrawerOpen(false), [pathname]);

  const handleRoleSwitch = async (role: UserRole) => {
    if (role === activeRole) return;
    try {
      await switchRole(role);
      router.push(dashboardPathForRole(role));
    } catch (err) {
      logError("switchRole", err);
      toast.error("Couldn't switch view", "Please try again.");
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (err) {
      logError("signOut", err);
    }
    router.replace("/");
  };

  return (
    <div className="min-h-dvh bg-canvas">
      <a
        href="#main"
        className="sr-only z-[100] rounded-md bg-surface px-3 py-2 text-sm font-medium text-fg shadow-md focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Skip to content
      </a>

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-border bg-surface lg:block">
        <SidebarContent groups={groups} role={activeRole} />
      </aside>

      <div className="lg:pl-60">
        <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b border-border bg-surface px-3 sm:px-4 lg:px-6">
          <IconButton label="Open navigation" className="lg:hidden" onClick={() => setDrawerOpen(true)}>
            <MenuIcon className="h-5 w-5" aria-hidden="true" />
          </IconButton>
          <Logo href={dashboardPathForRole(activeRole)} className="lg:hidden" />

          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="ml-auto hidden h-9 w-full max-w-xs items-center gap-2 rounded-md border border-border bg-surface-2 px-3 text-sm text-fg-subtle transition-colors hover:border-border-strong hover:text-fg-muted sm:flex lg:ml-0"
          >
            <Search className="h-4 w-4" aria-hidden="true" />
            <span className="flex-1 text-left">Search issues…</span>
            <kbd className="rounded border border-border bg-surface px-1.5 text-[11px] font-medium">{isMac ? "⌘K" : "Ctrl K"}</kbd>
          </button>

          <div className="ml-auto flex items-center gap-1">
            <IconButton label="Search" className="sm:hidden" onClick={() => setSearchOpen(true)}>
              <Search className="h-[18px] w-[18px]" aria-hidden="true" />
            </IconButton>
            <NotificationBell />
            <ThemeToggle />
            <Menu
              align="right"
              header={
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-fg">{userProfile?.name}</p>
                  <p className="truncate text-xs text-fg-subtle">{userProfile?.email}</p>
                </div>
              }
              sections={[
                ...(availableRoles.length > 1
                  ? [
                      {
                        label: "View as",
                        items: availableRoles.map((r) => ({
                          label: ROLE_LABELS[r],
                          checked: r === activeRole,
                          onSelect: () => void handleRoleSwitch(r),
                        })),
                      },
                    ]
                  : []),
                { items: [{ label: "Sign out", icon: <LogOut />, onSelect: () => void handleSignOut() }] },
              ]}
              trigger={(props) => (
                <button
                  type="button"
                  {...props}
                  aria-label={`Account menu for ${userProfile?.name ?? "you"}`}
                  className="ml-1 flex h-9 items-center gap-2 rounded-md pl-1 pr-1.5 transition-colors hover:bg-surface-hover sm:pr-2"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-2 text-xs font-semibold text-fg-muted ring-1 ring-border">
                    {initials(userProfile?.name)}
                  </span>
                  <span className="hidden text-left leading-tight md:block">
                    <span className="block max-w-[9rem] truncate text-[13px] font-medium text-fg">{userProfile?.name}</span>
                    <span className="block text-[11px] text-fg-subtle">{ROLE_LABELS[activeRole]}</span>
                  </span>
                  <ChevronsUpDown className="hidden h-3.5 w-3.5 text-fg-subtle md:block" aria-hidden="true" />
                </button>
              )}
            />
          </div>
        </header>

        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[1200px] px-4 py-6 outline-none sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Navigation" side="left" hideHeader>
        <SidebarContent groups={groups} role={activeRole} onNavigate={() => setDrawerOpen(false)} />
      </Drawer>

      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} pages={pages} />
    </div>
  );
}
