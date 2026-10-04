"use client";

import { useAuthContext } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import ProfileUnavailable from "./ProfileUnavailable";
import { ShellSkeleton } from "./shell/StatusScreen";

// Auth-only guard (no role restriction); AdminGuard / WorkerGuard handle roles.
export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, userProfile, loading } = useAuthContext();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      // Come back here after signing in (e.g. a scanned QR report link).
      const here = `${window.location.pathname}${window.location.search}`;
      router.replace(here === "/" ? "/login" : `/login?next=${encodeURIComponent(here)}`);
    }
  }, [isAuthenticated, loading, router]);

  if (loading) return <ShellSkeleton />;
  if (!isAuthenticated) return null;
  if (!userProfile) return <ProfileUnavailable />;
  return <>{children}</>;
}
