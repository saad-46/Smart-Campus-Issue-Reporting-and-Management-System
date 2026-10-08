import { AuthProvider } from "@/components/AuthProvider";

/**
 * Everything that works with real accounts lives in this route group, so
 * Firebase Auth starts only here. The public Viewer (app/viewer) sits outside
 * it and never loads the Firebase SDK, so it cannot make Firebase requests
 * even if a visitor happens to be signed in elsewhere.
 */
export default function AppGroupLayout({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
