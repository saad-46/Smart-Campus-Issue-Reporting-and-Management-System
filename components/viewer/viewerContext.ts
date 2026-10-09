"use client";

import { createContext, useContext } from "react";
import { DemoIssue, DemoData, DemoLocation, DemoWorker } from "@/lib/viewer/demoData";
import { DemoStats } from "@/lib/viewer/demoStats";
import { DemoNotification } from "@/lib/viewer/demoFeed";
import { DemoMessage, DemoWorkerRequest, NewDemoReport } from "@/lib/viewer/demoStore";
import { NewLocationInput } from "@/lib/sharedRules";
import { ViewerRole } from "@/lib/viewer/nav";
import { SlaConfig } from "@/types";

export type NewReport = NewDemoReport;

/**
 * Everything an Explore page can read or do. Each action is applied by the
 * demo engine (lib/viewer/demoStore.ts) to this visit's in-memory state and
 * returns whether it was accepted, so a page never shows success for an
 * action that was refused.
 */
export interface ViewerContextValue {
  /** null until mounted (the dataset is built relative to the visitor's clock). */
  data: DemoData | null;
  stats: DemoStats | null;
  slaConfig: SlaConfig;
  role: ViewerRole;
  setRole: (role: ViewerRole, navigate?: boolean) => void;
  notifications: DemoNotification[];
  unread: number;
  markRead: (id: string, read?: boolean) => void;
  markAllRead: () => void;
  workerRequests: DemoWorkerRequest[];
  /** People who currently have worker access. */
  workers: DemoWorker[];
  workerName: (id: string) => string;
  /** Researched campus locations plus any added during this visit. */
  locations: DemoLocation[];
  /** A location from an untrusted id (a QR link); undefined unless it is known. */
  findLocation: (id: unknown) => DemoLocation | undefined;
  messagesFor: (issueId: string) => DemoMessage[];
  /** Simulated changes made since the baseline. */
  changes: number;
  resetDemo: () => void;
  // ---- simulated actions: they change this visit's in-memory state only ----
  createIssue: (report: NewReport) => DemoIssue | null;
  assignIssue: (issueId: string, workerId: string) => boolean;
  unassignIssue: (issueId: string) => boolean;
  setEscalation: (issueId: string, escalated: boolean) => boolean;
  startIssue: (issueId: string) => boolean;
  resolveIssue: (issueId: string, summary: string) => boolean;
  submitClaim: (issueId: string, amount: number, description: string) => boolean;
  decideClaim: (issueId: string, decision: "approved" | "rejected") => boolean;
  rateIssue: (issueId: string, rating: number, comment: string) => boolean;
  upvoteIssue: (issueId: string) => boolean;
  linkIssue: (issueId: string, masterId: string) => boolean;
  unlinkIssue: (issueId: string) => boolean;
  groupIncident: (masterId: string, issueIds: string[]) => boolean;
  postMessage: (issueId: string, text: string) => string | null;
  saveSla: (hours: SlaConfig["hours"]) => string | null;
  approveWorkerRequest: (id: string, approve: boolean) => boolean;
  removeWorker: (workerId: string) => boolean;
  addFunds: (amount: number | string) => string | null;
  addLocation: (input: NewLocationInput) => { id?: string; error?: string };
  deleteLocation: (id: string) => boolean;
  /** Toast for an action that has no state of its own (exports, QR printing). */
  demoToast: (title: string, description?: string) => void;
  // ---- tour and search ----
  openTour: (fromStart?: boolean) => void;
  openSearch: () => void;
}

export const ViewerContext = createContext<ViewerContextValue | null>(null);

export function useViewer(): ViewerContextValue {
  const ctx = useContext(ViewerContext);
  if (!ctx) throw new Error("useViewer must be used inside ViewerProvider");
  return ctx;
}
