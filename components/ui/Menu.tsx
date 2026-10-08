"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";

export interface MenuItem {
  label: string;
  onSelect: () => void;
  icon?: React.ReactNode;
  description?: string;
  tone?: "default" | "danger";
  disabled?: boolean;
  /** Marks the current choice (e.g. active role). */
  checked?: boolean;
}

export interface MenuSection {
  label?: string;
  items: MenuItem[];
}

interface MenuProps {
  /** Render the trigger; receives the props it must spread on a <button>. */
  trigger: (props: React.ButtonHTMLAttributes<HTMLButtonElement> & { ref: React.Ref<HTMLButtonElement> }) => React.ReactNode;
  sections: MenuSection[];
  align?: "left" | "right";
  header?: React.ReactNode;
  className?: string;
}

/**
 * Dropdown menu with menu-button semantics: Enter/Space/↓ opens, ↑/↓ move,
 * Home/End jump, Escape or Tab closes and focus returns to the trigger.
 */
export default function Menu({ trigger, sections, align = "right", header, className }: MenuProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const triggerId = useId();
  const items = sections.flatMap((s) => s.items);

  const focusItem = (index: number) => {
    const nodes = menuRef.current?.querySelectorAll<HTMLButtonElement>('[role^="menuitem"]:not([disabled])');
    if (!nodes || nodes.length === 0) return;
    nodes[(index + nodes.length) % nodes.length].focus();
  };

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => focusItem(0), 0);
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node) && !triggerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  };

  const onMenuKey = (e: React.KeyboardEvent) => {
    const nodes = [...(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role^="menuitem"]:not([disabled])') ?? [])];
    const index = nodes.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "ArrowDown") { e.preventDefault(); focusItem(index + 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); focusItem(index - 1); }
    else if (e.key === "Home") { e.preventDefault(); focusItem(0); }
    else if (e.key === "End") { e.preventDefault(); focusItem(nodes.length - 1); }
    else if (e.key === "Escape") { e.preventDefault(); close(); }
    else if (e.key === "Tab") { close(false); }
  };

  return (
    <div className={cn("relative", className)}>
      {trigger({
        ref: triggerRef,
        id: triggerId,
        "aria-haspopup": "menu",
        "aria-expanded": open,
        "aria-controls": open ? menuId : undefined,
        onClick: () => setOpen((o) => !o),
        onKeyDown: (e) => {
          if (e.key === "ArrowDown" && !open) {
            e.preventDefault();
            setOpen(true);
          }
        },
      })}
      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-labelledby={triggerId}
          onKeyDown={onMenuKey}
          className={cn(
            "absolute top-full z-[60] mt-1.5 max-h-[min(30rem,calc(100dvh-6rem))] min-w-56 max-w-[calc(100vw-1rem)] glass-blur overflow-y-auto rounded-xl py-1 animate-pop-in",
            align === "right" ? "right-0 origin-top-right" : "left-0 origin-top-left"
          )}
        >
          {header && <div className="border-b border-border px-3 py-2.5">{header}</div>}
          {sections.map((section, si) => (
            <div key={si} role="group" aria-label={section.label} className={cn(si > 0 && "mt-1 border-t border-border pt-1")}>
              {section.label && <p className="px-3 pb-1 pt-1.5 text-xs font-medium text-fg-subtle">{section.label}</p>}
              {section.items.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  role={item.checked !== undefined ? "menuitemradio" : "menuitem"}
                  aria-checked={item.checked}
                  disabled={item.disabled}
                  onClick={() => {
                    close();
                    item.onSelect();
                  }}
                  className={cn(
                    "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm outline-none transition-colors",
                    "hover:bg-surface-hover focus-visible:bg-surface-hover disabled:opacity-50",
                    item.tone === "danger" ? "text-danger" : "text-fg"
                  )}
                >
                  {item.icon && <span className="text-fg-subtle [&>svg]:h-4 [&>svg]:w-4">{item.icon}</span>}
                  <span className="min-w-0 flex-1">
                    <span className="block">{item.label}</span>
                    {item.description && <span className="block text-xs text-fg-subtle">{item.description}</span>}
                  </span>
                  {item.checked && <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-brand-fg" />}
                </button>
              ))}
            </div>
          ))}
          {items.length === 0 && <p className="px-3 py-2 text-sm text-fg-subtle">No actions</p>}
        </div>
      )}
    </div>
  );
}
