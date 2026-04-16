import TopNav from "@/components/TopNav";
import WorkerGuard from "@/components/WorkerGuard";

export default function WorkerLayout({ children }: { children: React.ReactNode }) {
  return (
    <WorkerGuard>
      <div className="min-h-screen page-bg">
        <TopNav />
        <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
          {children}
        </main>
      </div>
    </WorkerGuard>
  );
}
