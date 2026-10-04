// ============================================
// AuthProvider — Global Authentication Context
// ============================================
// Wraps the app to provide auth state to all components.

"use client";

import React, { createContext, useContext, ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { User, UserRole } from "@/types";
import { User as FirebaseUser } from "firebase/auth";
import StatusScreen from "./shell/StatusScreen";
import Button from "./ui/Button";

interface AuthContextType {
  user: FirebaseUser | null;
  userProfile: User | null;
  loading: boolean;
  /** True when the signed-in user's profile couldn't be loaded. */
  profileError: boolean;
  /** True when Firebase Auth never finished starting (blocked browser storage). */
  initStalled: boolean;
  reloadProfile: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string, role: UserRole) => Promise<void>;
  signOut: () => Promise<void>;
  /** The role the UI is currently presenting (always one of availableRoles). */
  activeRole: UserRole;
  /** Roles this account has actually been granted. */
  availableRoles: UserRole[];
  isAdmin: boolean;
  isWorker: boolean;
  isAuthenticated: boolean;
  switchRole: (role: UserRole) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const authState = useAuth();

  return (
    <AuthContext.Provider value={authState}>
      {authState.initStalled ? (
        <StatusScreen
          tone="danger"
          title="We couldn't start your session"
          description="Your browser didn't let the app read its saved sign-in. Close any other UniFix tabs, make sure site storage isn't blocked, then reload."
          actions={<Button onClick={() => window.location.reload()}>Reload</Button>}
        />
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
}

/**
 * Hook to access auth context. Must be used within AuthProvider.
 */
export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuthContext must be used within an AuthProvider");
  }
  return context;
}
