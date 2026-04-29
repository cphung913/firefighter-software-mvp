"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

export function LocalIncidentWorkspace({ localId }: Props) {
  const router = useRouter();
  const [incident, setIncident] = useState<IncidentRecord | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    db.incidents.get(localId).then((row) => {
      if (!cancelled) setIncident(row ?? null);
    });
    return () => { cancelled = true; };
  }, [localId]);

  if (incident === undefined) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (incident === null) {
    return (
      <div className="space-y-6">
        <Link href="/incidents" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          <ArrowLeft className="h-4 w-4" />All incidents
        </Link>
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Draft not found on this device.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link href="/incidents" className={buttonVariants({ variant: "ghost", size: "sm" })}>
        <ArrowLeft className="h-4 w-4" />All incidents
      </Link>

      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">
          {incident.incident_number ?? "Draft incident"}
        </h1>
        <p className="text-muted-foreground">
          {lookupLabel(NERIS_INCIDENT_TYPES, incident.incident_type)} · Queued for sync
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Edit draft</CardTitle>
          <CardDescription>
            This incident is queued locally. It will sync when you go online.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <IncidentForm
            existingLocalId={localId}
            initialData={incidentRecordToForm(incident)}
            submitLabel="Save changes"
            onSubmitSuccess={() => router.push("/incidents")}
          />
        </CardContent>
      </Card>
    </div>
  );
}
