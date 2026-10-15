"use client";

import React, { useDeferredValue, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, Receipt } from "lucide-react";
import Badge, { BadgeTone } from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import Drawer from "@/components/ui/Drawer";
import { Input, Select } from "@/components/ui/Field";
import { FilterBar, FilterChip, Pagination, SortButton } from "@/components/ui/Filters";
import { DescriptionList, StatStrip, TableWrap, td, th, trHover } from "@/components/ui/Data";
import { EmptyState, ErrorState, Notice, SkeletonRows } from "@/components/ui/States";
import { formatDate } from "@/lib/dates";
import { cn } from "@/lib/cn";
import {
  LedgerRow,
  NO_FILTERS,
  ROW_KIND_LABELS,
  ROW_STATUS_LABELS,
  RowFilters,
  RowStatus,
  SortKey,
  activeFilterCount,
  filterRows,
  formatInr,
  paginate,
  sortRows,
  summarizeRows,
} from "@/lib/financeLedger";

const PAGE_SIZE = 15;
const STATUS_TONE: Record<RowStatus, BadgeTone> = { posted: "success", pending: "warning", rejected: "danger" };

function DirectionMark({ row }: { row: LedgerRow }) {
  const incoming = row.direction === "in";
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium", incoming ? "text-success" : "text-fg-muted")}>
      {incoming ? <ArrowDownLeft className="h-3.5 w-3.5" aria-hidden="true" /> : <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />}
      {incoming ? "Incoming" : "Outgoing"}
    </span>
  );
}

function Amount({ row }: { row: LedgerRow }) {
  const incoming = row.direction === "in";
  return (
    <span className={cn("tabular whitespace-nowrap font-medium", row.status !== "posted" ? "text-fg-subtle" : incoming ? "text-success" : "text-fg")}>
      {incoming ? "+" : "−"}
      {formatInr(row.amount)}
    </span>
  );
}

export interface TransactionsLedgerProps {
  rows: LedgerRow[];
  loading: boolean;
  /** A message when the data couldn't be loaded; shows a retry state. */
  error?: string;
  onRetry?: () => void;
  /** Where an issue (claim) lives, for the "related issue" links. */
  issueHref: (issueId: string) => string;
  /** Turns a stored user id into a name, when one is known. */
  nameOf?: (uid: string) => string | undefined;
  /** Context shown above the figures (what the figures include and leave out). */
  scopeNote?: React.ReactNode;
}

/**
 * The transactions ledger: summary, search and filters, a sortable paged table
 * (cards on phones) and a detail panel. Presentational: the page decides where
 * the rows come from, and the rows come from lib/financeLedger.
 */
