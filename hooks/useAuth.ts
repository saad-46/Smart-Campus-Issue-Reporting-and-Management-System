"use client";

import { useState, useEffect, useCallback } from "react";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { auth } from "@/lib/firebase";
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
  // Start true — stays true until BOTH auth state AND profile are resolved
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);

      if (user) {
        // Fetch profile — keep loading=true until this resolves
        const profile = await getUserProfile(user.uid);
        console.log("👤 Profile loaded:", profile?.role, "uid:", user.uid);
        setUserProfile(profile);
      } else {
        setUserProfile(null);
      }

      // Only mark loading done AFTER profile is fetched
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    // Do NOT touch loading here — let onAuthStateChanged handle it
    try {
      await authSignIn(email, password);
      // onAuthStateChanged will fire, fetch profile, then set loading=false
    } catch (error) {
      throw error;
    }
  }, []);

  const signUp = useCallback(
    async (email: string, password: string, name: string, role: UserRole) => {
      try {
        const profile = await authSignUp(email, password, name, role);
        // Profile is already set by signUp, onAuthStateChanged will also fire
        setUserProfile(profile);
        console.log("✅ Signup complete, role:", profile.role);
      } catch (error) {
        throw error;
      }
    },
    []
  );

  const signOut = useCallback(async () => {
    await authSignOut();
    setUserProfile(null);
  }, []);

  return {
    user: firebaseUser,
    userProfile,
    loading,
    signIn,
    signUp,
    signOut,
    isAdmin: userProfile?.role === "admin",
    isWorker: userProfile?.role === "worker",
    isAuthenticated: !!firebaseUser,
  };
}
