"use client";

import React, { forwardRef, useId } from "react";
import { AlertCircle, CheckCircle2, ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

/* Shared control styling: one height, one radius, one focus treatment. */
export const controlBase =
  "w-full rounded-md border bg-surface text-fg text-sm placeholder:text-fg-subtle " +
  "transition-[border-color,box-shadow,background-color] duration-150 ease-standard " +
  "hover:border-border-strong focus:outline-none focus:border-brand focus:ring-3 focus:ring-brand/15 " +
  "disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-fg-subtle";

function stateBorder(error?: string, valid?: boolean) {
  if (error) return "border-danger focus:border-danger focus:ring-danger/15";
  if (valid) return "border-success-border";
  return "border-border";
}

interface FieldShellProps {
  id: string;
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: string;
  valid?: boolean;
  /** Shown next to the label, e.g. "Optional" or a character count. */
  aside?: React.ReactNode;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}

/** Label + control + helper / error text, wired with aria attributes by the controls below. */
export function FieldShell({ id, label, hint, error, valid, aside, required, children, className }: FieldShellProps) {
  return (
    // Full width unless the caller sets an explicit width (e.g. "w-auto", "w-44").
    <div className={cn(!/(^|\s)w-/.test(className ?? "") && "w-full", className)}>
      {(label || aside) && (
        <div className="mb-1.5 flex items-baseline justify-between gap-3">
          {label && (
            <label htmlFor={id} className="text-sm font-medium text-fg">
              {label}
              {required && <span className="sr-only"> (required)</span>}
            </label>
          )}
          {aside && <span className="text-xs text-fg-subtle">{aside}</span>}
        </div>
      )}
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 flex items-start gap-1.5 text-[13px] text-danger">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : valid ? (
        <p className="mt-1.5 flex items-center gap-1.5 text-[13px] text-success">
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
          Looks good
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-[13px] text-fg-subtle">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function describedBy(id: string, error?: string, hint?: React.ReactNode) {
  return error ? `${id}-error` : hint ? `${id}-hint` : undefined;
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: string;
  valid?: boolean;
  aside?: React.ReactNode;
  icon?: React.ReactNode;
  wrapperClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, valid, aside, icon, className, wrapperClassName, id, required, ...props },
  ref
) {
  const generated = useId();
  const inputId = id ?? generated;
  return (
    <FieldShell id={inputId} label={label} hint={hint} error={error} valid={valid} aside={aside} required={required} className={wrapperClassName}>
      <div className="relative">
        {icon && (
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-fg-subtle [&>svg]:h-4 [&>svg]:w-4">
            {icon}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(inputId, error, hint)}
          className={cn(controlBase, stateBorder(error, valid), "h-9 px-3", icon && "pl-9", className)}
          {...props}
        />
      </div>
    </FieldShell>
  );
});

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: string;
  valid?: boolean;
  aside?: React.ReactNode;
  wrapperClassName?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, valid, aside, className, wrapperClassName, id, required, rows = 4, ...props },
  ref
) {
  const generated = useId();
  const inputId = id ?? generated;
  return (
    <FieldShell id={inputId} label={label} hint={hint} error={error} valid={valid} aside={aside} required={required} className={wrapperClassName}>
      <textarea
        ref={ref}
        id={inputId}
        rows={rows}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(inputId, error, hint)}
        className={cn(controlBase, stateBorder(error, valid), "px-3 py-2 leading-relaxed resize-y min-h-[5rem]", className)}
        {...props}
      />
    </FieldShell>
  );
});

interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: string;
  wrapperClassName?: string;
  /** Compact control for filter bars. */
  size?: "sm" | "md";
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, error, className, wrapperClassName, id, size = "md", children, ...props },
  ref
) {
  const generated = useId();
  const inputId = id ?? generated;
  return (
    <FieldShell id={inputId} label={label} hint={hint} error={error} className={wrapperClassName}>
      <div className="relative">
        <select
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(inputId, error, hint)}
          className={cn(
            controlBase,
            stateBorder(error),
            "appearance-none pr-8 cursor-pointer",
            size === "sm" ? "h-8 pl-2.5 text-[13px]" : "h-9 pl-3",
            className
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" aria-hidden="true" />
      </div>
    </FieldShell>
  );
});

export default Input;
