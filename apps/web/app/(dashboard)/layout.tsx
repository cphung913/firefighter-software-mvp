import { Sidebar } from "@/components/nav/sidebar";
import { MobileTabBar } from "@/components/nav/mobile-tab-bar";
import { SyncIndicator } from "@/components/sync/sync-indicator";
import { ServiceWorkerRegister } from "@/components/sync/service-worker-register";
import { SyncEngineMount } from "@/components/sync/sync-engine-mount";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-muted/20">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-background px-4 md:px-6">
          <div className="text-sm font-medium md:hidden text-primary">
            VFD Platform
          </div>
          <div className="hidden md:block" />
          <SyncIndicator />
        </header>
        <main className="flex-1 px-4 pb-24 pt-6 md:px-8 md:pb-8">{children}</main>
      </div>
      <MobileTabBar />
      <ServiceWorkerRegister />
      <SyncEngineMount />
    </div>
  );
}
