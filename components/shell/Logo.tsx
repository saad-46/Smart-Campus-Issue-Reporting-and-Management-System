import React from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

/** Product mark: an indigo-to-violet tile with a simple wrench-and-check glyph. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[#4f46e5] to-[#7c3aed] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_4px_10px_-4px_var(--glow)]", className)} aria-hidden="true">
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
