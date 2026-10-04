// ============================================
// Role helpers
// ============================================
// These drive what the UI shows. They are NOT a security boundary:
// firestore.rules independently enforces every permission.
//
// Trust model (mirrors firestore.rules):
//   admin  — a document exists at admins/{uid}. That collection is not
//            writable by any client; it is managed from the Firebase console.
//   worker — users/{uid}.role == "worker". Chosen at registration and
//            afterwards changeable only by an admin.
//   user   — everyone who is signed in.

import { User, UserRole } from "@/types";

/** Roles this account may switch between. */
export function getAvailableRoles(profile: User | null, hasAdminGrant: boolean): UserRole[] {
  if (!profile) return [];
  const roles: UserRole[] = ["user"];
  if (profile.role === "worker" || hasAdminGrant) roles.push("worker");
  if (hasAdminGrant) roles.push("admin");
  return roles;
}

/**
 * The role the UI should currently present. A stored activeRole the account
 * isn't entitled to (e.g. left over from an older version) is ignored.
 */
export function resolveActiveRole(profile: User | null, hasAdminGrant: boolean): UserRole {
  const available = getAvailableRoles(profile, hasAdminGrant);
  if (!profile || available.length === 0) return "user";
  if (profile.activeRole && available.includes(profile.activeRole)) return profile.activeRole;
  if (available.includes(profile.role)) return profile.role;
  return "user";
}

export function dashboardPathForRole(role: UserRole | string | null | undefined): string {
  if (role === "admin") return "/admin";
  if (role === "worker") return "/worker";
  return "/dashboard";
}
