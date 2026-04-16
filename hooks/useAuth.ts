// ============================================
// useAuth Hook — Firebase Authentication State
// ============================================
// Provides auth state, user profile, and auth methods
// throughout the application via React context.

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
  const [loading, setLoading] = useState(true);

  // Listen to Firebase auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);

      if (user) {
        // Fetch the user's profile from Firestore
        const profile = await getUserProfile(user.uid);
        setUserProfile(profile);
      } else {
        setUserProfile(null);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setLoading(true);
    try {
      console.log("🔐 useAuth: Starting sign in...");
      await authSignIn(email, password);
      console.log("✅ useAuth: Sign in successful");
    } catch (error) {
      console.error("❌ useAuth: Sign in error:", error);
      // Re-throw the error so the component can handle it
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const signUp = useCallback(
    async (email: string, password: string, name: string, role: UserRole) => {
      setLoading(true);
      try {
        console.log("🚀 useAuth: Starting signup...");
        const profile = await authSignUp(email, password, name, role);
        setUserProfile(profile);
        console.log("✅ useAuth: Signup successful, profile set");
      } catch (error) {
        console.error("❌ useAuth: Signup error:", error);
        // Re-throw the error so the component can handle it
        throw error;
      } finally {
        setLoading(false);
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
    isAuthenticated: !!firebaseUser,
  };
}
