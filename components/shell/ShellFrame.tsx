"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronsLeft, ChevronsRight, Menu as MenuIcon } from "lucide-react";
import Drawer from "@/components/ui/Drawer";
import { IconButton } from "@/components/ui/Button";
import { Tooltip } from "@/components/ui/Data";
import { readSidebarCollapsed, writeSidebarCollapsed } from "@/lib/shellPrefs";
import { cn } from "@/lib/cn";
import Logo, { LogoMark } from "./Logo";
import { NavGroup, isActive } from "./nav";

function NavList({ groups, label, collapsed, onNavigate }: { groups: NavGroup[]; label: string; collapsed: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const tab = useSearchParams().get("tab");
  return (
    <nav aria-label={label} // Collapsed: let the label tooltips escape to the right (a scroll container would clip them).
      className={cn("flex-1 py-4", collapsed ? "px-2" : "overflow-y-auto overflow-x-hidden px-3")}>
      {groups.map((group, gi) => (
        <div key={group.label} className="mb-5 last:mb-0">
          {collapsed ? (
            gi > 0 && <div aria-hidden="true" className="mx-2 mb-3 border-t border-glass-border" />
          ) : (
            <p className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-subtle">{group.label}</p>
          )}
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active = isActive(item, pathname, tab);
              const link = (
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  aria-label={collapsed ? item.label : undefined}
                  data-tour={item.tour}
                  className={cn(
                    "group relative flex h-9 items-center gap-2.5 rounded-lg text-sm transition-[background-color,color,box-shadow] duration-150",
                    "[&>svg]:h-[18px] [&>svg]:w-[18px] [&>svg]:shrink-0 [&>svg]:transition-colors",
                    collapsed ? "w-full justify-center px-0" : "px-2.5",
                    active
                      ? "bg-brand-subtle font-medium text-brand-fg shadow-[inset_0_0_0_1px_var(--brand-subtle-border)] [&>svg]:text-brand-fg"
                      : "text-fg-muted hover:bg-surface-hover hover:text-fg [&>svg]:text-fg-subtle hover:[&>svg]:text-fg-muted"
                  )}
                >
                  {active && <span aria-hidden="true" className={cn("absolute top-2 bottom-2 w-[3px] rounded-r bg-brand", collapsed ? "-left-2" : "-left-3")} />}
                  {item.icon}
                  {!collapsed && <span className="truncate">{item.label}</span>}
                  {!collapsed && item.count !== undefined && item.count > 0 && (
                    <span className="tabular ml-auto rounded-full bg-brand-subtle px-1.5 text-[11px] font-semibold text-brand-fg">{item.count}</span>
                  )}
                </Link>
              );
              return (
                <li key={item.href} className={cn(collapsed && "flex")}>
                  {collapsed ? (
                    <Tooltip content={item.label} side="right" className="w-full">
                      {link}
                    </Tooltip>
                  ) : (
                    link
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export interface ShellFrameProps {
  /** Accessible name of the navigation landmark. */
  navLabel: string;
  groups: NavGroup[];
  logoHref: string;
  logoSubtitle?: string;
  /** Small element next to the logo (e.g. the Viewer badge). */
  logoBadge?: React.ReactNode;
  /** Bottom of the sidebar; receives the collapsed state. */
  sidebarFooter?: (ctx: { collapsed: boolean; onNavigate?: () => void }) => React.ReactNode;
  /** Top bar content after the mobile menu button and logo. */
  headerStart?: React.ReactNode;
  headerEnd?: React.ReactNode;
  /** Second row under the top bar (e.g. the Viewer role switcher). */
  subHeader?: React.ReactNode;
  /** Full-width strip under the top bar (e.g. the Viewer demo notice). */
  banner?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Application frame shared by the signed-in app and Viewer Mode: a glass
 * sidebar that collapses to icons on desktop and becomes a drawer on small
 * screens, a sticky glass top bar, and a consistent content width.
 */
export default function ShellFrame({ navLabel, groups, logoHref, logoSubtitle, logoBadge, sidebarFooter, headerStart, headerEnd, subHeader, banner, children }: ShellFrameProps) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => setCollapsed(readSidebarCollapsed()), []);
  // Close the mobile drawer whenever the route changes.
  useEffect(() => setDrawerOpen(false), [pathname]);

  const toggleCollapsed = () =>
    setCollapsed((c) => {
      writeSidebarCollapsed(!c);
      return !c;
    });

  const sidebar = (isCollapsed: boolean, onNavigate?: () => void) => (
    <div className="flex h-full flex-col">
      <div className={cn("flex h-14 shrink-0 items-center gap-2 border-b border-glass-border", isCollapsed ? "justify-center px-2" : "px-4")}>
        {isCollapsed ? (
          <Link href={logoHref} aria-label="UniFix home" className="rounded-lg">
            <LogoMark />
          </Link>
        ) : (
          <>
            <Logo href={logoHref} subtitle={logoSubtitle} />
            {logoBadge}
          </>
        )}
      </div>
      <Suspense fallback={<div className="flex-1" />}>
        <NavList groups={groups} label={navLabel} collapsed={isCollapsed} onNavigate={onNavigate} />
      </Suspense>
      {sidebarFooter && <div className={cn("border-t border-glass-border", isCollapsed ? "p-2" : "p-3")}>{sidebarFooter({ collapsed: isCollapsed, onNavigate })}</div>}
      {!onNavigate && (
        <div className={cn("border-t border-glass-border", isCollapsed ? "p-2" : "px-3 py-2")}>
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-expanded={!isCollapsed}
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            data-tour="sidebar-toggle"
            className={cn(
              "flex h-8 w-full items-center gap-2 rounded-lg text-[13px] text-fg-subtle transition-colors hover:bg-surface-hover hover:text-fg",
              isCollapsed ? "justify-center" : "px-2.5"
            )}
          >
            {isCollapsed ? <ChevronsRight className="h-4 w-4" aria-hidden="true" /> : <ChevronsLeft className="h-4 w-4" aria-hidden="true" />}
            {!isCollapsed && "Collapse"}
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="sr-only z-[100] rounded-md bg-surface px-3 py-2 text-sm font-medium text-fg shadow-md focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Skip to content
      </a>

      <aside
        data-tour="sidebar"
        className={cn("glass-bar fixed inset-y-0 left-0 z-30 hidden border-r transition-[width] duration-200 ease-standard lg:block", collapsed ? "w-[4.25rem]" : "w-60")}
      >
        {sidebar(collapsed)}
      </aside>

      <div className={cn("transition-[padding] duration-200 ease-standard", collapsed ? "lg:pl-[4.25rem]" : "lg:pl-60")}>
        <header className="glass-bar sticky top-0 z-40 border-b">
          <div className="flex h-14 items-center gap-2 px-3 sm:px-4 lg:px-6">
            <IconButton label="Open navigation" className="shrink-0 lg:hidden" onClick={() => setDrawerOpen(true)}>
              <MenuIcon className="h-5 w-5" aria-hidden="true" />
            </IconButton>
            {headerStart}
            {headerEnd && <div className="ml-auto flex items-center gap-1">{headerEnd}</div>}
          </div>
          {subHeader && <div className="border-t border-glass-border px-3 py-2 sm:px-4 lg:px-6">{subHeader}</div>}
        </header>
        {banner}

        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[1320px] px-4 py-6 outline-none sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Navigation" side="left" hideHeader>
        {sidebar(false, () => setDrawerOpen(false))}
      </Drawer>
    </div>
  );
}
