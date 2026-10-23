import AppShell from "@/components/shell/AppShell";
import ProtectedRoute from "@/components/ProtectedRoute";

export default function TimelineLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <AppShell>{children}</AppShell>
    </ProtectedRoute>
  );
}
