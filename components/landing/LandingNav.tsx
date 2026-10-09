"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Menu as MenuIcon } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import Drawer from "@/components/ui/Drawer";
import { IconButton, buttonClasses } from "@/components/ui/Button";
import Logo from "@/components/shell/Logo";
import { cn } from "@/lib/cn";

export const SECTION_LINKS = [
  { label: "Product", href: "#product" },
  { label: "Workflow", href: "#workflow" },
  { label: "Capabilities", href: "#capabilities" },
  { label: "Live demo", href: "#demo" },
] as const;

/** Public navigation: product links, theme, Sign in and the primary Explore action. */
export default function LandingNav() {
  const [open, setOpen] = useState(false);
  return (
    <header className="glass-bar sticky top-0 z-40 border-b">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Logo href="/" className="max-[359px]:[&>span:last-child]:hidden" />
        <nav aria-label="Sections" className="ml-6 hidden items-center gap-0.5 lg:flex">
          {SECTION_LINKS.map((l) => (
            <a key={l.href} href={l.href} className="rounded-lg px-3 py-2 text-sm text-fg-muted transition-colors hover:bg-surface-hover hover:text-fg">
              {l.label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <ThemeToggle />
          <Link href="/login" className={buttonClasses("ghost", "md", "hidden md:inline-flex")}>
            Sign in
          </Link>
          <Link href="/viewer" className={buttonClasses("primary", "md", "px-3.5 max-[420px]:px-3")}>
            <span className="max-sm:hidden">Explore the Platform</span>
            <span className="sm:hidden">Explore</span>
          </Link>
          <IconButton label="Open menu" className="lg:hidden" aria-expanded={open} onClick={() => setOpen(true)}>
            <MenuIcon className="h-5 w-5" aria-hidden="true" />
          </IconButton>
        </div>
      </div>

      <Drawer open={open} onClose={() => setOpen(false)} title="Menu" side="right">
        <nav aria-label="Menu" className="flex flex-col p-3">
          {SECTION_LINKS.map((l) => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 text-[15px] text-fg hover:bg-surface-hover">
              {l.label}
            </a>
          ))}
          <div className={cn("mt-3 flex flex-col gap-2 border-t border-border pt-4")}>
            <Link href="/viewer" onClick={() => setOpen(false)} className={buttonClasses("primary", "lg")}>
              Explore the Platform
            </Link>
            <Link href="/login" className={buttonClasses("secondary", "lg")}>
              Sign in
            </Link>
            <Link href="/register" className="px-3 py-2 text-center text-sm text-fg-muted hover:text-fg">
              Create an account
            </Link>
          </div>
        </nav>
      </Drawer>
    </header>
  );
}
