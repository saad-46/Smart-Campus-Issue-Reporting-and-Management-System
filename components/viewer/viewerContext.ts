"use client";

import { createContext, useContext } from "react";
import { DemoIssue, DemoData } from "@/lib/viewer/demoData";
import { DemoStats } from "@/lib/viewer/demoStats";
import { DemoNotification } from "@/lib/viewer/demoFeed";
import { DEMO_WORKER_REQUESTS } from "@/lib/viewer/demoData";
import { ViewerRole } from "@/lib/viewer/nav";
import { Priority, SlaConfig } from "@/types";

export interface NewReport {
  title: string;
  description: string;
  locationId: string;
  category?: string;
  priority?: Priority;
  withPhoto: boolean;
}

export interface ViewerContextValue {
  /** null until mounted (the dataset is built relative to the visitor's clock). */
  data: DemoData | null;
  stats: DemoStats | null;
  slaConfig: SlaConfig;
  role: ViewerRole;
  setRole: (role: ViewerRole, navigate?: boolean) => void;
  notifications: DemoNotification[];
  unread: number;
  markRead: (id: string) => void;
  markAllRead: () => void;
  workerRequests: typeof DEMO_WORKER_REQUESTS;
  // ---- simulated actions: they change this visit's local state only ----
  createIssue: (report: NewReport) => DemoIssue | null;
  assignIssue: (issueId: string, workerId: string) => void;
  startIssue: (issueId: string) => void;
  resolveIssue: (issueId: string, summary: string) => void;
  submitClaim: (issueId: string, amount: number, description: string) => void;
  decideClaim: (issueId: string, decision: "approved" | "rejected") => void;
  rateIssue: (issueId: string, rating: number, comment: string) => void;
  upvoteIssue: (issueId: string) => void;
  saveSla: (hours: SlaConfig["hours"]) => string | null;
  approveWorkerRequest: (id: string, approve: boolean) => void;
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

