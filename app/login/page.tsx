"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthContext } from "@/components/AuthProvider";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";

// Routing constants handled inside useEffect

export default function LoginPage() {
  const { signIn, userProfile, loading } = useAuthContext();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  // Track whether this is a fresh login (not a page load while already signed in)
  const [justSignedIn, setJustSignedIn] = useState(false);

  // Only auto-redirect if the user JUST signed in — not on page load
  useEffect(() => {
    if (loading) return;
    if (!justSignedIn) return;   // ← key: don't redirect on initial load
    if (!userProfile) return;

    // Persist role into localStorage right away to sync the layout fast
    const newRole = userProfile.activeRole || userProfile.role || "user";
    localStorage.setItem("role", newRole);

    const role = localStorage.getItem("role");
    console.log(`✅ activeRole="${role}" → Redirecting`);

    if (role === "admin") {
      router.push("/admin");
    } else if (role === "worker") {
      router.push("/worker");
    } else {
      router.push("/dashboard"); // USER
    }
  }, [loading, userProfile, justSignedIn, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      await signIn(email, password);
      setJustSignedIn(true); // allow redirect now
    } catch (err: unknown) {
      const fe = err as { code?: string };
      if (
        fe.code === "auth/user-not-found" ||
        fe.code === "auth/wrong-password" ||
        fe.code === "auth/invalid-credential"
      ) {
        setError("Invalid email or password.");
      } else if (fe.code === "auth/too-many-requests") {
        setError("Too many attempts. Please try again later.");
      } else {
        setError("Failed to sign in. Please try again.");
      }
      setIsLoading(false);
    }
  };

  // Already logged in — show options instead of form
  if (!loading && userProfile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-xl">
            <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-purple-500/30">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <p className="text-white font-bold text-lg mb-1">Already signed in</p>
            <p className="text-gray-400 text-sm mb-1">{userProfile.email}</p>
            <span className="inline-block px-3 py-1 bg-white/10 rounded-full text-xs text-gray-300 capitalize mb-6">
              Role: <strong className="text-white">{userProfile.role}</strong>
            </span>

            <div className="space-y-3">
              <button
                onClick={() => router.replace(getRedirectPath(userProfile.role))}
                className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-90 text-white text-sm font-bold rounded-xl transition-all"
              >
                Go to My Dashboard →
              </button>
              <Link
                href="/switch-role"
                className="block w-full py-3 bg-white/10 hover:bg-white/20 text-white text-sm font-semibold rounded-xl transition-all border border-white/10"
              >
                🎭 Switch Role (Demo)
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
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
          <h1 className="text-2xl font-bold text-white mb-2">Welcome back</h1>
          <p className="text-sm text-gray-400">Sign in to continue</p>
        </div>

        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-xl">
          <form onSubmit={handleSubmit} className="space-y-5">
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
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              }
            />

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-sm text-red-400">
                {error}
              </div>
            )}

            <Button type="submit" isLoading={isLoading} className="w-full" size="lg">
              Sign In
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500">
              Don&apos;t have an account?{" "}
              <Link href="/register" className="text-purple-400 hover:text-purple-300 font-medium transition-colors">
                Create one
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
