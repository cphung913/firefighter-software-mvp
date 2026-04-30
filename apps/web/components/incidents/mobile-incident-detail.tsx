"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import { IncidentForm, incidentRecordToForm } from "@/components/incidents/incident-form";
import type { IncidentRecord } from "@/lib/db";
import { db } from "@/lib/db";
import { NERIS_INCIDENT_TYPES } from "@/lib/incidents/options";

interface Props {
  localId: string;
}

function lookupLabel(options: ReadonlyArray<{ value: string; label: string }>, value?: string | null) {
  if (!value) return "Unspecified";
  return options.find((o) => o.value === value)?.label ?? value;
}

export function MobileIncidentDetail({ localId }: Props) {
  const router = useRouter();
  const [incident, setIncident] = useState<IncidentRecord | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    db.incidents.get(localId).then(async (row) => {
      if (row) {
        if (!cancelled) setIncident(row);
        return;
      }
      const byServer = await db.incidents.where("server_id").equals(localId).first();
      if (!cancelled) setIncident(byServer ?? null);
    });
    return () => { cancelled = true; };
  }, [localId]);

  if (incident === undefined) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (incident === null) {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-2">
          <Link href="/voice" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-xl font-bold">Not found</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          This incident is not on this device. It may still be syncing.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Link href="/voice" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold">
            {incident.incident_number ?? "Draft"}
          </h1>
          <p className="truncate text-xs text-muted-foreground">
            {lookupLabel(NERIS_INCIDENT_TYPES, incident.incident_type)}
          </p>
        </div>
      </div>

      <IncidentForm
        existingLocalId={incident.local_id}
        initialData={incidentRecordToForm(incident)}
        submitLabel="Save changes"
        onSubmitSuccess={() => router.push("/voice")}
      />
    </div>
  );
}
