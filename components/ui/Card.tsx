// ============================================
// Card — a glass surface. Not every block needs one: use cards to
// group related content, not to decorate.
// ============================================

"use client";

import React from "react";
import { cn } from "@/lib/cn";

interface CardProps extends React.HTMLAttributes<HTMLElement> {
  as?: "div" | "section" | "article" | "aside";
  /** Interactive cards get a hover border change (no movement). */
  interactive?: boolean;
  padded?: boolean;
}

export default function Card({ as: Tag = "div", interactive, padded = false, className, children, ...props }: CardProps) {
  return (
    <Tag
      className={cn(
        "glass rounded-xl",
        interactive && "lift",
        padded && "p-4 sm:p-5",
        className
      )}
      {...props}
    >
      {children}
    </Tag>
  );
}

interface CardHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  /** Heading level for document outline (default h2). */
  level?: 2 | 3;
  id?: string;
  className?: string;
}

/** Card title row: title, optional description and a right-aligned action. */
export function CardHeader({ title, description, action, level = 2, id, className }: CardHeaderProps) {
  const Heading = level === 2 ? "h2" : "h3";
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-4 pt-4 sm:px-5 sm:pt-5", className)}>
      <div className="min-w-0">
        <Heading id={id} className="text-[15px] font-semibold text-fg">
          {title}
        </Heading>
        {description && <p className="mt-0.5 text-[13px] text-fg-subtle">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}

export function CardBody({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("px-4 py-4 sm:px-5", className)}>{children}</div>;
}

export function CardFooter({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("flex items-center justify-end gap-2 border-t border-border px-4 py-3 sm:px-5", className)}>{children}</div>;
}

/** Back-compat: older code imported CardTitle. */
export function CardTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h3 className={cn("text-[15px] font-semibold text-fg", className)}>{children}</h3>;
}
