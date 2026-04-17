"use client";

import { useState, useEffect, useCallback } from "react";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";
import {
  signIn as authSignIn,
  signUp as authSignUp,
  signOut as authSignOut,
  getUserProfile,
} from "@/lib/auth";
import { User, UserRole } from "@/types";

export function useAuth() {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<User | null>(null);
  // loading stays TRUE until both Firebase auth state AND Firestore profile are resolved
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);

      if (user) {
        try {
          const profile = await getUserProfile(user.uid);
          console.log("✅ Role loaded from Firestore:", profile?.activeRole || profile?.role, "| uid:", user.uid);
          setUserProfile(profile);
          if (profile) {
            localStorage.setItem("role", profile.activeRole || profile.role);
          }
        } catch (err) {
          console.error("❌ Failed to load user profile:", err);
          setUserProfile(null);
        }
      } else {
        setUserProfile(null);
      }

      // CRITICAL: only set loading=false AFTER profile fetch completes
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    // Don't touch loading here — onAuthStateChanged handles it
    await authSignIn(email, password);
  }, []);

  const signUp = useCallback(
    async (email: string, password: string, name: string, role: UserRole) => {
      const profile = await authSignUp(email, password, name, role);
      setUserProfile(profile);
      console.log("✅ Signup complete, role:", profile.role);
    },
    []
  );

  const signOut = useCallback(async () => {
    await authSignOut();
    setUserProfile(null);
    localStorage.removeItem("role");
  }, []);

  const switchRole = useCallback(async (role: UserRole) => {
    if (!firebaseUser) return;
    try {
      await updateDoc(doc(db, "users", firebaseUser.uid), { activeRole: role });
      localStorage.setItem("role", role);
      setUserProfile((prev) => prev ? { ...prev, activeRole: role } as User : null);
    } catch (e) {
      console.error("Failed to switch role", e);
    }
  }, [firebaseUser]);

  return {
    user: firebaseUser,
    userProfile,
    loading,
    signIn,
    signUp,
    signOut,
    switchRole,
    isAdmin: (userProfile?.activeRole || userProfile?.role) === "admin",
    isWorker: (userProfile?.activeRole || userProfile?.role) === "worker",
    isAuthenticated: !!firebaseUser,
  };
}
