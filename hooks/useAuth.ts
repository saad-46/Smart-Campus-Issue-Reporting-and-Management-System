"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { auth } from "@/lib/firebase";
import {
  signIn as authSignIn,
  signUp as authSignUp,
  signOut as authSignOut,
  getUserProfile,
  hasAdminGrant,
  createMissingProfile,
  setActiveRole,
} from "@/lib/auth";
import { ValidationError, logError } from "@/lib/errors";
import { getAvailableRoles, resolveActiveRole } from "@/lib/roles";
import { User, UserRole } from "@/types";

/** How long to wait for Firebase Auth's first state before telling the user. */
const AUTH_INIT_TIMEOUT_MS = 12000;

export function useAuth() {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [adminGrant, setAdminGrant] = useState(false);
  const [profileError, setProfileError] = useState(false);
  // loading stays TRUE until both Firebase auth state AND Firestore profile are resolved
  const [loading, setLoading] = useState(true);
  // True if Firebase Auth never reported an initial state (e.g. the
  // browser's storage is blocked), so the UI can say so instead of spinning.
  const [initStalled, setInitStalled] = useState(false);

  // True while signUp() is writing the new profile, so the auth listener
  // doesn't race it and create a default profile first.
  const signingUp = useRef(false);
  // Bumped on every auth change so a slow profile fetch for a previous
  // user can't overwrite the state of the current one.
  const authGeneration = useRef(0);

  const loadProfile = useCallback(async (user: FirebaseUser, generation: number) => {
    try {
      const [existingProfile, isAdminGranted] = await Promise.all([
        getUserProfile(user.uid),
        hasAdminGrant(user.uid),
      ]);
      const profile =
        existingProfile ?? (signingUp.current ? null : await createMissingProfile(user));
      if (generation !== authGeneration.current) return;
      setUserProfile(profile);
      setAdminGrant(isAdminGranted);
      setProfileError(false);
    } catch (err) {
      if (generation !== authGeneration.current) return;
      logError("loadProfile", err);
      setUserProfile(null);
      setAdminGrant(false);
      setProfileError(true);
    }
  }, []);

  useEffect(() => {
    const watchdog = setTimeout(() => setInitStalled(true), AUTH_INIT_TIMEOUT_MS);

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      clearTimeout(watchdog);
      setInitStalled(false);
      const generation = ++authGeneration.current;
      setFirebaseUser(user);

      if (user) {
        // signUp() sets the profile itself once the document is written.
        if (!signingUp.current) {
          setLoading(true);
          await loadProfile(user, generation);
        }
      } else {
        setUserProfile(null);
        setAdminGrant(false);
        setProfileError(false);
      }

      // CRITICAL: only set loading=false AFTER profile fetch completes
      if (generation === authGeneration.current && !signingUp.current) setLoading(false);
    });

    return () => {
      clearTimeout(watchdog);
      unsubscribe();
    };
  }, [loadProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    // Don't touch loading here — onAuthStateChanged handles it
    await authSignIn(email, password);
  }, []);

  const signUp = useCallback(
    async (email: string, password: string, name: string, role: UserRole) => {
      signingUp.current = true;
      try {
        const profile = await authSignUp(email, password, name, role);
        setUserProfile(profile);
        setAdminGrant(false);
        setProfileError(false);
      } finally {
        signingUp.current = false;
        setLoading(false);
      }
    },
    []
  );

  const signOut = useCallback(async () => {
    await authSignOut();
    setUserProfile(null);
    setAdminGrant(false);
  }, []);

  /** Retry loading the profile after a failure (e.g. the network dropped). */
  const reloadProfile = useCallback(async () => {
    if (!firebaseUser) return;
    setLoading(true);
    await loadProfile(firebaseUser, authGeneration.current);
    setLoading(false);
  }, [firebaseUser, loadProfile]);

  const availableRoles = useMemo(
    () => getAvailableRoles(userProfile, adminGrant),
    [userProfile, adminGrant]
  );
  const activeRole = useMemo(
    () => resolveActiveRole(userProfile, adminGrant),
    [userProfile, adminGrant]
  );

  /** Switch between the roles this account has been granted. Throws on failure. */
  const switchRole = useCallback(
    async (role: UserRole) => {
      if (!firebaseUser) throw new ValidationError("Your session has expired. Please sign in again.");
      if (!availableRoles.includes(role)) {
        throw new ValidationError("Your account doesn't have access to that role.");
      }
      await setActiveRole(firebaseUser.uid, role);
      setUserProfile((prev) => (prev ? { ...prev, activeRole: role } : null));
    },
    [firebaseUser, availableRoles]
  );

  return {
    user: firebaseUser,
    userProfile,
    loading,
    profileError,
    initStalled,
    reloadProfile,
    signIn,
    signUp,
    signOut,
    switchRole,
    activeRole,
    availableRoles,
    isAdmin: !!userProfile && activeRole === "admin",
    isWorker: !!userProfile && activeRole === "worker",
    isAuthenticated: !!firebaseUser,
  };
}