export default function TransactionsLedger({ rows, loading, error, onRetry, issueHref, nameOf, scopeNote }: TransactionsLedgerProps) {
  const [filters, setFilters] = useState<RowFilters>(NO_FILTERS);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "at", dir: "desc" });
  const [page, setPage] = useState(1);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const deferredQuery = useDeferredValue(filters.query);

  const set = (patch: Partial<RowFilters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  };

  const matching = useMemo(() => filterRows(rows, { ...filters, query: deferredQuery }), [rows, filters, deferredQuery]);
  const sorted = useMemo(() => sortRows(matching, sort.key, sort.dir), [matching, sort]);
  const paged = useMemo(() => paginate(sorted, page, PAGE_SIZE), [sorted, page]);
  const totals = useMemo(() => summarizeRows(matching), [matching]);
  const open = openKey ? rows.find((r) => r.key === openKey) ?? null : null;

  // If the data refreshes and the open entry is gone, close its panel.
  useEffect(() => {
    if (openKey && !rows.some((r) => r.key === openKey)) setOpenKey(null);
  }, [rows, openKey]);

  const sortBy = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "at" || key === "amount" ? "desc" : "asc" }));
  const ariaSort = (key: SortKey): React.AriaAttributes["aria-sort"] => (sort.key === key ? (sort.dir === "asc" ? "ascending" : "descending") : "none");

  const chips: FilterChip[] = [
    filters.kind !== "all" && { key: "kind", label: ROW_KIND_LABELS[filters.kind], onRemove: () => set({ kind: "all" }) },
    filters.direction !== "all" && { key: "direction", label: filters.direction === "in" ? "Incoming" : "Outgoing", onRemove: () => set({ direction: "all" }) },
    filters.status !== "all" && { key: "status", label: ROW_STATUS_LABELS[filters.status], onRemove: () => set({ status: "all" }) },
    filters.from && { key: "from", label: `From ${filters.from}`, onRemove: () => set({ from: "" }) },
    filters.to && { key: "to", label: `To ${filters.to}`, onRemove: () => set({ to: "" }) },
    filters.issueId && { key: "issue", label: `Issue ${filters.issueId}`, onRemove: () => set({ issueId: "" }) },
  ].filter(Boolean) as FilterChip[];

  const clear = () => {
    setFilters(NO_FILTERS);
    setPage(1);
  };
  const filtered = activeFilterCount(filters) > 0;
  const periodLabel = filters.from || filters.to ? "in the selected period" : "across all recorded entries";

  if (error) {
    return <ErrorState title="Transactions couldn't be loaded" description={error} onRetry={onRetry} />;
  }

  return (
    <>
      {scopeNote && (
        <Notice tone="info" className="mb-6">
          {scopeNote}
        </Notice>
      )}

      <StatStrip
        className="mb-6"
        columns={4}
        stats={[
          { label: "Incoming funds", value: <span className="whitespace-nowrap">{formatInr(totals.incoming)}</span>, loading, tone: "success", hint: `Posted additions ${periodLabel}` },
          { label: "Outgoing payments", value: <span className="whitespace-nowrap">{formatInr(totals.outgoing)}</span>, loading, hint: `Posted payments ${periodLabel}` },
          {
            label: "Net movement",
            value: <span className="whitespace-nowrap">{`${totals.net < 0 ? "−" : totals.net > 0 ? "+" : ""}${formatInr(Math.abs(totals.net))}`}</span>,
            loading,
            tone: totals.net < 0 ? "warning" : "default",
            hint: "Incoming minus outgoing; not a balance",
          },
          {
            label: "Transactions",
            value: totals.count,
            loading,
            hint: totals.excludedCount ? `${totals.excludedCount} not posted, left out of the amounts` : filtered ? "Matching the filters" : "All entries",
          },
        ]}
      />

      <FilterBar
        className="mb-4"
        search={filters.query}
        onSearch={(query) => set({ query })}
        searchLabel="Search transactions"
        placeholder="Search ID, reference, person, issue…"
        chips={chips}
        onClear={clear}
      >
        <Select label="Type" size="sm" wrapperClassName="md:w-36" value={filters.kind} onChange={(e) => set({ kind: e.target.value as RowFilters["kind"] })}>
          <option value="all">All types</option>
          <option value="payment">Payments</option>
          <option value="funds_added">Funds added</option>
        </Select>
        <Select label="Direction" size="sm" wrapperClassName="md:w-36" value={filters.direction} onChange={(e) => set({ direction: e.target.value as RowFilters["direction"] })}>
          <option value="all">All directions</option>
          <option value="in">Incoming</option>
          <option value="out">Outgoing</option>
        </Select>
        <Select label="Status" size="sm" wrapperClassName="md:w-32" value={filters.status} onChange={(e) => set({ status: e.target.value as RowFilters["status"] })}>
          <option value="all">Any status</option>
          <option value="posted">Posted</option>
          <option value="pending">Pending</option>
          <option value="rejected">Rejected</option>
        </Select>
        <Input label="From" type="date" className="h-8 text-[13px]" wrapperClassName="md:w-36" value={filters.from} max={filters.to || undefined} onChange={(e) => set({ from: e.target.value })} />
        <Input label="To" type="date" className="h-8 text-[13px]" wrapperClassName="md:w-36" value={filters.to} min={filters.from || undefined} onChange={(e) => set({ to: e.target.value })} />
      </FilterBar>

      <Card className="overflow-hidden">
        {loading ? (
          <SkeletonRows rows={6} label="Loading transactions" />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<Receipt />}
            title="No transactions yet"
            description="Funds added and payments recorded will appear here, newest first. Nothing has been recorded so far."
          />
        ) : sorted.length === 0 ? (
          <EmptyState
            title="No transactions match"
            description="Try a different search or widen the date range."
            action={
              <button type="button" onClick={clear} className="text-[13px] font-medium text-brand-fg hover:underline">
                Clear filters
              </button>
            }
          />
        ) : (
          <>
            {/* Large screens: a table. Below that the columns would scroll sideways, so entries are cards. */}
            <div className="hidden lg:block">
              <TableWrap label="Transactions">
                <thead>
                  <tr>
                    <th scope="col" className={th} aria-sort={ariaSort("at")}>
                      <SortButton label="Date and time" active={sort.key === "at"} direction={sort.dir} onClick={() => sortBy("at")} />
                    </th>
                    <th scope="col" className={th}>
                      Transaction ID
                    </th>
                    <th scope="col" className={th} aria-sort={ariaSort("kind")}>
                      <SortButton label="Type" active={sort.key === "kind"} direction={sort.dir} onClick={() => sortBy("kind")} />
                    </th>
                    <th scope="col" className={th}>
                      Description
                    </th>
                    <th scope="col" className={cn(th, "text-right")} aria-sort={ariaSort("amount")}>
                      <SortButton label="Amount" active={sort.key === "amount"} direction={sort.dir} onClick={() => sortBy("amount")} />
                    </th>
                    <th scope="col" className={th} aria-sort={ariaSort("status")}>
                      <SortButton label="Status" active={sort.key === "status"} direction={sort.dir} onClick={() => sortBy("status")} />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paged.items.map((r) => (
                    <tr key={r.key} className={trHover}>
                      <td className={cn(td, "whitespace-nowrap text-fg-muted")}>
                        <time dateTime={r.at.toISOString()}>{formatDate(r.at, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</time>
                      </td>
                      <td className={cn(td, "max-w-[11rem]")}>
                        <button
                          type="button"
                          onClick={() => setOpenKey(r.key)}
                          aria-label={`Open details for transaction ${r.id}`}
                          className="block max-w-full truncate rounded font-mono text-xs text-brand-fg underline-offset-2 hover:underline"
                        >
                          {r.id}
                        </button>
                      </td>
                      <td className={td}>
                        <span className="block text-[13px]">{ROW_KIND_LABELS[r.kind]}</span>
                        <DirectionMark row={r} />
                      </td>
                      <td className={cn(td, "max-w-[20rem]")}>
                        <span className="line-clamp-2 text-[13px]">{r.title}</span>
                        {r.party && <span className="block truncate text-xs text-fg-subtle">{r.party}</span>}
                      </td>
                      <td className={cn(td, "text-right")}>
                        <Amount row={r} />
                      </td>
                      <td className={td}>
                        <Badge tone={STATUS_TONE[r.status]} dot>
                          {ROW_STATUS_LABELS[r.status]}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            </div>

            {/* Phones: one card per entry. */}
            <ul className="divide-y divide-border lg:hidden" aria-label="Transactions">
              {paged.items.map((r) => (
                <li key={r.key}>
                  <button type="button" onClick={() => setOpenKey(r.key)} aria-label={`Open details for transaction ${r.id}`} className="block w-full px-4 py-3 text-left transition-colors hover:bg-surface-hover">
                    <span className="flex items-start justify-between gap-3">
                      <span className="min-w-0">
                        <span className="line-clamp-2 text-sm font-medium text-fg">{r.title}</span>
                        <span className="mt-0.5 block truncate font-mono text-xs text-fg-subtle">{r.id}</span>
                      </span>
                      <Amount row={r} />
                    </span>
                    <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <DirectionMark row={r} />
                      <Badge tone={STATUS_TONE[r.status]} dot>
                        {ROW_STATUS_LABELS[r.status]}
                      </Badge>
                      <span className="text-xs text-fg-subtle">{formatDate(r.at, { day: "numeric", month: "short", year: "numeric" })}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>

            <Pagination page={paged.page} pageSize={PAGE_SIZE} total={sorted.length} onPage={setPage} className="border-t border-border" />
          </>
        )}
      </Card>

      <Drawer open={!!open} onClose={() => setOpenKey(null)} title={open ? `${ROW_KIND_LABELS[open.kind]} · ${open.id}` : "Transaction"}>
        {open && (
          <div className="space-y-5 p-4 sm:p-5">
            <div>
              <p className={cn("tabular text-2xl font-semibold", open.direction === "in" && open.status === "posted" ? "text-success" : "text-fg")}>
                {open.direction === "in" ? "+" : "−"}
                {formatInr(open.amount)}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <DirectionMark row={open} />
                <Badge tone={STATUS_TONE[open.status]} dot>
                  {ROW_STATUS_LABELS[open.status]}
                </Badge>
              </div>
            </div>

            <DescriptionList
              items={[
                { label: "Transaction ID", value: <span className="break-all font-mono text-xs">{open.id}</span> },
                { label: "Type", value: ROW_KIND_LABELS[open.kind] },
                { label: "Recorded", value: formatDate(open.at, { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }) },
                ...(open.statedDate ? [{ label: open.kind === "payment" ? "Paid on (as stated)" : "Received on (as stated)", value: open.statedDate }] : []),
                ...(open.party ? [{ label: open.kind === "payment" ? "Paid to" : "Source", value: open.party }] : []),
                ...(open.method ? [{ label: "Method", value: open.method }] : []),
                ...(open.reference ? [{ label: "Reference", value: <span className="break-all">{open.reference}</span> }] : []),
                ...(open.recordedBy ? [{ label: "Recorded by", value: nameOf?.(open.recordedBy) ?? <span className="break-all font-mono text-xs">{open.recordedBy}</span> }] : []),
                { label: "Description", value: open.note ?? open.title },
              ]}
            />

            {open.issueId && (
              <p className="text-sm">
                <Link href={issueHref(open.issueId)} className="font-medium text-brand-fg hover:underline">
                  Open the related issue
                </Link>
                <span className="block text-xs text-fg-subtle">Any receipt for this claim is kept on the issue and is visible only to its worker and administrators.</span>
              </p>
            )}

            <div className="space-y-2 border-t border-border pt-4 text-xs leading-relaxed text-fg-subtle">
              {open.manual && <p>Recorded by an administrator. UniFix does not move money or check with a bank, so this is a statement, not a confirmed bank entry.</p>}
              <p>Entries are immutable once recorded; no status history is stored beyond this entry.</p>
            </div>
          </div>
        )}
      </Drawer>
    </>
  );
}
