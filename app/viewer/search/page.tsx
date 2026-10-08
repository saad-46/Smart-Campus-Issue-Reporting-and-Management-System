"use client";

import React, { useState } from "react";
import { Search } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import { Select } from "@/components/ui/Field";
import { FilterBar, FilterChip } from "@/components/ui/Filters";
import { DemoIssueList, ViewerGate } from "@/components/viewer/parts";
import { EmptyState } from "@/components/ui/States";
import { searchIssues } from "@/lib/search";
import { ISSUE_CATEGORIES, ISSUE_STATUSES, PRIORITIES } from "@/lib/constants";
import { DemoIssue } from "@/lib/viewer/demoData";
import { IssueStatus, Priority } from "@/types";

export default function ViewerSearchPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [category, setCategory] = useState("");

  return (
    <ViewerGate>
      {({ data, slaConfig, openSearch }) => {
        const hits = searchIssues(data.issues, q, { status: (status || undefined) as IssueStatus | undefined, priority: (priority || undefined) as Priority | undefined, category: category || undefined }, 40);
        const chips: FilterChip[] = [
          status && { key: "s", label: `Status: ${status}`, onRemove: () => setStatus("") },
          priority && { key: "p", label: `Priority: ${priority}`, onRemove: () => setPriority("") },
          category && { key: "c", label: category, onRemove: () => setCategory("") },
        ].filter(Boolean) as FilterChip[];
        return (
          <>
            <PageHeader
              title="Search"
              description="Find an issue by number, title, place or category. Synonyms work: “wifi” finds “network”."
              actions={
                <button type="button" onClick={openSearch} className="inline-flex items-center gap-2 text-[13px] text-fg-subtle hover:text-fg">
                  <Search className="h-4 w-4" aria-hidden="true" />
                  Search everything with <kbd className="rounded border border-border bg-surface-2 px-1.5 text-[11px]">Ctrl K</kbd>
                </button>
              }
            />
            <Card className="mb-4 p-3 sm:p-4">
              <FilterBar
                search={q}
                onSearch={setQ}
                searchLabel="Search issues"
                placeholder="Try “projector”, “Lab 3” or SC-1140"
                chips={chips}
                onClear={() => {
                  setStatus("");
                  setPriority("");
                  setCategory("");
                }}
              >
                <Select size="sm" aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)} wrapperClassName="w-auto">
                  <option value="">Any status</option>
                  {ISSUE_STATUSES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </Select>
                <Select size="sm" aria-label="Priority" value={priority} onChange={(e) => setPriority(e.target.value)} wrapperClassName="w-auto">
                  <option value="">Any priority</option>
                  {PRIORITIES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </Select>
                <Select size="sm" aria-label="Category" value={category} onChange={(e) => setCategory(e.target.value)} wrapperClassName="w-auto">
                  <option value="">Any category</option>
                  {ISSUE_CATEGORIES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </Select>
              </FilterBar>
            </Card>
            <Card className="overflow-hidden">
              <p className="border-b border-border px-4 py-2.5 text-[13px] text-fg-subtle sm:px-5" aria-live="polite">
                {q.trim() ? `${hits.length} result${hits.length === 1 ? "" : "s"} for “${q.trim()}”` : `Newest ${hits.length} issues. Type to search.`}
              </p>
              {hits.length === 0 ? (
                <EmptyState title="No demo issues match" description="Try a different word, or clear a filter." />
              ) : (
                <DemoIssueList issues={hits.map((h) => h.issue as DemoIssue)} now={data.now} config={slaConfig} label="Search results" showAssignee />
              )}
            </Card>
          </>
        );
      }}
    </ViewerGate>
  );
}
