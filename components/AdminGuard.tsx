"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthContext } from "./AuthProvider";

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const { userProfile, loading, isAuthenticated } = useAuthContext();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }
    
    const effectiveRole = userProfile?.activeRole || userProfile?.role;
    if (userProfile && effectiveRole !== "admin") {
      const path = effectiveRole === "worker" ? "/worker" : "/dashboard";
      router.replace(path);
    }
  }, [loading, isAuthenticated, userProfile, router]);

  if (loading) {
    return (
      <div className="page-bg min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated || !userProfile) return null;

  const effectiveRole = userProfile?.activeRole || userProfile?.role;
  if (effectiveRole !== "admin") {
    return (
      <div className="page-bg min-h-screen flex items-center justify-center px-4">
        <div className="glass p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Access Denied</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            This area is restricted to administrators only.
          </p>
          <button
            onClick={() => {
              const path = userProfile.role === "worker" ? "/worker" : "/dashboard";
              router.replace(path);
            }}
            className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-90 text-white rounded-xl transition-all shadow-lg shadow-purple-500/25"
          >
            Go to My Dashboard
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
