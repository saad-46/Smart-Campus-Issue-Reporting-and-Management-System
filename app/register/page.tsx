"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthContext } from "@/components/AuthProvider";
import { UserRole } from "@/types";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";

function getRoleRedirect(role: string): string {
  if (role === "admin") return "/admin";
  if (role === "worker") return "/worker";
  return "/dashboard";
}

export default function RegisterPage() {
  const { signUp, userProfile, loading } = useAuthContext();
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("user");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Track whether the user was already logged in when the page first loaded.
  // If they were already logged in → redirect immediately.
  // If they just signed up → also redirect (justSignedUp flag).
  const justSignedUp = useRef(false);
  const initialLoadDone = useRef(false);

  useEffect(() => {
    if (loading) return;

    if (!initialLoadDone.current) {
      initialLoadDone.current = true;
      // If already logged in when page loads, redirect away
      if (userProfile) {
        const path = getRoleRedirect(userProfile.role);
        console.log(`Already logged in as "${userProfile.role}" → ${path}`);
        router.replace(path);
      }
      return;
    }

    // After initial load: only redirect if we just signed up
    if (justSignedUp.current && userProfile) {
      const path = getRoleRedirect(userProfile.role);
      console.log(`✅ Signed up as "${userProfile.role}" → ${path}`);
      router.replace(path);
    }
  }, [userProfile, loading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) { setError("Please enter your full name."); return; }
    if (!email.trim()) { setError("Please enter your email address."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }

    setIsLoading(true);
    try {
      justSignedUp.current = true;
      await signUp(email, password, name, role);
      // Redirect handled by useEffect once userProfile loads
    } catch (err: unknown) {
      justSignedUp.current = false;
      if (err && typeof err === "object" && "code" in err) {
        const fe = err as { code: string; message?: string };
        switch (fe.code) {
          case "auth/email-already-in-use":
            setError("This email is already registered. Please sign in instead.");
            break;
          case "auth/invalid-email":
            setError("Invalid email address format.");
            break;
          case "auth/weak-password":
            setError("Password is too weak. Use at least 6 characters.");
            break;
          default:
            setError(fe.message || "Registration failed. Please try again.");
        }
      } else {
        setError("Failed to create account. Please try again.");
      }
      setIsLoading(false);
    }
  };

  const roles: { value: UserRole; color: string; activeColor: string; icon: React.ReactNode; title: string; desc: string }[] = [
    {
      value: "user",
      color: "border-blue-500/30 bg-blue-500/5 text-blue-400",
      activeColor: "border-blue-500 bg-blue-500/15 text-blue-400 shadow-lg shadow-blue-500/20",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
      title: "Report Issues",
      desc: "Student / Staff",
    },
    {
      value: "worker",
      color: "border-emerald-500/30 bg-emerald-500/5 text-emerald-400",
      activeColor: "border-emerald-500 bg-emerald-500/15 text-emerald-400 shadow-lg shadow-emerald-500/20",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
      title: "Resolve Issues",
      desc: "Maintenance Worker",
    },
    {
      value: "admin",
      color: "border-purple-500/30 bg-purple-500/5 text-purple-400",
      activeColor: "border-purple-500 bg-purple-500/15 text-purple-400 shadow-lg shadow-purple-500/20",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      title: "Manage System",
      desc: "Administrator",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/30">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" />
              </svg>
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
              UniFix
            </span>
          </Link>
          <h1 className="text-2xl font-bold text-white mb-2">Create your account</h1>
          <p className="text-sm text-gray-400">Choose your role and get started</p>
        </div>

        {/* Form card */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-xl">
          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              label="Full Name"
              type="text"
              placeholder="John Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              }
            />
            <Input
              label="Email Address"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              }
            />
            <Input
              label="Password"
              type="password"
              placeholder="Min. 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              }
            />

            {/* Role selection */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">
                I am a…
              </label>
              <div className="grid grid-cols-3 gap-2">
                {roles.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setRole(r.value)}
                    className={`p-3 rounded-xl border text-center transition-all duration-200 ${
                      role === r.value ? r.activeColor : r.color + " hover:opacity-80"
                    }`}
                  >
                    <div className="mx-auto mb-1.5 w-fit">{r.icon}</div>
                    <p className="text-xs font-semibold">{r.title}</p>
                    <p className="text-[10px] mt-0.5 opacity-60">{r.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-sm text-red-400">
                {error}
              </div>
            )}

            <Button type="submit" isLoading={isLoading} className="w-full" size="lg">
              Create Account
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500">
              Already have an account?{" "}
              <Link href="/login" className="text-purple-400 hover:text-purple-300 font-medium transition-colors">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
