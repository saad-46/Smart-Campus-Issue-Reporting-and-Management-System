// ============================================
// ProtectedRoute — Route Guard Component
// ============================================
// Restricts access to pages based on authentication
// and optionally by role (admin).

"use client";

import { useAuthContext } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { UserRole } from "@/types";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: UserRole;
}

export default function ProtectedRoute({
  children,
  requiredRole,
}: ProtectedRouteProps) {
  const { isAuthenticated, userProfile, loading } = useAuthContext();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!isAuthenticated) {
        router.push("/login");
      } else if (requiredRole && userProfile?.role !== requiredRole) {
        // Redirect to correct dashboard if wrong role
        router.push(userProfile?.role === "admin" ? "/admin" : "/dashboard");
      }
    }
  }, [isAuthenticated, userProfile, loading, requiredRole, router]);

  // Show loading spinner while checking auth
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render content if not authorized
  if (!isAuthenticated) return null;
  if (requiredRole && userProfile?.role !== requiredRole) return null;

  return <>{children}</>;
}
