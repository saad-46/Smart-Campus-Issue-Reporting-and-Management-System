"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { buildDemoData, DemoData } from "@/lib/viewer/demoData";
import { demoStats, DemoStats } from "@/lib/viewer/demoStats";
import { hasSeenViewerGuide, markViewerGuideSeen } from "@/lib/viewer/guide";
import ViewerGuide from "./ViewerGuide";
import SampleIssueDialog from "./SampleIssueDialog";
import SignInPrompt from "./SignInPrompt";

interface ViewerContextValue {
  /** null until mounted (the sample dataset is built relative to the viewer's clock). */
  data: DemoData | null;
  stats: DemoStats | null;
  openIssue: (id: string) => void;
  /** Explain that a real action needs an account — never pretend it happened. */
  promptSignIn: (feature: string) => void;
  openGuide: () => void;
}

const ViewerContext = createContext<ViewerContextValue | null>(null);

export function useViewer(): ViewerContextValue {
  const ctx = useContext(ViewerContext);
  if (!ctx) throw new Error("useViewer must be used inside ViewerProvider");
  return ctx;
}

/**
 * Public, read-only Viewer state. It never touches Firebase: the data is the
 * static sample set in lib/viewer, and there is no user, role or permission
 * here to escalate.
 */
export default function ViewerProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<DemoData | null>(null);
  const [issueId, setIssueId] = useState<string | null>(null);
  const [signInFeature, setSignInFeature] = useState<string | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);

  useEffect(() => {
    setData(buildDemoData(new Date()));
    if (!hasSeenViewerGuide()) setGuideOpen(true);
  }, []);

  const stats = useMemo(() => (data ? demoStats(data) : null), [data]);
  const issue = issueId && data ? data.issues.find((i) => i.id === issueId) ?? null : null;

  const openIssue = useCallback((id: string) => setIssueId(id), []);
  const promptSignIn = useCallback((feature: string) => setSignInFeature(feature), []);
  const openGuide = useCallback(() => setGuideOpen(true), []);

  const closeGuide = () => {
    markViewerGuideSeen();
    setGuideOpen(false);
  };

  const value = useMemo(() => ({ data, stats, openIssue, promptSignIn, openGuide }), [data, stats, openIssue, promptSignIn, openGuide]);

  return (
    <ViewerContext.Provider value={value}>
      {children}
      <ViewerGuide open={guideOpen} onClose={closeGuide} />
      <SampleIssueDialog issue={issue} data={data} onClose={() => setIssueId(null)} />
      <SignInPrompt feature={signInFeature} onClose={() => setSignInFeature(null)} />
    </ViewerContext.Provider>
  );
}
