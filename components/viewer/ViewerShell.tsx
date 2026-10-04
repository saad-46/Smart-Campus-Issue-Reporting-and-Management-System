"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChartLine, CircleQuestionMark, Eye, GraduationCap, LayoutDashboard, LogOut, Map as MapIcon, Menu as MenuIcon, ShieldCheck, Workflow, Wrench } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import Drawer from "@/components/ui/Drawer";
import { IconButton, buttonClasses } from "@/components/ui/Button";
import Logo from "@/components/shell/Logo";
import { cn } from "@/lib/cn";
import { useViewer } from "./ViewerProvider";
import { VIEWER_NAV, VIEWER_PERSPECTIVES, ViewerIcon, isViewerPathActive } from "@/lib/viewer/nav";

const ICONS: Record<ViewerIcon, React.ElementType> = {
  overview: LayoutDashboard,
  student: GraduationCap,
  worker: Wrench,
  admin: ShieldCheck,
  map: MapIcon,
  analytics: ChartLine,
  how: Workflow,
};

export function ViewerNavIcon({ icon }: { icon: ViewerIcon }) {
  const Icon = ICONS[icon];
  return <Icon aria-hidden="true" />;
}

const isCurrent = isViewerPathActive;

function ViewerBadge({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-sm border border-brand-subtle-border bg-brand-subtle px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-brand-fg", className)}>
      <Eye className="h-3 w-3" aria-hidden="true" />
      Viewer mode
    </span>
  );
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Viewer" className="flex-1 overflow-y-auto px-3 py-4">
      {VIEWER_NAV.map((group) => (
        <div key={group.label} className="mb-5 last:mb-0">
          <p className="mb-1 px-2 text-xs font-medium text-fg-subtle">{group.label}</p>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active = isCurrent(item.href, pathname);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group relative flex h-9 items-center gap-2.5 rounded-md px-2 text-sm transition-colors duration-150",
                      "[&>svg]:h-[18px] [&>svg]:w-[18px] [&>svg]:shrink-0",
                      active ? "bg-brand-subtle font-medium text-brand-fg" : "text-fg-muted hover:bg-surface-hover hover:text-fg [&>svg]:text-fg-subtle"
                    )}
                  >
                    {active && <span aria-hidden="true" className="absolute -left-3 top-2 bottom-2 w-[3px] rounded-r bg-brand" />}
                    <ViewerNavIcon icon={item.icon} />
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

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
        <Logo href="/viewer" />
        <ViewerBadge />
      </div>
      <NavList onNavigate={onNavigate} />
      <div className="border-t border-border p-4 text-[13px] text-fg-subtle">
        Want to report a real issue?{" "}
        <Link href="/login" className="font-medium text-brand-fg hover:underline">
          Sign in
        </Link>
      </div>
    </div>
  );
}

/** Student / Worker / Admin switcher. Links (client-side navigation), with the current one marked for assistive tech. */
function PerspectiveSwitcher() {
  const pathname = usePathname();
  return (
    <nav aria-label="Choose a perspective" className="flex items-center gap-3">
      <span className="hidden text-[13px] text-fg-subtle sm:inline">Explore as</span>
      <ul className="grid flex-1 grid-cols-3 rounded-md border border-border bg-surface-2 p-0.5 sm:flex-none">
        {VIEWER_PERSPECTIVES.map((p) => {
          const active = isCurrent(p.href, pathname);
          return (
            <li key={p.href}>
              <Link
                href={p.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-9 items-center justify-center gap-1.5 rounded-[5px] px-3 text-sm font-medium transition-[background-color,color,box-shadow] duration-150 sm:h-8",
                  "[&>svg]:h-4 [&>svg]:w-4 [&>svg]:shrink-0",
                  active ? "bg-surface text-fg shadow-xs" : "text-fg-subtle hover:text-fg"
                )}
              >
                <ViewerNavIcon icon={p.icon} />
                {p.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * Viewer Mode frame. Deliberately separate from the authenticated AppShell:
 * no account menu, notifications, search or role state — and the
 * "Viewer mode" label is always on screen.
 */
export default function ViewerShell({ children }: { children: React.ReactNode }) {
  const { openGuide } = useViewer();
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => setDrawerOpen(false), [pathname]);

  return (
    <div className="min-h-dvh bg-canvas">
      <a
        href="#main"
        className="sr-only z-[100] rounded-md bg-surface px-3 py-2 text-sm font-medium text-fg shadow-md focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Skip to content
      </a>

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-border bg-surface lg:block">
        <SidebarContent />
      </aside>

      <div className="lg:pl-60">
        <header className="sticky top-0 z-40 border-b border-border bg-surface">
          <div className="flex h-14 items-center gap-2 px-3 sm:px-4 lg:px-6">
            <IconButton label="Open navigation" className="shrink-0 lg:hidden" onClick={() => setDrawerOpen(true)}>
              <MenuIcon className="h-5 w-5" aria-hidden="true" />
            </IconButton>
            <Logo href="/viewer" className="max-[399px]:hidden lg:hidden" />
            <ViewerBadge className="lg:hidden" />
            <p className="hidden text-sm text-fg-muted lg:block">Read-only sample data · no account needed</p>

            <div className="ml-auto flex items-center gap-1">
              <button
                type="button"
                onClick={openGuide}
                aria-label="Open the Viewer guide"
                className={buttonClasses("ghost", "md", "px-2 sm:px-3")}
              >
                <CircleQuestionMark className="h-[18px] w-[18px]" aria-hidden="true" />
                <span className="hidden sm:inline">Guide</span>
              </button>
              <ThemeToggle />
              <Link href="/" className={buttonClasses("secondary", "md", "px-2.5 sm:px-3.5")} aria-label="Exit Viewer">
                <LogOut className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">Exit Viewer</span>
              </Link>
            </div>
          </div>
          <div className="border-t border-border px-3 py-2 sm:px-4 lg:px-6">
            <PerspectiveSwitcher />
          </div>
        </header>

        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[1200px] px-4 py-6 outline-none sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Viewer navigation" side="left" hideHeader>
        <SidebarContent onNavigate={() => setDrawerOpen(false)} />
      </Drawer>
    </div>
  );
}
