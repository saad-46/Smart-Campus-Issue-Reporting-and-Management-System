"use client";

import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import { FieldShell, controlBase } from "@/components/ui/Field";
import { ChoiceOption, OTHER_VALUE, exactOption, rankOptions } from "@/lib/academics";
import { cn } from "@/lib/cn";

/**
 * A searchable single choice (WAI-ARIA combobox with a listbox popup).
 *
 * - Opens as soon as it is focused or clicked, showing every option; typing
 *   filters and ranks them (prefix first).
 * - Arrow keys move, Enter chooses, Escape closes, Tab leaves. Typing text
 *   that doesn't match an option never becomes the value: leaving the field
 *   reverts it, unless the text is exactly an option's name.
 * - `otherLabel` adds an explicit last entry (value OTHER_VALUE) for choices
 *   that aren't in the list; the page then asks for the text separately.
 */
export default function Combobox({
  label,
  options,
  value,
  onChange,
  placeholder = "Search…",
  error,
  hint,
  required,
  disabled,
  loading,
  otherLabel,
  id,
  emptyText = "No match found.",
}: {
  label: string;
  options: ChoiceOption[];
  /** The chosen option's value ("" = nothing chosen, OTHER_VALUE = the "other" entry). */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  hint?: React.ReactNode;
  required?: boolean;
  disabled?: boolean;
  loading?: boolean;
  otherLabel?: string;
  id?: string;
  emptyText?: string;
}) {
  const generated = useId();
  const inputId = id ?? generated;
  const listId = `${inputId}-list`;
  const [open, setOpen] = useState(false);
  const [typing, setTyping] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const all = useMemo<ChoiceOption[]>(() => (otherLabel ? [...options, { value: OTHER_VALUE, label: otherLabel }] : options), [options, otherLabel]);
  const shown = useMemo(() => {
    if (!typing) return all;
    const ranked = rankOptions(options, query);
    return otherLabel ? [...ranked, { value: OTHER_VALUE, label: otherLabel }] : ranked;
  }, [all, options, otherLabel, query, typing]);
  const selected = all.find((o) => o.value === value);
  const display = typing ? query : (selected?.label ?? "");

  useEffect(() => {
    if (!open) return;
    document.getElementById(`${inputId}-opt-${active}`)?.scrollIntoView?.({ block: "nearest" });
  }, [active, open, inputId]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) close();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const close = () => {
    setOpen(false);
    setTyping(false);
    setQuery("");
  };

  const choose = (o: ChoiceOption) => {
    onChange(o.value);
    close();
  };

  const openList = () => {
    if (disabled) return;
    setOpen(true);
    const i = typing ? 0 : Math.max(0, all.findIndex((o) => o.value === value));
    setActive(i);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) return openList();
      setActive((a) => Math.min(shown.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) return openList();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Home" && open) {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End" && open) {
      e.preventDefault();
      setActive(Math.max(0, shown.length - 1));
    } else if (e.key === "Enter" && open) {
      e.preventDefault(); // choosing must not submit the form
      const o = shown[active];
      if (o) choose(o);
    } else if (e.key === "Escape" && open) {
      e.preventDefault();
      e.stopPropagation();
      close();
    }
  };

  return (
    <FieldShell id={inputId} label={label} hint={hint} error={error} required={required}>
      <div ref={wrapRef} className="relative">
        <input
          ref={inputRef}
          id={inputId}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && shown[active] ? `${inputId}-opt-${active}` : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          aria-required={required || undefined}
          autoComplete="off"
          disabled={disabled}
          placeholder={placeholder}
          value={display}
          onFocus={(e) => {
            openList();
            e.currentTarget.select();
          }}
          onClick={() => !open && openList()}
          onChange={(e) => {
            setTyping(true);
            setQuery(e.target.value);
            setActive(0);
            if (!open) setOpen(true);
          }}
          onKeyDown={onKeyDown}
          onBlur={() => {
            // Leaving with text that is exactly an option's name chooses it; anything else reverts.
            if (typing) {
              const exact = exactOption(options, query);
              if (exact) onChange(exact.value);
            }
            // The popup closes on outside mousedown; keyboard users leave with Tab.
            if (!wrapRef.current?.contains(document.activeElement)) close();
          }}
          className={cn(controlBase, error ? "border-danger focus:border-danger focus:ring-danger/15" : "border-border", "h-9 pl-3 pr-8")}
        />
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" aria-hidden="true" />
        {open && (
          <ul
            id={listId}
            role="listbox"
            aria-label={label}
            className="absolute left-0 right-0 z-30 mt-1 max-h-60 overflow-auto rounded-md border border-border bg-surface py-1 shadow-lg"
          >
            {loading ? (
              <li role="presentation" className="px-3 py-2 text-sm text-fg-subtle">
                Loading…
              </li>
            ) : (
              <>
                {shown.filter((o) => o.value !== OTHER_VALUE).length === 0 && typing && (
                  <li role="presentation" className="px-3 py-2 text-sm text-fg-subtle">
                    {emptyText}
                  </li>
                )}
                {shown.map((o, i) => (
                  <li
                    key={o.value}
                    id={`${inputId}-opt-${i}`}
                    role="option"
                    aria-selected={o.value === value}
                    // mousedown, not click: the input must keep focus until the choice is made.
                    onMouseDown={(e) => {
                      e.preventDefault();
                      choose(o);
                    }}
                    onMouseEnter={() => setActive(i)}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-fg",
                      i === active && "bg-brand-subtle text-brand-fg",
                      o.value === OTHER_VALUE && "border-t border-border"
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      {o.label}
                      {o.hint && <span className="ml-2 text-xs text-fg-subtle">{o.hint}</span>}
                    </span>
                    {o.value === value && <Check className="h-4 w-4 shrink-0" aria-hidden="true" />}
                  </li>
                ))}
              </>
            )}
          </ul>
        )}
      </div>
    </FieldShell>
  );
}
