"use client";

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ArrowRight, CornerDownLeft, FileText, Loader2, Search } from "lucide-react";
import { IssueSummary } from "@/types";
import { fetchIssueSummaries, getIssue } from "@/lib/firestore";
import { QUERY_LIMITS } from "@/lib/constants";
import { toIssueSummary } from "@/lib/models";
import { searchIssues } from "@/lib/search";
import { formatDate } from "@/lib/dates";
import { logError } from "@/lib/errors";
import { useOverlay } from "@/hooks/useOverlay";
import { cn } from "@/lib/cn";
import { StatusBadge } from "@/components/ui/Badge";
import { usePortalReady } from "@/components/ui/Dialog";
import type { NavItem } from "./nav";

const ISSUE_ID = /^[A-Za-z0-9]{15,40}$/;
const RECENT_KEY = "unifix:recent-issues";
const POOL_TTL_MS = 60_000;

// One bounded projection fetch shared across openings for a minute.
let poolCache: { at: number; issues: IssueSummary[] } | null = null;

type Recent = { id: string; title: string };

function readRecent(): Recent[] {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((r) => typeof r?.id === "string" && typeof r?.title === "string").slice(0, 5) : [];
  } catch {
    return [];
  }
}

function pushRecent(item: Recent) {
  try {
    const next = [item, ...readRecent().filter((r) => r.id !== item.id)].slice(0, 5);
    sessionStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // Recents are a convenience only.
  }
}

type Result =
  | { kind: "page"; key: string; label: string; href: string; icon: React.ReactNode }
  | { kind: "issue"; key: string; issue: IssueSummary }
  | { kind: "recent"; key: string; recent: Recent };

/**
 * Global search (Ctrl/⌘ K): issues by ID, title, location or category,
 * plus quick navigation. ↑/↓ move, Enter opens, Esc closes.
 */
