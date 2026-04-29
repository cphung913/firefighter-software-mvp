"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, FileOutput, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button, buttonVariants } from "@/components/ui/button";
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
import { deleteIncident, fetchNerisJson } from "@/lib/incidents/api";
import { printIncidentPdf } from "@/lib/incidents/export";
import {
  NERIS_INCIDENT_TYPES,
  PROPERTY_USE_OPTIONS,
} from "@/lib/incidents/options";

interface Props {
  serverId: string;
}

function lookupLabel(options: ReadonlyArray<{ value: string; label: string }>, value?: string | null) {
  if (!value) return "Unspecified";
  return options.find((o) => o.value === value)?.label ?? value;
}

export function IncidentDetailWorkspace({ serverId }: Props) {
  const router = useRouter();
  const [incident, setIncident] = useState<IncidentRecord | null | undefined>(undefined);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExportingNeris, setIsExportingNeris] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    db.incidents.where("server_id").equals(serverId).first().then((row) => {
      if (!cancelled) setIncident(row ?? null);
    });
    return () => { cancelled = true; };
  }, [serverId]);

  function handlePdfExport() {
    if (!incident) return;
    const raw = (incident.raw_data ?? {}) as Record<string, unknown>;
    printIncidentPdf(
      incident,
      lookupLabel(NERIS_INCIDENT_TYPES, incident.incident_type),
      lookupLabel(PROPERTY_USE_OPTIONS, typeof raw.property_use === "string" ? raw.property_use : null)
    );
  }

  async function handleNerisExport() {
    setIsExportingNeris(true);
    setError(null);
    try {
      const json = await fetchNerisJson(serverId);
      const blob = new Blob([JSON.stringify(json, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `neris-${incident?.incident_number ?? serverId}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to export NERIS JSON.");
    } finally {
      setIsExportingNeris(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this incident? This cannot be undone.")) return;
    setIsDeleting(true);
    setError(null);
    try {
      await deleteIncident(serverId);
      await db.incidents.where("server_id").equals(serverId).delete();
      router.push("/incidents");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete incident.");
      setIsDeleting(false);
    }
  }

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
          <p className="font-medium text-foreground">Incident not found on this device.</p>
          <p className="mt-1">It may still be syncing. Pull to refresh or check your connection.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link href="/incidents" className={buttonVariants({ variant: "ghost", size: "sm" })}>
        <ArrowLeft className="h-4 w-4" />All incidents
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">
            {incident.incident_number ?? "Incident"}
          </h1>
          <p className="text-muted-foreground">
            {lookupLabel(NERIS_INCIDENT_TYPES, incident.incident_type)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={handlePdfExport}>
            <FileOutput className="h-4 w-4" />
            Export PDF
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={handleNerisExport} disabled={isExportingNeris}>
            {isExportingNeris ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            NERIS JSON
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Delete
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Edit incident</CardTitle>
          <CardDescription>
            Changes enqueue for sync. Offline edits are safe — they sync on reconnect.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <IncidentForm
            existingLocalId={incident.local_id}
            initialData={incidentRecordToForm(incident)}
            submitLabel="Save changes"
            onSubmitSuccess={() => router.push("/incidents")}
          />
        </CardContent>
      </Card>
    </div>
  );
}
