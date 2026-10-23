import AppShell from "@/components/shell/AppShell";
import ProtectedRoute from "@/components/ProtectedRoute";

export default function NotificationsLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <AppShell>{children}</AppShell>
    </ProtectedRoute>
  );
}
