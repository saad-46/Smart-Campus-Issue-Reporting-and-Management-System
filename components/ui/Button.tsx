import React, { forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "tertiary" | "danger" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium select-none " +
  "transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-standard " +
  "active:translate-y-px disabled:pointer-events-none disabled:opacity-50 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-brand text-on-brand shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_1px_2px_hsl(var(--shadow-color)/0.2),0_6px_16px_-6px_var(--glow)] hover:bg-brand-hover active:bg-brand-active",
  secondary:
    "bg-surface text-fg border border-border-strong shadow-xs hover:bg-surface-hover hover:border-border-strong active:bg-surface-2",
  tertiary: "text-brand-fg hover:bg-brand-subtle active:bg-brand-subtle",
  danger: "bg-danger-solid text-white shadow-xs hover:brightness-110 active:brightness-95",
  ghost: "text-fg-muted hover:bg-surface-hover hover:text-fg active:bg-surface-2",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[13px] rounded-md",
  md: "h-9 px-3.5 text-sm rounded-md",
  lg: "h-11 px-5 text-[15px] rounded-md",
};

const iconSizes: Record<ButtonSize, string> = {
  sm: "h-8 w-8 rounded-md",
  md: "h-9 w-9 rounded-md",
  lg: "h-11 w-11 rounded-md",
};

/** Class string for links that should look like buttons. */
export function buttonClasses(variant: ButtonVariant = "primary", size: ButtonSize = "md", className?: string): string {
  return cn(base, variants[variant], sizes[size], className);
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  /** Icon shown before the label (hidden while loading). */
  icon?: React.ReactNode;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", isLoading = false, icon, children, className, disabled, type = "button", onClick, ...props },
  ref
) {
  // While loading, the button stays focusable (a natively disabled button drops
  // keyboard focus to <body>) but ignores clicks and form submission.
  return (
    <button
      ref={ref}
      type={type}
      className={buttonClasses(variant, size, cn(isLoading && "pointer-events-none", className))}
      disabled={disabled}
      aria-disabled={isLoading || undefined}
      aria-busy={isLoading || undefined}
      onClick={isLoading ? (e) => e.preventDefault() : onClick}
      {...props}
    >
      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : icon}
      {children}
    </button>
  );
});

export default Button;

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Accessible name — icon buttons have no visible text. */
  label: string;
  variant?: Exclude<ButtonVariant, "tertiary">;
  size?: ButtonSize;
  children: React.ReactNode;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, variant = "ghost", size = "md", className, children, type = "button", ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cn(base, variants[variant], iconSizes[size], "p-0", className)}
      {...props}
    >
      {children}
    </button>
  );
});
