"use client";

import { useAuthContext } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

// Simple auth-only guard — just checks if logged in, no role restriction.
// Role-specific guards (AdminGuard, WorkerGuard) handle role checks.
export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, loading } = useAuthContext();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, loading, router]);

  if (loading) {
    return (
      <div className="page-bg min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400 text-sm">Loading…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;
  return <>{children}</>;
}
