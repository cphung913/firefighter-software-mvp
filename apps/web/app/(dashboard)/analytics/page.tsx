import { ResponseTimeDashboard } from "@/components/analytics/response-time-dashboard";

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-[clamp(28px,4vw,40px)] uppercase tracking-[-0.005em] font-medium text-[var(--bone)]">
          Analytics
        </h1>
        <p className="font-body text-[var(--bone-dim)]">
          Response time performance and NFPA 1720 compliance.
        </p>
      </div>
      <ResponseTimeDashboard />
    </div>
  );
}
