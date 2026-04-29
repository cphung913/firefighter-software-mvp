"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { IncidentForm } from "@/components/incidents/incident-form";

const MOBILE_DRAFT_ID = "mobile-active-incident-draft";

export function MobileNewIncident() {
  const router = useRouter();

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Link href="/voice" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-bold">Log incident</h1>
      </div>

      <p className="text-sm text-muted-foreground">
        NERIS-ready. Autosaves every 30 s. Works offline — syncs on reconnect.
      </p>

      <IncidentForm
        draftId={MOBILE_DRAFT_ID}
        submitLabel="Log incident"
        onSubmitSuccess={(localId) => router.push(`/incidents/${localId}`)}
      />
    </div>
  );
}
