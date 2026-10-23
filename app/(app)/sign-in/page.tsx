import Link from "next/link";
import { ArrowRight, GraduationCap, HardHat, ShieldCheck } from "lucide-react";
import AuthLayout from "@/components/shell/AuthLayout";

// Choosing a role here only decides which sign-in form to show. It grants
// nothing: the account's real roles come from its profile and the Firestore
// rules, and the sign-in page checks them (see app/(app)/login/page.tsx).
const CHOICES = [
  { role: "student", label: "Sign in as Student", desc: "Report campus issues and follow them until they're fixed.", icon: GraduationCap },
  { role: "worker", label: "Sign in as Worker", desc: "Take on maintenance tasks, resolve them and claim expenses.", icon: HardHat },
  { role: "admin", label: "Sign in as Admin", desc: "Assign work, review claims and watch campus operations.", icon: ShieldCheck },
] as const;

export default function SignInRolePage() {
  return (
    <AuthLayout
      title="Sign in to UniFix"
      description="Choose how you use UniFix."
      footer={
        <>
          New here?{" "}
          <Link href="/register" className="font-medium text-brand-fg hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <ul className="space-y-3" aria-label="Sign in as">
        {CHOICES.map(({ role, label, desc, icon: Icon }) => (
          <li key={role}>
            <Link
              href={`/login?role=${role}`}
              className="group flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3.5 transition-colors hover:border-border-strong hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-subtle text-brand-fg">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-fg">{label}</span>
                <span className="block text-[13px] text-fg-muted">{desc}</span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-fg-subtle transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </AuthLayout>
  );
}
