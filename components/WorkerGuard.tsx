"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthContext } from "./AuthProvider";
import ProfileUnavailable from "./ProfileUnavailable";
import StatusScreen, { ShellSkeleton } from "./shell/StatusScreen";
import Button from "./ui/Button";

// UI convenience only — firestore.rules enforce worker permissions independently.
export default function WorkerGuard({ children }: { children: React.ReactNode }) {
  const { userProfile, loading, isAuthenticated, availableRoles } = useAuthContext();
  // Workers, and admins acting as workers.
  const canWork = availableRoles.includes("worker");
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) {
      router.replace(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }
    if (userProfile && !canWork) router.replace("/dashboard");
  }, [loading, isAuthenticated, userProfile, canWork, router]);

  if (loading) return <ShellSkeleton />;
  if (!isAuthenticated) return null;
  if (!userProfile) return <ProfileUnavailable />;

  if (!canWork) {
    return (
      <StatusScreen
        code="403"
        title="Worker access required"
        description="This workspace is for approved maintenance staff. You can request access from your account."
        actions={<Button onClick={() => router.replace("/dashboard")}>Go to my dashboard</Button>}
      />
    );
  }

  return <>{children}</>;
}
