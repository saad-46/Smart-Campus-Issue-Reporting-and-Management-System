"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthContext } from "@/components/AuthProvider";
import ThemeToggle from "@/components/ThemeToggle";

export default function TopNav() {
  const { userProfile, signOut, isAuthenticated, isAdmin, isWorker } = useAuthContext();
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    router.replace("/");
  };

  // Role-aware nav links
  const links = isAdmin
    ? [
        { href: "/admin", label: "Dashboard" },
        { href: "/dashboard/report", label: "Report Issue" },
      ]
    : isWorker
    ? [
        { href: "/worker", label: "My Tasks" },
        { href: "/dashboard/report", label: "Report Issue" },
      ]
    : [
        { href: "/dashboard", label: "My Issues" },
        { href: "/dashboard/report", label: "Report Issue" },
      ];

  const roleBadge = isAdmin
    ? "bg-purple-500/20 text-purple-600 dark:text-purple-400 border-purple-500/30"
    : isWorker
    ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
    : "bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30";

  return (
    <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-gray-200 dark:border-white/10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0 group">
          <div className="w-7 h-7 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center shadow shadow-purple-500/30 group-hover:scale-110 transition-transform">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" />
            </svg>
          </div>
          <span className="font-bold text-sm bg-gradient-to-r from-purple-600 to-indigo-600 dark:from-purple-400 dark:to-indigo-400 bg-clip-text text-transparent hidden sm:block">
            UniFix
          </span>
        </Link>

        {/* Desktop nav links */}
        <nav className="hidden md:flex items-center gap-1">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                pathname === l.href
                  ? "bg-purple-500/10 text-purple-600 dark:text-purple-400"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-2">
          <ThemeToggle />

          {isAuthenticated && userProfile && (
            <>
              {/* User chip */}
              <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10">
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
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
      {menuOpen && (
        <div className="md:hidden border-t border-gray-200 dark:border-white/10 bg-white dark:bg-slate-900 px-4 py-3 space-y-1">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setMenuOpen(false)}
              className={`block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                pathname === l.href
                  ? "bg-purple-500/10 text-purple-600 dark:text-purple-400"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5"
              }`}
            >
              {l.label}
            </Link>
          ))}
          {isAuthenticated && (
            <button
              onClick={handleSignOut}
              className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
            >
              Sign Out
            </button>
          )}
        </div>
      )}
    </header>
  );
}
