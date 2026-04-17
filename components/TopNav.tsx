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
  const [toastMsg, setToastMsg] = useState("");
  const { switchRole } = useAuthContext();

  const handleSwitchRole = async (role: "user" | "worker" | "admin") => {
    if (!switchRole) return;
    await switchRole(role);
    setToastMsg(`Switched to ${role.charAt(0).toUpperCase() + role.slice(1)} Dashboard`);
    setTimeout(() => setToastMsg(""), 3000);
    
    // Route based on role
    if (role === "admin") router.push("/admin");
    else if (role === "worker") router.push("/worker");
    else router.push("/dashboard");
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace("/");
  };

  // Role-aware nav links (Admin gets empty tabs)
  const links = isAdmin
    ? []
    : isWorker
    ? [
        { href: "/worker", label: "My Tasks" },
        { href: "/dashboard?tab=report", label: "Report Issue" },
      ]
    : [
        { href: "/dashboard", label: "My Issues" },
        { href: "/dashboard?tab=report", label: "Report Issue" },
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
        <div className="flex items-center gap-3">
          
          {/* Admin Export Button */}
          {isAdmin && (
            <div className="relative group">
              <button className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 border border-gray-200 dark:border-white/10 rounded-lg text-sm font-medium transition-all duration-300 group-hover:shadow-md">
                <svg className="w-4 h-4 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                Export Report
              </button>
              {/* Dropdown UI mapped later dynamically in AdminPage or simply trigger event listener */}
              <div className="absolute right-0 top-full mt-2 w-32 bg-white dark:bg-slate-800 border border-gray-200 dark:border-white/10 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 flex flex-col overflow-hidden">
                <button onClick={() => window.dispatchEvent(new CustomEvent('EXPORT_CSV'))} className="px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 font-medium border-b border-gray-100 dark:border-white/5 transition-colors tracking-wide truncate">
                  CSV Data
                </button>
                <button onClick={() => window.dispatchEvent(new CustomEvent('EXPORT_EXCEL'))} className="px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 font-medium transition-colors tracking-wide truncate">
                  Excel Data
                </button>
              </div>
            </div>
          )}

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
                  {userProfile.activeRole || userProfile.role}
                </span>
              </div>

              {/* Role Switcher */}
              <div className="hidden sm:block relative group">
                <button className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 border border-gray-200 dark:border-white/10 rounded-lg text-sm font-medium transition-all duration-300">
                  <span className="capitalize">{userProfile.activeRole || userProfile.role} Mode</span>
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
                </button>
                <div className="absolute right-0 top-full mt-2 w-36 bg-white dark:bg-slate-800 border border-gray-200 dark:border-white/10 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 flex flex-col overflow-hidden">
                  <button onClick={() => handleSwitchRole("user")} className="px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 font-medium border-b border-gray-100 dark:border-white/5 transition-colors tracking-wide truncate">
                    User Mode
                  </button>
                  <button onClick={() => handleSwitchRole("worker")} className="px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 font-medium border-b border-gray-100 dark:border-white/5 transition-colors tracking-wide truncate">
                    Worker Mode
                  </button>
                  <button onClick={() => handleSwitchRole("admin")} className="px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 font-medium transition-colors tracking-wide truncate">
                    Admin Mode
                  </button>
                </div>
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
      {toastMsg && (
        <div className="fixed bottom-4 right-4 bg-gray-900 border border-gray-700 text-white px-5 py-3 rounded-xl shadow-2xl z-50 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 transition-all duration-300">
          <div className="w-8 h-8 bg-purple-500/20 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
          </div>
          <span className="font-medium text-sm">{toastMsg}</span>
        </div>
      )}
    </header>
  );
}
