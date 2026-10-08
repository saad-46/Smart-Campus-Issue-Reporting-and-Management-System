import React from "react";
import ThemeToggle from "@/components/ThemeToggle";
import Logo from "./Logo";

/** Calm, centred frame for sign-in, registration and role selection. */
export default function AuthLayout({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-14 items-center justify-between px-4 sm:px-6">
        <Logo />
        <ThemeToggle />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pb-16 pt-6 sm:items-center sm:pt-0">
        <div className="w-full max-w-[400px]">
          <h1 className="text-2xl font-semibold tracking-tight text-fg">{title}</h1>
          {description && <p className="mt-1.5 text-sm text-fg-muted">{description}</p>}
          <div className="glass depth-2 mt-6 rounded-xl p-5 sm:p-6">{children}</div>
          {footer && <div className="mt-5 text-center text-sm text-fg-muted">{footer}</div>}
        </div>
      </main>
    </div>
  );
}
