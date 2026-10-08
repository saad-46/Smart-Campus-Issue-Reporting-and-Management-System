"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { DEFAULT_SLA_CONFIG } from "@/lib/intelligence/sla";
import { validateSlaHours } from "@/lib/intelligence/sla";
import { analyzeIssueDetails } from "@/services/aiService";
import { useToast } from "@/components/ui/Toast";
import { buildDemoData, DEMO_PERSONA, DEMO_WORKER_REQUESTS, DemoData, DemoIssue, demoLocation, workerName } from "@/lib/viewer/demoData";
import { demoStats } from "@/lib/viewer/demoStats";
import { DemoNotification, seedNotifications } from "@/lib/viewer/demoFeed";
import { NewReport, ViewerContext, ViewerContextValue } from "./viewerContext";
import { hasSeenViewerGuide, markViewerGuideSeen, readViewerRole, writeViewerRole } from "@/lib/viewer/guide";
import { homeForRole, roleForPath, ViewerRole } from "@/lib/viewer/nav";
import { SlaConfig } from "@/types";
import { TOUR_STEPS } from "@/lib/viewer/tour";
import ViewerTour from "./ViewerTour";
import ViewerCommandPalette from "./ViewerCommandPalette";

const NOTE = "Demo mode — no real data was modified.";

/**
 * Public Viewer state. It never touches Firebase: the data is the generated
 * demo dataset in lib/viewer, every action edits a local copy that disappears
 * when the page is closed, and there is no user, role claim or permission
 * here to escalate.
 */
