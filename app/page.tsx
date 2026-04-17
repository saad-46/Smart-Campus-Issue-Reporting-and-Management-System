"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import { useAuthContext } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";

function getRoleRedirect(role: string) {
  if (role === "admin") return "/admin";
  if (role === "worker") return "/worker";
  return "/dashboard";
}

export default function LandingPage() {
  const { isAuthenticated, userProfile, loading } = useAuthContext();
  const router = useRouter();

  useEffect(() => {
    if (!loading && isAuthenticated && userProfile) {
      router.replace(getRoleRedirect(userProfile.role));
    }
  }, [isAuthenticated, userProfile, loading, router]);

  const stats = [
    { value: "500+", label: "Issues Resolved" },
    { value: "98%", label: "Satisfaction Rate" },
    { value: "< 2hr", label: "Avg Response Time" },
    { value: "24/7", label: "Availability" },
  ];

  const features = [
    { icon: "🤖", title: "AI-Powered Analysis", desc: "Automatically categorizes issues and assigns priority levels for faster resolution." },
    { icon: "⚡", title: "Real-Time Updates", desc: "Track reported issues live. Get instant updates when status changes." },
    { icon: "🛡️", title: "Smart Management", desc: "Admins and workers can efficiently assign, track, and resolve issues." },
  ];

  return (
    /* ── Outer wrapper — theme-aware background ── */
    <div className="min-h-screen bg-gradient-to-br from-white via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-purple-950 dark:to-slate-900 transition-colors duration-300">

      {/* Subtle grid overlay */}
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(rgba(99,102,241,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.03)_1px,transparent_1px)] bg-[size:60px_60px]" />

      {/* ── Navbar ── */}
      <nav className="relative z-10 border-b border-gray-200 dark:border-white/10 bg-white/70 dark:bg-black/20 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/30">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" />
              </svg>
            </div>
            <span className="text-lg font-bold bg-gradient-to-r from-purple-600 to-indigo-600 dark:from-purple-400 dark:to-indigo-400 bg-clip-text text-transparent">
              UniFix
            </span>
          </div>

          {/* Right — only theme toggle + Get Started */}
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link
              href="/register"
              className="px-4 py-2 text-sm font-semibold rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 hover:opacity-90 transition-all duration-200"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative z-10 pt-24 pb-20 px-4">
        <div className="max-w-5xl mx-auto text-center">

          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-purple-500/10 border border-purple-500/20 rounded-full text-sm text-purple-600 dark:text-purple-400 mb-8">
            <span className="w-2 h-2 bg-purple-500 dark:bg-purple-400 rounded-full animate-pulse" />
            AI-Powered Campus Management
          </div>

          {/* Heading */}
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold leading-tight mb-6 text-gray-900 dark:text-white">
            Fix Campus Issues,{" "}
            <span className="bg-gradient-to-r from-purple-600 to-indigo-500 dark:from-purple-400 dark:to-indigo-400 bg-clip-text text-transparent">
              Smarter
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-gray-500 dark:text-gray-400 max-w-2xl mx-auto mb-12 leading-relaxed">
            UniFix uses AI to automatically categorize, prioritize, and route campus issues —
            making your campus safer and better maintained.
          </p>

          {/* ── 3 Role Entry Points — all go to /login ── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto mb-16">

            {/* Report Issue → /login */}
            <Link href="/login?role=user" className="group">
              <div className="p-6 rounded-2xl border border-blue-200 dark:border-blue-500/30 bg-white dark:bg-blue-500/10 shadow-sm dark:shadow-none hover:shadow-md hover:border-blue-400 dark:hover:border-blue-500/50 hover:bg-blue-50 dark:hover:bg-blue-500/20 hover:scale-[1.03] transition-all duration-300">
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-500/20 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:bg-blue-200 dark:group-hover:bg-blue-500/30 transition-colors">
                  <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">Report Issue</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">As a Student / Staff</p>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 group-hover:gap-2 transition-all">
                  Sign In →
                </span>
              </div>
            </Link>

            {/* Worker Login → /login */}
            <Link href="/login?role=worker" className="group">
              <div className="p-6 rounded-2xl border border-emerald-200 dark:border-emerald-500/30 bg-white dark:bg-emerald-500/10 shadow-sm dark:shadow-none hover:shadow-md hover:border-emerald-400 dark:hover:border-emerald-500/50 hover:bg-emerald-50 dark:hover:bg-emerald-500/20 hover:scale-[1.03] transition-all duration-300">
                <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-500/20 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:bg-emerald-200 dark:group-hover:bg-emerald-500/30 transition-colors">
                  <svg className="w-6 h-6 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">Worker Login</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Resolve assigned tasks</p>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 group-hover:gap-2 transition-all">
                  Sign In →
                </span>
              </div>
            </Link>

            {/* Admin Login → /login */}
            <Link href="/login?role=admin" className="group">
              <div className="p-6 rounded-2xl border border-purple-200 dark:border-purple-500/30 bg-white dark:bg-purple-500/10 shadow-sm dark:shadow-none hover:shadow-md hover:border-purple-400 dark:hover:border-purple-500/50 hover:bg-purple-50 dark:hover:bg-purple-500/20 hover:scale-[1.03] transition-all duration-300">
                <div className="w-12 h-12 bg-purple-100 dark:bg-purple-500/20 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:bg-purple-200 dark:group-hover:bg-purple-500/30 transition-colors">
                  <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">Admin Login</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Manage the system</p>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-purple-600 dark:text-purple-400 group-hover:gap-2 transition-all">
                  Sign In →
                </span>
              </div>
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
            {stats.map((stat) => (
              <div key={stat.label} className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-4 shadow-sm dark:shadow-none">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
                <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="relative z-10 py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-4">How It Works</h2>
            <p className="text-gray-500 dark:text-gray-400 max-w-xl mx-auto">
              Three simple steps to report and resolve campus issues efficiently
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <div
                key={f.title}
                className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-8 shadow-sm dark:shadow-none hover:shadow-md dark:hover:border-purple-500/30 hover:scale-[1.02] transition-all duration-300"
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-purple-100 dark:bg-purple-500/10 rounded-xl flex items-center justify-center text-2xl">
                    {f.icon}
                  </div>
                  <span className="text-xs text-gray-400 font-mono">0{i + 1}</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">{f.title}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="relative z-10 border-t border-gray-200 dark:border-white/10 py-8 px-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">UniFix</span>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-600">
            &copy; {new Date().getFullYear()} UniFix. Built for DEV ARENA Hackathon.
          </p>
        </div>
      </footer>
    </div>
  );
}
