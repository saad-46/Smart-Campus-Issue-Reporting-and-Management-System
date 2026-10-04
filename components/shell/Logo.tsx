import React from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

/** Product mark: a solid navy tile with a simple wrench-and-check glyph. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex h-7 w-7 items-center justify-center rounded-md bg-[#0f2557] text-white dark:bg-[#2f62d6]", className)} aria-hidden="true">
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 12.5l4.5 4.5L20 6" />
      </svg>
    </span>
  );
}

export default function Logo({ href = "/", className, subtitle }: { href?: string; className?: string; subtitle?: string }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2.5 rounded-md", className)}>
      <LogoMark />
      <span className="flex flex-col leading-none">
        <span className="text-[15px] font-semibold tracking-tight text-fg">UniFix</span>
        {subtitle && <span className="mt-0.5 text-[11px] text-fg-subtle">{subtitle}</span>}
      </span>
    </Link>
  );
}