export default function ViewerProvider({ children }: { children: React.ReactNode }) {
  const toast = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const [data, setData] = useState<DemoData | null>(null);
  const [slaConfig, setSlaConfig] = useState<SlaConfig>(DEFAULT_SLA_CONFIG);
  const [role, setRoleState] = useState<ViewerRole>("admin");
  const [notes, setNotes] = useState<Record<ViewerRole, DemoNotification[]>>({ student: [], worker: [], admin: [] });
  const [requests, setRequests] = useState(DEMO_WORKER_REQUESTS);
  const [tourOpen, setTourOpen] = useState(false);
  const [tourStart, setTourStart] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const counter = useRef(0);

  useEffect(() => {
    const built = buildDemoData(new Date());
    setData(built);
    setNotes({ student: seedNotifications(built, "student"), worker: seedNotifications(built, "worker"), admin: seedNotifications(built, "admin") });
    setRoleState(readViewerRole() ?? "admin");
    if (!hasSeenViewerGuide()) setTourOpen(true);
  }, []);

  // A deep link to a role-specific page switches to that role.
  useEffect(() => {
    setRoleState((current) => {
      const next = roleForPath(pathname, current);
      if (next !== current) writeViewerRole(next);
      return next;
    });
  }, [pathname]);

  // Ctrl/⌘ + K opens the search from every Viewer page.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const stats = useMemo(() => (data ? demoStats(data, slaConfig) : null), [data, slaConfig]);
  const now = data?.now ?? new Date();

  const setRole = useCallback(
    (next: ViewerRole, navigate = true) => {
      setRoleState(next);
      writeViewerRole(next);
      if (navigate) router.push(homeForRole(next));
    },
    [router]
  );

  const patch = useCallback((id: string, change: (i: DemoIssue) => DemoIssue) => {
    setData((d) => (d ? { ...d, issues: d.issues.map((i) => (i.id === id ? change(i) : i)) } : d));
  }, []);

  const notify = useCallback((roles: ViewerRole[], n: Omit<DemoNotification, "id" | "at" | "read">) => {
    const at = new Date();
    setNotes((prev) => {
      const next = { ...prev };
      for (const r of roles) next[r] = [{ ...n, id: `local-${counter.current++}`, at, read: false }, ...next[r]];
      return next;
    });
  }, []);

  const find = (id: string) => data?.issues.find((i) => i.id === id);

  const createIssue = useCallback(
    (report: NewReport) => {
      if (!data) return null;
      const place = demoLocation(report.locationId);
      if (!place) return null;
      const analysis = analyzeIssueDetails({ title: report.title, description: report.description, location: place.name });
      const nextNumber = 1146 + data.issues.filter((i) => i.simulated).length;
      const issue: DemoIssue = {
        id: `SC-${nextNumber}`,
        title: report.title.trim(),
        description: report.description.trim(),
        category: report.category ?? analysis.category,
        priority: report.priority ?? analysis.priority,
        status: "Open",
        location: place.name,
        locationId: place.id,
        assignedTo: "",
        duplicateOf: "",
        createdAt: new Date(),
        escalated: false,
        reporterId: DEMO_PERSONA.student.id,
        reporterName: DEMO_PERSONA.student.name,
        mine: true,
        upvotes: 0,
        hasPhoto: report.withPhoto,
        aiConfidence: analysis.confidence,
        aiDepartment: analysis.department,
        resolutionSummary: "",
        simulated: true,
      };
      setData((d) => (d ? { ...d, issues: [issue, ...d.issues] } : d));
      notify(["student"], { kind: "report", title: "Report received", body: `"${issue.title}" was added as ${issue.id}. (Demo)`, issueId: issue.id });
      notify(["admin"], { kind: "report", title: `New ${issue.priority.toLowerCase()}-priority report`, body: `"${issue.title}" at ${issue.location}.`, issueId: issue.id });
      toast.demo("Demo report submitted", `${issue.id} was added to this demo only. ${NOTE}`);
      return issue;
    },
    [data, notify, toast]
  );

  const assignIssue = useCallback(
    (id: string, workerId: string) => {
      const issue = find(id);
      if (!issue) return;
      patch(id, (i) => ({ ...i, assignedTo: workerId }));
      notify(["worker"], { kind: "assigned", title: "New task assigned", body: `"${issue.title}" was assigned to ${workerName(workerId)}. (Demo)`, issueId: id });
      toast.demo("Demo assignment", `${workerName(workerId)} now has ${id}. ${NOTE}`);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, patch, notify, toast]
  );

  const startIssue = useCallback(
    (id: string) => {
      const issue = find(id);
      if (!issue) return;
      patch(id, (i) => ({ ...i, status: "In Progress", startedAt: new Date(), assignedTo: i.assignedTo || DEMO_PERSONA.worker.id }));
      notify(["student"], { kind: "status", title: "Work has started", body: `"${issue.title}" is now in progress.`, issueId: id });
      toast.demo("Work started", `${id} is now in progress. ${NOTE}`);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, patch, notify, toast]
  );

  const resolveIssue = useCallback(
    (id: string, summary: string) => {
      const issue = find(id);
      if (!issue) return;
      patch(id, (i) => ({ ...i, status: "Resolved", startedAt: i.startedAt ?? new Date(), resolvedAt: new Date(), resolutionSummary: summary.trim() }));
      notify(["student"], { kind: "status", title: "Your issue was resolved", body: `"${issue.title}" has been marked resolved. How was the fix?`, issueId: id });
      toast.demo("Demo resolution", `${id} was marked resolved. ${NOTE}`);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, patch, notify, toast]
  );

  const submitClaim = useCallback(
    (id: string, amount: number, description: string) => {
      const issue = find(id);
      if (!issue) return;
      patch(id, (i) => ({ ...i, claim: { amount, description: description.trim(), status: "pending" } }));
      notify(["admin"], { kind: "claim", title: "Expense claim to review", body: `₹${amount.toLocaleString("en-IN")} for "${issue.title}".`, issueId: id });
      toast.demo("Demo claim submitted", `₹${amount.toLocaleString("en-IN")} is waiting for an administrator. ${NOTE}`);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, patch, notify, toast]
  );

  const decideClaim = useCallback(
    (id: string, decision: "approved" | "rejected") => {
      const issue = find(id);
      if (!issue?.claim) return;
      patch(id, (i) => (i.claim ? { ...i, claim: { ...i.claim, status: decision } } : i));
      notify(["worker"], {
        kind: "claim",
        title: decision === "approved" ? "Expense claim paid" : "Expense claim rejected",
        body: decision === "approved" ? `₹${issue.claim.amount.toLocaleString("en-IN")} for "${issue.title}" was paid. (Demo)` : `The claim for "${issue.title}" was not approved.`,
        issueId: id,
      });
      toast.demo(decision === "approved" ? "Demo payment" : "Claim rejected (demo)", decision === "approved" ? `No real transaction was created. ${NOTE}` : NOTE);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, patch, notify, toast]
  );

  const rateIssue = useCallback(
    (id: string, rating: number, comment: string) => {
      patch(id, (i) => ({ ...i, feedback: { rating, comment: comment.trim() } }));
      toast.demo("Thanks for the feedback", `Rated ${rating}/5 in the demo. ${NOTE}`);
    },
    [patch, toast]
  );

  const upvoteIssue = useCallback(
    (id: string) => {
      patch(id, (i) => ({ ...i, upvotes: i.upvotes + 1 }));
      toast.demo("Upvoted (demo)", NOTE);
    },
    [patch, toast]
  );

  const saveSla = useCallback(
    (hours: SlaConfig["hours"]) => {
      const problem = validateSlaHours(hours);
      if (problem) return problem;
      setSlaConfig({ hours, isDefault: false });
      toast.demo("Deadline targets updated", `Every deadline and compliance figure was recalculated for this demo. ${NOTE}`);
      return null;
    },
    [toast]
  );

  const approveWorkerRequest = useCallback(
    (id: string, approve: boolean) => {
      setRequests((list) => list.filter((r) => r.id !== id));
      toast.demo(approve ? "Worker access approved (demo)" : "Request declined (demo)", NOTE);
    },
    [toast]
  );

  const markRead = useCallback((id: string) => setNotes((p) => ({ ...p, [role]: p[role].map((n) => (n.id === id ? { ...n, read: true } : n)) })), [role]);
  const markAllRead = useCallback(() => {
    setNotes((p) => ({ ...p, [role]: p[role].map((n) => ({ ...n, read: true })) }));
    toast.demo("Notifications marked as read", NOTE);
  }, [role, toast]);

  const demoToast = useCallback((title: string, description?: string) => toast.demo(title, description ?? NOTE), [toast]);

  const closeTour = useCallback(() => {
    markViewerGuideSeen();
    setTourOpen(false);
  }, []);

  const value: ViewerContextValue = {
    data,
    stats,
    slaConfig,
    role,
    setRole,
    notifications: notes[role],
    unread: notes[role].filter((n) => !n.read).length,
    markRead,
    markAllRead,
    workerRequests: requests,
    createIssue,
    assignIssue,
    startIssue,
    resolveIssue,
    submitClaim,
    decideClaim,
    rateIssue,
    upvoteIssue,
    saveSla,
    approveWorkerRequest,
    demoToast,
    openTour: (fromStart = true) => {
      setTourStart(fromStart ? 0 : tourStart);
      setTourOpen(true);
    },
    openSearch: () => setSearchOpen(true),
  };

  return (
    <ViewerContext.Provider value={value}>
      {children}
      <ViewerTour open={tourOpen} steps={TOUR_STEPS} startIndex={tourStart} onClose={closeTour} />
      <ViewerCommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} now={now} />
    </ViewerContext.Provider>
  );
}
