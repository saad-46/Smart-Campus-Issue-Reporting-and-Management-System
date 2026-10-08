"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronsUpDown, LogOut, PlusCircle, Search } from "lucide-react";
import { useAuthContext } from "@/components/AuthProvider";
import NotificationBell from "@/components/NotificationBell";
import ThemeToggle from "@/components/ThemeToggle";
import Menu from "@/components/ui/Menu";
import { IconButton, buttonClasses } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { dashboardPathForRole } from "@/lib/roles";
import { logError } from "@/lib/errors";
import { UserRole } from "@/types";
import Logo from "./Logo";
import CommandPalette from "./CommandPalette";
import ShellFrame from "./ShellFrame";
import { ROLE_LABELS, navForRole } from "./nav";

function initials(name: string | undefined) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "U") + (parts[1]?.[0] ?? "")).toUpperCase();
}

/**
 * Authenticated application frame: sidebar navigation (drawer on small
 * screens), a quiet top bar with search, notifications, theme and the
 * account menu, and a consistent content width.
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const { userProfile, activeRole, availableRoles, switchRole, signOut } = useAuthContext();
  const router = useRouter();
  const toast = useToast();
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
    <>
      <ShellFrame
        navLabel="Main"
        groups={groups}
        logoHref={dashboardPathForRole(activeRole)}
        logoSubtitle="Campus operations"
        sidebarFooter={
          activeRole !== "user"
            ? ({ collapsed, onNavigate }) =>
                collapsed ? (
                  <Link href="/dashboard/report" aria-label="Report an issue" title="Report an issue" className={buttonClasses("secondary", "md", "w-full px-0")}>
                    <PlusCircle className="h-4 w-4" aria-hidden="true" />
                  </Link>
                ) : (
                  <Link href="/dashboard/report" onClick={onNavigate} className={buttonClasses("secondary", "md", "w-full")}>
                    <PlusCircle className="h-4 w-4" aria-hidden="true" />
                    Report an issue
                  </Link>
                )
            : undefined
        }
        headerStart={
          <>
            <Logo href={dashboardPathForRole(activeRole)} className="lg:hidden" />
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="ml-auto hidden h-9 w-full max-w-xs items-center gap-2 rounded-lg border border-glass-border bg-surface-2/70 px-3 text-sm text-fg-subtle transition-colors hover:border-border-strong hover:text-fg-muted sm:flex lg:ml-0"
            >
              <Search className="h-4 w-4" aria-hidden="true" />
              <span className="flex-1 text-left">Search issues…</span>
              <kbd className="rounded border border-border bg-surface px-1.5 text-[11px] font-medium">{isMac ? "⌘K" : "Ctrl K"}</kbd>
            </button>
          </>
        }
        headerEnd={
          <>
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
          </>
        }
      >
        {children}
      </ShellFrame>

      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} pages={pages} />
    </>
  );
}
