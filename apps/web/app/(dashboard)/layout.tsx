import { Sidebar } from "@/components/nav/sidebar";
import { MobileTabBar } from "@/components/nav/mobile-tab-bar";
import { SyncIndicator } from "@/components/sync/sync-indicator";
import { ServiceWorkerRegister } from "@/components/sync/service-worker-register";
import { SyncEngineMount } from "@/components/sync/sync-engine-mount";
import { ConflictBanner } from "@/components/sync/conflict-banner";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-[var(--ink)]">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-[var(--rule)] bg-[var(--steel)] px-4 md:px-6">
          <div className="font-display text-[13px] uppercase tracking-[0.14em] font-semibold text-[var(--bone)] md:hidden">
            Halligan
          </div>
          <div className="hidden md:block" />
          <SyncIndicator />
        </header>
        <main className="flex-1 px-4 pb-24 pt-6 md:px-8 md:pb-8">
          <ConflictBanner />
          {children}
        </main>
      </div>
      <MobileTabBar />
      <ServiceWorkerRegister />
      <SyncEngineMount />
    </div>
  );
}
