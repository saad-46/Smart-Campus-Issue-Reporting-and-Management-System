import type { Metadata } from "next";
import ViewerProvider from "@/components/viewer/ViewerProvider";
import ViewerShell from "@/components/viewer/ViewerShell";

export const metadata: Metadata = {
  title: "Viewer Mode",
  description: "Explore the whole platform, from reporting to analytics, on a sample campus. No account needed; nothing is saved.",
};

/**
 * Public Viewer. No ProtectedRoute and no auth/role checks because nothing
 * here is private: every page renders the generated demo dataset in
 * lib/viewer, actions edit a local copy that disappears on leave, and
 * nothing reads or writes Firestore.
 */
export default function ViewerLayout({ children }: { children: React.ReactNode }) {
  return (
    <ViewerProvider>
      <ViewerShell>{children}</ViewerShell>
    </ViewerProvider>
  );
}
