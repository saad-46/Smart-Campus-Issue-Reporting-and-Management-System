"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ClipboardList, HardHat, LayoutDashboard, Loader2 } from "lucide-react";
import { useAuthContext } from "@/components/AuthProvider";
import AuthLayout from "@/components/shell/AuthLayout";
import { ShellSkeleton } from "@/components/shell/StatusScreen";
import { Notice } from "@/components/ui/States";
import { getFriendlyErrorMessage, logError } from "@/lib/errors";
import { dashboardPathForRole } from "@/lib/roles";
import { cn } from "@/lib/cn";
import { UserRole } from "@/types";

const ROLES: { role: UserRole; label: string; icon: React.ReactNode; desc: string }[] = [
  { role: "user", label: "Student", icon: <ClipboardList className="h-[18px] w-[18px]" aria-hidden="true" />, desc: "Report and follow campus issues" },
  { role: "worker", label: "Worker", icon: <HardHat className="h-[18px] w-[18px]" aria-hidden="true" />, desc: "Claim and resolve maintenance tasks" },
  { role: "admin", label: "Admin", icon: <LayoutDashboard className="h-[18px] w-[18px]" aria-hidden="true" />, desc: "Run campus operations" },
];

export default function SwitchRolePage() {
  const { userProfile, loading, switchRole, activeRole, availableRoles } = useAuthContext();
  const router = useRouter();
  const [switching, setSwitching] = useState<UserRole | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && !userProfile) router.replace("/login");
  }, [loading, userProfile, router]);

  if (loading) return <ShellSkeleton />;
  if (!userProfile) return null;

  // Only the roles this account has actually been granted are offered.
  const roles = ROLES.filter((r) => availableRoles.includes(r.role));

  const handleSwitch = async (role: UserRole) => {
    if (switching) return;
    setError("");
    setSwitching(role);
    try {
      if (role !== activeRole) await switchRole(role);
      router.push(dashboardPathForRole(role));
    } catch (err) {
      logError("switchRole", err);
      setError(getFriendlyErrorMessage(err, "Couldn't switch view. Please try again."));
      setSwitching(null);
    }
  };

  return (
    <AuthLayout title="Choose a view" description={`Signed in as ${userProfile.email}`}>
      <ul className="space-y-2">
        {roles.map((r) => {
          const current = activeRole === r.role;
          return (
            <li key={r.role}>
              <button
                type="button"
                onClick={() => handleSwitch(r.role)}
                disabled={!!switching}
                aria-current={current ? "true" : undefined}
                className={cn(
                  "flex w-full items-center gap-3 rounded-md border px-3.5 py-3 text-left transition-[border-color,background-color] duration-150 disabled:opacity-60",
                  current ? "border-brand bg-brand-subtle" : "border-border hover:border-border-strong hover:bg-surface-hover"
                )}
              >
                <span className={cn("flex h-9 w-9 items-center justify-center rounded-md border", current ? "border-brand-subtle-border text-brand-fg" : "border-border text-fg-subtle")}>
                  {r.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-fg">{r.label}</span>
                  <span className="block text-[13px] text-fg-subtle">{r.desc}</span>
                </span>
                {switching === r.role ? (
                  <Loader2 className="h-4 w-4 animate-spin text-fg-subtle" aria-label="Switching" />
                ) : current ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-brand-fg">
                    <Check className="h-3.5 w-3.5" aria-hidden="true" /> Current
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
      {error && <Notice tone="danger" className="mt-4">{error}</Notice>}
    </AuthLayout>
  );
}