export default function CommandPalette({ open, onClose, pages }: { open: boolean; onClose: () => void; pages: NavItem[] }) {
  const router = useRouter();
  const ready = usePortalReady();
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const [query, setQuery] = useState("");
  const [pool, setPool] = useState<IssueSummary[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [exact, setExact] = useState<IssueSummary | null>(null);
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<Recent[]>([]);

  useOverlay(open, panelRef, onClose, { initialFocus: inputRef });

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActive(0);
    setRecent(readRecent());
    if (poolCache && Date.now() - poolCache.at < POOL_TTL_MS) {
      setPool(poolCache.issues);
      return;
    }
    let cancelled = false;
    setFailed(false);
    fetchIssueSummaries({ max: QUERY_LIMITS.search })
      .then(({ issues }) => {
        poolCache = { at: Date.now(), issues };
        if (!cancelled) setPool(issues);
      })
      .catch((err) => {
        logError("commandPalette", err);
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const trimmed = query.trim().replace(/^#/, "");
  const inPool = !!pool?.some((i) => i.id === trimmed);
  useEffect(() => {
    setExact(null);
    if (!open || !ISSUE_ID.test(trimmed) || inPool) return;
    let cancelled = false;
    getIssue(trimmed)
      .then((issue) => {
        if (!cancelled && issue) setExact(toIssueSummary(issue));
      })
      .catch((err) => logError("getIssue", err));
    return () => {
      cancelled = true;
    };
  }, [open, trimmed, inPool]);

  const results = useMemo<Result[]>(() => {
    const q = query.trim().toLowerCase();
    const pageResults: Result[] = pages
      .filter((p) => !q || p.label.toLowerCase().includes(q))
      .slice(0, q ? 4 : 6)
      .map((p) => ({ kind: "page", key: `page-${p.href}`, label: p.label, href: p.href, icon: p.icon }));
    if (!q) {
      return [...recent.map((r) => ({ kind: "recent" as const, key: `recent-${r.id}`, recent: r })), ...pageResults];
    }
    const issues = pool ? searchIssues(pool, query, {}, 8).map((h) => h.issue) : [];
    const issueResults: Result[] = [...(exact ? [exact] : []), ...issues.filter((i) => i.id !== exact?.id)].map((issue) => ({
      kind: "issue",
      key: `issue-${issue.id}`,
      issue,
    }));
    return [...issueResults, ...pageResults];
  }, [query, pool, exact, pages, recent]);

  useEffect(() => setActive(0), [query]);

  const go = useCallback(
    (r: Result) => {
      if (r.kind === "page") router.push(r.href);
      else if (r.kind === "issue") {
        pushRecent({ id: r.issue.id, title: r.issue.title });
        router.push(`/issues/${r.issue.id}`);
      } else router.push(`/issues/${r.recent.id}`);
      onClose();
    },
    [router, onClose]
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(results.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter" && results[active]) {
      e.preventDefault();
      go(results[active]);
    }
  };

  useEffect(() => {
    document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active, listId]);

  if (!open || !ready) return null;

  const groups: { title: string; items: { r: Result; index: number }[] }[] = [];
  results.forEach((r, index) => {
    const title = r.kind === "issue" ? "Issues" : r.kind === "recent" ? "Recent" : "Go to";
    const group = groups.find((g) => g.title === title) ?? groups[groups.push({ title, items: [] }) - 1];
    group.items.push({ r, index });
  });

  return createPortal(
    <div className="fixed inset-0 z-[85] flex items-start justify-center px-3 pt-[10vh] sm:px-6">
      <div aria-hidden="true" className="absolute inset-0 bg-overlay animate-fade-in" onMouseDown={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        className="relative flex max-h-[70dvh] w-full max-w-xl flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-lg animate-dialog-in"
      >
        <div className="flex items-center gap-2.5 border-b border-border px-4">
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
            aria-label="Search issues and pages"
            placeholder="Search issues, locations, pages…"
            maxLength={120}
            className="h-12 min-w-0 flex-1 bg-transparent text-[15px] text-fg placeholder:text-fg-subtle focus:outline-none"
          />
          {query && pool === null && !failed && <Loader2 className="h-4 w-4 animate-spin text-fg-subtle" aria-label="Loading issues" />}
          <kbd className="hidden rounded border border-border bg-surface-2 px-1.5 py-0.5 text-[11px] text-fg-subtle sm:inline">Esc</kbd>
        </div>
        <div id={listId} role="listbox" aria-label="Results" className="min-h-0 flex-1 overflow-y-auto py-2">
          {failed && <p className="px-4 py-2 text-[13px] text-danger">Issues couldn&apos;t be loaded — page shortcuts still work.</p>}
          {results.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-fg-subtle">No matches for “{query.trim()}”.</p>
          ) : (
            groups.map((g) => (
              <div key={g.title} role="group" aria-label={g.title} className="mb-1">
                <p className="px-4 pb-1 pt-2 text-xs font-medium text-fg-subtle">{g.title}</p>
                {g.items.map(({ r, index }) => (
                  <div
                    key={r.key}
                    id={`${listId}-${index}`}
                    role="option"
                    aria-selected={index === active}
                    onMouseMove={() => setActive(index)}
                    onClick={() => go(r)}
                    className={cn(
                      "mx-2 flex cursor-pointer items-center gap-3 rounded-md px-2.5 py-2 text-sm",
                      index === active ? "bg-surface-hover" : ""
                    )}
                  >
                    {r.kind === "issue" ? (
                      <>
                        <FileText className="h-4 w-4 shrink-0 text-fg-subtle" aria-hidden="true" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-fg">{r.issue.title}</span>
                          <span className="block truncate text-xs text-fg-subtle">
                            {r.issue.location} · {r.issue.category} · {formatDate(r.issue.createdAt)}
                          </span>
                        </span>
                        <StatusBadge status={r.issue.status} className="max-sm:hidden" />
                      </>
                    ) : r.kind === "recent" ? (
                      <>
                        <FileText className="h-4 w-4 shrink-0 text-fg-subtle" aria-hidden="true" />
                        <span className="min-w-0 flex-1 truncate text-fg">{r.recent.title}</span>
                      </>
                    ) : (
                      <>
                        <span className="text-fg-subtle [&>svg]:h-4 [&>svg]:w-4">{r.icon}</span>
                        <span className="min-w-0 flex-1 truncate text-fg">{r.label}</span>
                        <ArrowRight className="h-3.5 w-3.5 text-fg-subtle" aria-hidden="true" />
                      </>
                    )}
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
        <div className="hidden items-center gap-4 border-t border-border px-4 py-2 text-xs text-fg-subtle sm:flex">
          <span><kbd className="font-sans">↑</kbd> <kbd className="font-sans">↓</kbd> to navigate</span>
          <span className="inline-flex items-center gap-1"><CornerDownLeft className="h-3 w-3" aria-hidden="true" /> to open</span>
          <span>Searches the {QUERY_LIMITS.search} most recent issues</span>
        </div>
      </div>
    </div>,
    document.body
  );
}
