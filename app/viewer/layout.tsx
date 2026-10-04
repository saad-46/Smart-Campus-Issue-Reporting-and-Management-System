import type { Metadata } from "next";
import ViewerProvider from "@/components/viewer/ViewerProvider";
import ViewerShell from "@/components/viewer/ViewerShell";

export const metadata: Metadata = {
  title: "Viewer Mode",
  description: "Explore how campus issues are reported, assigned, resolved and analysed — read-only sample data, no account needed.",
};

/**
 * Public, read-only Viewer. No ProtectedRoute and no auth/role checks
 * because nothing here is private: every page renders the static sample
 * dataset in lib/viewer and never reads or writes Firestore.
 */
export default function ViewerLayout({ children }: { children: React.ReactNode }) {
  return (
    <ViewerProvider>
      <ViewerShell>{children}</ViewerShell>
    </ViewerProvider>
  );
}
