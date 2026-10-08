"use client";

import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { BarChart3, CornerDownLeft, FileText, GraduationCap, HardHat, MapPin, Search } from "lucide-react";
import { searchIssues } from "@/lib/search";
import { useOverlay } from "@/hooks/useOverlay";
import { StatusBadge } from "@/components/ui/Badge";
import { usePortalReady } from "@/components/ui/Dialog";
import { cn } from "@/lib/cn";
import { DEMO_LOCATIONS, DEMO_STUDENTS, DEMO_WORKERS } from "@/lib/viewer/demoData";
import { navForViewerRole } from "@/lib/viewer/nav";
import { useViewer } from "./viewerContext";

/** Sections of the Analytics page, so search can open them directly. */
const ANALYTICS_SECTIONS = [
  { label: "Issue volume and trend", hash: "volume" },
  { label: "Categories and priorities", hash: "categories" },
  { label: "SLA and deadline performance", hash: "sla" },
  { label: "Department performance", hash: "departments" },
  { label: "When problems are reported", hash: "heatmap" },
  { label: "Worker workload", hash: "workload" },
];

interface Result {
  group: "Issues" | "Pages" | "Locations" | "Workers" | "Students" | "Analytics";
  key: string;
  label: string;
  hint?: string;
  href: string;
  icon: React.ReactNode;
  status?: "Open" | "In Progress" | "Resolved";
}

/**
 * Viewer search (Ctrl/⌘ K): issues, pages and (as an administrator) locations,
 * workers, students and analytics sections, all from the demo data. ↑/↓ move,
 * Enter opens, Esc closes.
 */
export default function ViewerCommandPalette({ open, onClose, now }: { open: boolean; onClose: () => void; now: Date }) {
  const router = useRouter();
  const ready = usePortalReady();
  const { data, role } = useViewer();
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  useOverlay(open, panelRef, onClose, { initialFocus: inputRef });

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
    }
  }, [open]);

  const results = useMemo<Result[]>(() => {
    const q = query.trim().toLowerCase();
    const out: Result[] = [];
    const pages = navForViewerRole(role)
      .flatMap((g) => g.items)
      .map((p): Result => ({ group: "Pages", key: `p-${p.href}`, label: p.label, href: p.href, icon: <FileText className="h-4 w-4" /> }));
    if (!q) return pages.slice(0, 8);
    if (data) {
      for (const hit of searchIssues(data.issues, query, {}, 6)) {
        out.push({ group: "Issues", key: `i-${hit.issue.id}`, label: hit.issue.title, hint: `${hit.issue.id} · ${hit.issue.location}`, href: `/viewer/issues/${hit.issue.id}`, icon: <FileText className="h-4 w-4" />, status: hit.issue.status });
      }
    }
    out.push(...pages.filter((p) => p.label.toLowerCase().includes(q)).slice(0, 4));
    if (role === "admin") {
      out.push(
        ...DEMO_LOCATIONS.filter((l) => l.name.toLowerCase().includes(q))
          .slice(0, 4)
          .map((l): Result => ({ group: "Locations", key: `l-${l.id}`, label: l.name, hint: "Location and QR code", href: `/viewer/locations?location=${l.id}`, icon: <MapPin className="h-4 w-4" /> })),
        ...DEMO_WORKERS.filter((w) => w.name.toLowerCase().includes(q) || w.team.toLowerCase().includes(q))
          .slice(0, 4)
          .map((w): Result => ({ group: "Workers", key: `w-${w.id}`, label: w.name, hint: w.team, href: `/viewer/workers?worker=${w.id}`, icon: <HardHat className="h-4 w-4" /> })),
        ...DEMO_STUDENTS.filter((s) => s.name.toLowerCase().includes(q))
          .slice(0, 3)
          .map((s): Result => ({ group: "Students", key: `s-${s.id}`, label: s.name, hint: `${s.department} · ${s.year}`, href: `/viewer/issues?reporter=${s.id}`, icon: <GraduationCap className="h-4 w-4" /> })),
        ...ANALYTICS_SECTIONS.filter((a) => a.label.toLowerCase().includes(q) || "analytics".includes(q))
          .slice(0, 3)
          .map((a): Result => ({ group: "Analytics", key: `a-${a.hash}`, label: a.label, hint: "Analytics", href: `/viewer/analytics#${a.hash}`, icon: <BarChart3 className="h-4 w-4" /> }))
      );
    }
    return out;
  }, [query, data, role]);

  useEffect(() => setActive(0), [query]);

  const choose = (r: Result | undefined) => {
    if (!r) return;
    onClose();
    router.push(r.href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(results.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(results[active]);
    }
  };

  useEffect(() => {
    document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active, listId]);

  if (!open || !ready) return null;

  const groups: { title: string; items: { r: Result; index: number }[] }[] = [];
  results.forEach((r, index) => {
    const g = groups.find((x) => x.title === r.group) ?? groups[groups.push({ title: r.group, items: [] }) - 1];
    g.items.push({ r, index });
  });

  return createPortal(
    <div className="fixed inset-0 z-[85] flex items-start justify-center px-3 pt-[10vh] sm:px-6">
      <div aria-hidden="true" className="absolute inset-0 bg-overlay animate-fade-in" onMouseDown={onClose} />
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label="Search the demo" className="glass-blur relative flex max-h-[70dvh] w-full max-w-xl flex-col overflow-hidden rounded-xl animate-dialog-in">
        <div className="flex items-center gap-2.5 border-b border-glass-border px-4">
          <Search className="h-4 w-4 shrink-0 text-fg-subtle" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={results[active] ? `${listId}-${active}` : undefined}
            aria-autocomplete="list"
            aria-label="Search issues, locations, workers and pages"
            placeholder="Search issues, locations, workers, pages…"
            maxLength={120}
            className="h-12 min-w-0 flex-1 bg-transparent text-[15px] text-fg placeholder:text-fg-subtle focus:outline-none"
          />
          <kbd className="hidden rounded border border-border bg-surface-2 px-1.5 py-0.5 text-[11px] text-fg-subtle sm:inline">Esc</kbd>
        </div>
        <div id={listId} role="listbox" aria-label="Results" className="min-h-0 flex-1 overflow-y-auto py-2">
          {results.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-fg-subtle">No demo records match &ldquo;{query}&rdquo;. Try a place, a category or an issue number.</p>
          ) : (
            groups.map((g) => (
              <div key={g.title} role="presentation">
                <p className="px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-subtle">{g.title}</p>
                {g.items.map(({ r, index }) => (
                  <div
                    key={r.key}
                    id={`${listId}-${index}`}
                    role="option"
                    aria-selected={index === active}
                    onMouseMove={() => setActive(index)}
                    onClick={() => choose(r)}
                    className={cn("mx-2 flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-sm", index === active ? "bg-brand-subtle text-fg" : "text-fg-muted")}
                  >
                    <span className="text-fg-subtle [&>svg]:h-4 [&>svg]:w-4">{r.icon}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-fg">{r.label}</span>
                      {r.hint && <span className="block truncate text-xs text-fg-subtle">{r.hint}</span>}
                    </span>
                    {r.status && <StatusBadge status={r.status} />}
                    {index === active && <CornerDownLeft className="h-3.5 w-3.5 text-fg-subtle" aria-hidden="true" />}
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
        <p className="border-t border-glass-border px-4 py-2 text-[11px] text-fg-subtle">
          Demo data · {data ? data.issues.length : 0} issues · {now.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
        </p>
      </div>
    </div>,
    document.body
  );
}
