import AppShell from "@/components/shell/AppShell";
import WorkerGuard from "@/components/WorkerGuard";

export default function WorkerLayout({ children }: { children: React.ReactNode }) {
  return (
    <WorkerGuard>
      <AppShell>{children}</AppShell>
    </WorkerGuard>
  );
}
