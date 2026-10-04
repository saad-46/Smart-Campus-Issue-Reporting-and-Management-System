"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthContext } from "./AuthProvider";
import ProfileUnavailable from "./ProfileUnavailable";
import StatusScreen, { ShellSkeleton } from "./shell/StatusScreen";
import Button from "./ui/Button";
import { dashboardPathForRole } from "@/lib/roles";

// UI convenience only — firestore.rules enforce admin access independently.
export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const { userProfile, loading, isAuthenticated, isAdmin, activeRole } = useAuthContext();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) {
      router.replace(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }
    if (userProfile && !isAdmin) router.replace(dashboardPathForRole(activeRole));
  }, [loading, isAuthenticated, userProfile, isAdmin, activeRole, router]);

  if (loading) return <ShellSkeleton />;
  if (!isAuthenticated) return null;
  if (!userProfile) return <ProfileUnavailable />;

  if (!isAdmin) {
    return (
      <StatusScreen
        code="403"
        title="Administrators only"
        description="This area is restricted to campus administrators."
        actions={<Button onClick={() => router.replace(dashboardPathForRole(activeRole))}>Go to my dashboard</Button>}
      />
    );
  }

  return <>{children}</>;
}
