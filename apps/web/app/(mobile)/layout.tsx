import { SyncIndicator } from "@/components/sync/sync-indicator";
import { ServiceWorkerRegister } from "@/components/sync/service-worker-register";
import { SyncEngineMount } from "@/components/sync/sync-engine-mount";

export default function MobileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b bg-background px-4">
        <div className="text-sm font-medium text-primary">VFD Platform</div>
        <SyncIndicator />
      </header>
      <main className="flex-1 px-4 pb-8 pt-6">{children}</main>
      <ServiceWorkerRegister />
      <SyncEngineMount />
    </div>
  );
}
