import AppShell from "@/components/shell/AppShell";
import AdminGuard from "@/components/AdminGuard";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminGuard>
      <AppShell>{children}</AppShell>
    </AdminGuard>
  );
}
