"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthContext } from "@/components/AuthProvider";
import ThemeToggle from "@/components/ThemeToggle";
import { UserRole } from "@/types";

export default function TopNav() {
  const { userProfile, signOut, isAuthenticated, isAdmin, isWorker, switchRole } = useAuthContext();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    router.replace("/");
  };

  const currentRole = userProfile?.activeRole || userProfile?.role || "user";

  const handleRoleSwitch = async (newRole: UserRole) => {
    console.log("🔄 Switching to role:", newRole);
    await switchRole(newRole);
    
    // Immediate redirection logic
    if (newRole === "admin") {
      router.push("/admin");
    } else if (newRole === "worker") {
      router.push("/worker");
    } else {
      router.push("/dashboard");
    }
  };

  const roleBadge = isAdmin
    ? "bg-purple-500/20 text-purple-600 dark:text-purple-400 border-purple-500/30"
    : isWorker
    ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
    : "bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30";

  return (
    <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-gray-200 dark:border-white/10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-7 h-7 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center shadow shadow-purple-500/30 group-hover:scale-110 transition-transform">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" />
            </svg>
          </div>
          <span className="font-bold text-sm bg-gradient-to-r from-purple-600 to-indigo-600 dark:from-purple-400 dark:to-indigo-400 bg-clip-text text-transparent hidden sm:block">
            UniFix
          </span>
        </Link>

        {/* Right side — clean minimal */}
        <div className="flex items-center gap-2">
          {isAuthenticated && (
            <div className="relative group">
              <select
                value={userProfile?.activeRole || userProfile?.role || "user"}
                onChange={(e) => handleRoleSwitch(e.target.value as UserRole)}
                className="appearance-none pl-3 pr-8 py-1.5 rounded-lg bg-gray-100 dark:bg-white/10 border border-gray-200 dark:border-white/10 text-xs font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all hover:bg-gray-200 dark:hover:bg-white/20"
              >
                <option value="user">User Mode</option>
                <option value="worker">Worker Mode</option>
                <option value="admin">Admin Mode</option>
              </select>
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-indigo-500">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7"/></svg>
              </div>
            </div>
          )}

          <ThemeToggle />

          {isAuthenticated && userProfile && (
            <>
              {/* User chip */}
              <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10">
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-[10px] font-bold">
                  {userProfile.name?.charAt(0).toUpperCase()}
                </div>
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300 max-w-[80px] truncate">
                  {userProfile.name}
                </span>
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border capitalize ${roleBadge}`}>
                  {userProfile.role}
                </span>
              </div>

              {/* Sign out */}
              <button
                onClick={handleSignOut}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-all duration-200"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Sign Out
              </button>
            </>
          )}

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-1.5 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {menuOpen
                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              }
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && isAuthenticated && (
        <div className="md:hidden border-t border-gray-200 dark:border-white/10 bg-white dark:bg-slate-900 px-4 py-4 space-y-4">
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 px-3">Switch Role</label>
            <div className="relative">
              <select
                value={userProfile?.activeRole || userProfile?.role || "user"}
                onChange={(e) => handleRoleSwitch(e.target.value as UserRole)}
                className="w-full appearance-none px-4 py-3 rounded-xl bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm font-bold text-indigo-600 dark:text-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="user">User Mode</option>
                <option value="worker">Worker Mode</option>
                <option value="admin">Admin Mode</option>
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-indigo-500">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7"/></svg>
              </div>
            </div>
          </div>

          <button
            onClick={handleSignOut}
            className="w-full text-left px-3 py-3 rounded-xl text-sm font-black uppercase tracking-widest text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
          >
            Sign Out
          </button>
        </div>
      )}
    </header>
  );
}
