"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Issue, IssueSummary } from "@/types";
import { Actor, fetchIncidentMembers, fetchIssueSummaries, getIssue, linkIssueToIncident } from "@/lib/firestore";
import { DUPLICATE_WINDOW_DAYS, DuplicateMatch, findDuplicates } from "@/lib/intelligence/similarity";
import { QUERY_LIMITS } from "@/lib/constants";
import { toIssueSummary } from "@/lib/models";
import { formatDate } from "@/lib/dates";
import { getFriendlyErrorMessage, logError } from "@/lib/errors";
import { Layers, Search } from "lucide-react";
import Button from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { SkeletonLines } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import Panel from "./Panel";

/**
 * Incident membership (master report and linked reports) and similar open
 * reports. Similar reports are only suggestions; linking is an explicit
 * admin action and never merges, hides or deletes anyone's report.
 */
export default function IncidentPanel({ issue, admin }: { issue: Issue; admin: Actor | null }) {
  const [master, setMaster] = useState<{ id: string; title: string } | null>(null);
  const [members, setMembers] = useState<IssueSummary[] | null>(null);
  const [similar, setSimilar] = useState<DuplicateMatch[] | null>(null);
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [confirmUnlink, setConfirmUnlink] = useState(false);
  const toast = useToast();

  useEffect(() => {
    let cancelled = false;
    setMaster(null);
    setMembers(null);
    if (issue.duplicateOf) {
      getIssue(issue.duplicateOf)
        .then((m) => { if (!cancelled) setMaster(m ? { id: m.id, title: m.title } : null); })
        .catch((err) => logError("getIssue", err));
    } else {
      fetchIncidentMembers(issue.id)
        .then((list) => { if (!cancelled) setMembers(list); })
        .catch((err) => { logError("fetchIncidentMembers", err); if (!cancelled) setMembers([]); });
    }
    return () => { cancelled = true; };
  }, [issue.id, issue.duplicateOf]);

  // The latest snapshot, read by checks without re-running them on every snapshot.
  const latest = useRef(issue);
  useEffect(() => {
    latest.current = issue;
  });

  const checkSimilar = useCallback(async () => {
    const current = latest.current;
    setChecking(true);
    setError("");
    try {
      const since = new Date(Date.now() - DUPLICATE_WINDOW_DAYS * 86_400_000);
      const { issues } = await fetchIssueSummaries({ since, max: QUERY_LIMITS.duplicates });
      const pool = issues.filter(
        (i) => i.id !== current.id && i.duplicateOf !== current.id && i.id !== current.duplicateOf
      );
      setSimilar(findDuplicates(toIssueSummary(current), pool));
    } catch (err) {
      logError("checkSimilar", err);
      setError(getFriendlyErrorMessage(err, "Similar reports couldn't be checked right now."));
    } finally {
      setChecking(false);
    }
  }, []);

  // Admins see suggestions straight away; others ask for them.
  const isAdmin = admin !== null;
  useEffect(() => {
    setSimilar(null);
    if (isAdmin && issue.status !== "Resolved") void checkSimilar();
  }, [isAdmin, issue.id, issue.duplicateOf, issue.status, checkSimilar]);

  const link = async (masterId: string) => {
    if (!admin) return;
    setBusy(masterId || "unlink");
    setError("");
    try {
      await linkIssueToIncident(issue.id, masterId, admin);
      toast.success(masterId ? "Report linked to the incident" : "Report removed from the incident");
    } catch (err) {
      logError("linkIssueToIncident", err);
      setError(getFriendlyErrorMessage(err, "The link couldn't be changed."));
    } finally {
      setBusy("");
      setConfirmUnlink(false);
    }
  };

  const hasMembers = (members?.length ?? 0) > 0;

  return (
    <Panel title="Related reports" description={issue.duplicateOf || hasMembers ? undefined : "Reports of the same problem can be grouped into one incident."}>
      <div className="space-y-3">
        {issue.duplicateOf ? (
          <div className="rounded-md border border-brand-subtle-border bg-brand-subtle px-3 py-2.5 text-sm">
            <p className="flex items-center gap-1.5 font-medium text-fg">
              <Layers className="h-3.5 w-3.5 text-brand-fg" aria-hidden="true" />
              Part of a larger incident
            </p>
            <p className="mt-1 text-[13px] text-fg-muted">
              Linked to{" "}
              <Link href={`/issues/${issue.duplicateOf}`} className="font-medium text-brand-fg hover:underline">
                {master?.title ?? "the main report"}
              </Link>
              . This report keeps its own status and updates.
            </p>
            {admin && (
              <Button variant="ghost" size="sm" className="-ml-2 mt-1 text-danger hover:text-danger" onClick={() => setConfirmUnlink(true)} disabled={busy !== ""}>
                Remove from incident
              </Button>
            )}
          </div>
        ) : hasMembers ? (
          <div>
            <p className="flex items-center gap-1.5 text-sm font-medium text-fg">
              <Layers className="h-3.5 w-3.5 text-brand-fg" aria-hidden="true" />
              Main report · {(members?.length ?? 0) + 1} reports in this incident
            </p>
            <ul className="mt-2 divide-y divide-border rounded-md border border-border">
              {members?.map((m) => (
                <li key={m.id} className="px-3 py-2">
                  <Link href={`/issues/${m.id}`} className="block truncate text-[13px] text-fg hover:text-brand-fg hover:underline">
                    {m.title}
                  </Link>
                  <p className="text-xs text-fg-subtle">
                    {formatDate(m.createdAt)} · {m.status}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {error && <p role="alert" className="text-[13px] text-danger">{error}</p>}

        {similar === null ? (
          issue.status !== "Resolved" &&
          (checking ? (
            <SkeletonLines lines={2} />
          ) : (
            <Button variant="secondary" size="sm" onClick={checkSimilar} icon={<Search className="h-3.5 w-3.5" aria-hidden="true" />}>
              Check for similar open reports
            </Button>
          ))
        ) : similar.length === 0 ? (
          <p className="text-[13px] text-fg-subtle">No similar open reports in the last {DUPLICATE_WINDOW_DAYS} days.</p>
        ) : (
          <div>
            <p className="mb-2 text-[13px] text-fg-muted">Possibly the same problem — similar wording and place. Please verify before linking.</p>
            <ul className="space-y-2">
              {similar.map(({ issue: other, score }) => {
                const target = other.duplicateOf || other.id;
                return (
                  <li key={other.id} className="rounded-md border border-border px-3 py-2.5">
                    <Link href={`/issues/${other.id}`} className="block break-words text-sm text-fg hover:text-brand-fg hover:underline">
                      {other.title}
                    </Link>
                    <p className="mt-0.5 text-xs text-fg-subtle">
                      {other.location} · {formatDate(other.createdAt)} · {other.status} · {Math.round(score * 100)}% similar
                    </p>
                    {admin && !issue.duplicateOf && (
                      <Button
                        variant="tertiary"
                        size="sm"
                        className="-ml-2 mt-1"
                        onClick={() => link(target)}
                        disabled={busy !== "" || hasMembers}
                        isLoading={busy === target}
                        title={hasMembers ? "This report already has linked reports; link those to the other incident instead." : undefined}
                      >
                        Link this report to that incident
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmUnlink}
        title="Remove from incident?"
        description="This report will be tracked on its own again. Nothing else changes."
        confirmLabel="Remove link"
        tone="danger"
        busy={busy === "unlink"}
        onConfirm={() => link("")}
        onCancel={() => setConfirmUnlink(false)}
      />
    </Panel>
  );
}
