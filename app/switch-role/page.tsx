"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthContext } from "@/components/AuthProvider";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { UserRole } from "@/types";

const ROLES: { role: UserRole; label: string; icon: string; desc: string; path: string; bg: string; active: string }[] = [
  {
    role: "user",
    label: "User",
    icon: "👤",
    desc: "Report campus issues",
    path: "/dashboard",
    bg: "border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20",
    active: "border-blue-500 bg-blue-500 text-white shadow-lg shadow-blue-500/30 scale-[1.03]",
  },
  {
    role: "worker",
    label: "Worker",
    icon: "🔧",
    desc: "Resolve assigned tasks",
    path: "/worker",
    bg: "border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20",
    active: "border-emerald-500 bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 scale-[1.03]",
  },
  {
    role: "admin",
    label: "Admin",
    icon: "⚙️",
    desc: "Manage the system",
    path: "/admin",
    bg: "border-purple-200 dark:border-purple-500/30 bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-500/20",
    active: "border-purple-500 bg-purple-500 text-white shadow-lg shadow-purple-500/30 scale-[1.03]",
  },
];

export default function SwitchRolePage() {
  const { userProfile, loading, switchRole } = useAuthContext();
  const router = useRouter();
  const [switching, setSwitching] = useState<UserRole | null>(null);
  const [done, setDone] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const activeRole = userProfile?.activeRole || userProfile?.role;

  if (!userProfile) {
    router.replace("/login");
    return null;
  }

  const handleSwitch = async (r: typeof ROLES[0]) => {
    if (switching || !switchRole) return;
    setSwitching(r.role);
    try {
      await switchRole(r.role);
      setDone(true);
      setTimeout(() => {
        window.location.href = r.path;
      }, 600);
    } catch (err) {
      console.error("Role switch failed:", err);
      setSwitching(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-purple-500/30">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-1 tracking-tight">UniFix Hub</h1>
          <p className="text-gray-400 text-sm">Session for <span className="text-purple-300 font-medium">{userProfile.email}</span></p>
          <div className="mt-4 inline-flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full border border-white/5">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse shadow-[0_0_8px_rgba(74,222,128,0.8)]" />
            <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">Active: <strong className="text-white ml-1">{activeRole}</strong></span>
          </div>
        </div>

        {/* Role cards */}
        <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-purple-600/20 blur-[80px] rounded-full" />
          <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-indigo-600/20 blur-[80px] rounded-full" />
          
          <p className="text-center text-xs font-black text-gray-400 uppercase tracking-widest mb-6 relative z-10">
            Switch Application Mode
          </p>

          <div className="space-y-3 mb-6 relative z-10">
            {ROLES.map((r) => {
              const isActive = activeRole === r.role;
              const isLoading = switching === r.role;

              return (
                <button
                  key={r.role}
                  onClick={() => handleSwitch(r)}
                  disabled={!!switching || done}
                  className={`
                    w-full flex items-center gap-4 p-4 rounded-2xl border transition-all duration-300 text-left active:scale-[0.98]
                    disabled:opacity-60 disabled:cursor-not-allowed
                    ${isActive ? r.active : `${r.bg} border-gray-800/40`}
                  `}
                >
                  <span className="text-2xl shrink-0 drop-shadow-md">
                    {isLoading ? "⏳" : r.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm tracking-tight">{r.label}</p>
                    <p className="text-[11px] opacity-70 font-medium">{r.desc}</p>
                  </div>
                  {isActive && (
                    <div className="flex items-center gap-1 bg-white/20 px-2 py-0.5 rounded-full">
                       <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                       <span className="text-[9px] font-black uppercase tracking-tighter">Live</span>
                    </div>
                  )}
                  {isLoading && (
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" />
                  )}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => {
              const r = ROLES.find((x) => x.role === activeRole);
              if (r) window.location.href = r.path;
            }}
            disabled={!!switching || done}
            className="w-full py-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-sm font-black rounded-2xl transition-all shadow-xl shadow-purple-500/20 disabled:opacity-50 active:scale-[0.97]"
          >
            {done ? "Initializing..." : `Enter ${activeRole?.toUpperCase()} Space →`}
          </button>
        </div>
      </div>
    </div>
  );
}

