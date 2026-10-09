"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { DEFAULT_SLA_CONFIG } from "@/lib/intelligence/sla";
import { demoStats } from "@/lib/viewer/demoStats";
import { DEMO_NOTE, DemoAction, DemoResult, DemoState, applyDemoAction, createDemoState, demoBudget, demoWorkerName, resolveDemoLocation } from "@/lib/viewer/demoStore";
import { ViewerContext, ViewerContextValue } from "./viewerContext";
import { hasSeenViewerGuide, markViewerGuideSeen, readViewerRole, writeViewerRole } from "@/lib/viewer/guide";
import { homeForRole, roleForPath, ViewerRole } from "@/lib/viewer/nav";
import { TOUR_STEPS } from "@/lib/viewer/tour";
import ViewerTour from "./ViewerTour";
import ViewerCommandPalette from "./ViewerCommandPalette";

const NO_MESSAGES: never[] = [];

/**
 * Explore Mode state. It never touches Firebase: the data is the demo
 * engine's in-memory state (lib/viewer/demoStore.ts), every action is applied
 * by that engine and disappears on reload or "Reset demo", and there is no
 * user, role claim or permission here to escalate. The perspective switch
 * only chooses which fictional account the demo acts as.
 */
export default function ViewerProvider({ children }: { children: React.ReactNode }) {
  const toast = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<DemoState | null>(null);
  const latest = useRef<DemoState | null>(null);
  const [role, setRoleState] = useState<ViewerRole>("admin");
  const roleRef = useRef<ViewerRole>("admin");
  const [tourOpen, setTourOpen] = useState(false);
  const [tourStart, setTourStart] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);

  const commit = useCallback((next: DemoState) => {
    latest.current = next;
    setState(next);
  }, []);

  useEffect(() => {
    commit(createDemoState(new Date()));
    const stored = readViewerRole() ?? "admin";
    roleRef.current = stored;
    setRoleState(stored);
    if (!hasSeenViewerGuide()) setTourOpen(true);
  }, [commit]);

  // A deep link to a role-specific page switches to that role.
  useEffect(() => {
    setRoleState((current) => {
      const next = roleForPath(pathname, current);
      if (next !== current) writeViewerRole(next);
      roleRef.current = next;
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

  const setRole = useCallback(
    (next: ViewerRole, navigate = true) => {
      roleRef.current = next;
      setRoleState(next);
      writeViewerRole(next);
      if (navigate) router.push(homeForRole(next));
    },
    [router]
  );

  /** Apply one action to the demo state. A refused action shows why and changes nothing. */
  const dispatch = useCallback(
    (action: DemoAction, quiet = false): DemoResult | null => {
      const current = latest.current;
      if (!current) return null;
      const result = applyDemoAction(current, action, roleRef.current);
      if (result.ok) {
        commit(result.state);
        if (result.toast && !quiet) toast.demo(result.toast.title, result.toast.description);
      } else if (!quiet) {
        toast.error("That isn't possible here", result.error);
      }
      return result;
    },
    [commit, toast]
  );

  const stats = useMemo(
    () => (state ? demoStats(state.data, state.sla, { workers: state.workers, budget: demoBudget(state), locations: state.locations }) : null),
    [state]
  );

  const actions = useMemo(() => {
    const ok = (action: DemoAction) => dispatch(action)?.ok ?? false;
    /** For forms that show the problem inline instead of in a toast. */
    const inline = (action: DemoAction): string | null => {
      const result = dispatch(action, true);
      if (!result) return "The demo is still loading.";
      if (!result.ok) return result.error;
      if (result.toast) toast.demo(result.toast.title, result.toast.description);
      return null;
    };
    return {
      createIssue: (report: Parameters<ViewerContextValue["createIssue"]>[0]) => {
        const result = dispatch({ type: "createIssue", report });
        return result?.ok ? result.state.data.issues.find((i) => i.id === result.issueId) ?? null : null;
      },
      assignIssue: (issueId: string, workerId: string) => ok({ type: "assign", issueId, workerId }),
      unassignIssue: (issueId: string) => ok({ type: "unassign", issueId }),
      setEscalation: (issueId: string, escalated: boolean) => ok({ type: "setEscalation", issueId, escalated }),
      startIssue: (issueId: string) => ok({ type: "start", issueId }),
      resolveIssue: (issueId: string, summary: string) => ok({ type: "resolve", issueId, summary }),
      submitClaim: (issueId: string, amount: number, description: string) => ok({ type: "submitClaim", issueId, amount, description }),
      decideClaim: (issueId: string, decision: "approved" | "rejected") => ok({ type: "decideClaim", issueId, decision }),
      rateIssue: (issueId: string, rating: number, comment: string) => ok({ type: "rate", issueId, rating, comment }),
      upvoteIssue: (issueId: string) => ok({ type: "toggleUpvote", issueId }),
      linkIssue: (issueId: string, masterId: string) => ok({ type: "link", issueId, masterId }),
      unlinkIssue: (issueId: string) => ok({ type: "unlink", issueId }),
      groupIncident: (masterId: string, issueIds: string[]) => ok({ type: "groupIncident", masterId, issueIds }),
      postMessage: (issueId: string, text: string) => inline({ type: "postMessage", issueId, text }),
      saveSla: (hours: Parameters<ViewerContextValue["saveSla"]>[0]) => inline({ type: "saveSla", hours }),
      approveWorkerRequest: (requestId: string, approve: boolean) => ok({ type: "decideWorkerRequest", requestId, approve }),
      removeWorker: (workerId: string) => ok({ type: "removeWorker", workerId }),
      addFunds: (amount: number | string) => inline({ type: "addFunds", amount }),
      addLocation: (input: Parameters<ViewerContextValue["addLocation"]>[0]) => {
        const result = dispatch({ type: "addLocation", input }, true);
        if (!result) return { error: "The demo is still loading." };
        if (!result.ok) return { error: result.error };
        if (result.toast) toast.demo(result.toast.title, result.toast.description);
        return { id: result.locationId };
      },
      deleteLocation: (locationId: string) => ok({ type: "deleteLocation", locationId }),
      markRead: (notificationId: string, read = true) => void dispatch({ type: "markRead", notificationId, read }, true),
      markAllRead: () => void dispatch({ type: "markAllRead" }),
    };
  }, [dispatch, toast]);

  const resetDemo = useCallback(() => {
    commit(createDemoState(new Date()));
    toast.demo("Demo reset", "The sample data is back to its starting point. Nothing real was affected.");
  }, [commit, toast]);

  const demoToast = useCallback((title: string, description?: string) => toast.demo(title, description ?? DEMO_NOTE), [toast]);

  const closeTour = useCallback(() => {
    markViewerGuideSeen();
    setTourOpen(false);
  }, []);

  const notifications = state?.notifications[role] ?? NO_MESSAGES;
  const value: ViewerContextValue = {
    data: state?.data ?? null,
    stats,
    slaConfig: state?.sla ?? DEFAULT_SLA_CONFIG,
    role,
    setRole,
    notifications,
    unread: notifications.filter((n) => !n.read).length,
    workerRequests: state?.workerRequests ?? NO_MESSAGES,
    workers: state?.workers ?? NO_MESSAGES,
    workerName: (id) => (state ? demoWorkerName(state, id) : "Unassigned"),
    locations: state?.locations ?? NO_MESSAGES,
    findLocation: (id) => (state ? resolveDemoLocation(state, id) : undefined),
    messagesFor: (issueId) => state?.messages[issueId] ?? NO_MESSAGES,
    changes: state?.changes ?? 0,
    resetDemo,
    ...actions,
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
      <ViewerCommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} now={state?.data.now ?? new Date()} />
    </ViewerContext.Provider>
  );
}
