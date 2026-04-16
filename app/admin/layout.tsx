// ============================================
// Admin Layout — Wraps admin pages with Navbar
// ============================================

import Navbar from "@/components/Navbar";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-950">
      <Navbar />
      <main>{children}</main>
    </div>
  );
}
