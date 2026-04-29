"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, Siren } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { IncidentForm } from "@/components/incidents/incident-form";

const DRAFT_ID = "active-incident-draft";

export function NewIncidentWorkspace() {
  const router = useRouter();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/incidents" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          <ArrowLeft className="h-4 w-4" />
          All incidents
        </Link>
      </div>

      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Log incident</h1>
        <p className="text-muted-foreground">
          Large controls for the rig, timed autosave every 30 seconds, and one-tap GPS capture.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Siren className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>New incident report</CardTitle>
              <CardDescription>NERIS-aligned. Saves offline, syncs when signal returns.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <IncidentForm
            draftId={DRAFT_ID}
            submitLabel="Log incident"
            onSubmitSuccess={() => router.push("/incidents")}
          />
        </CardContent>
      </Card>
    </div>
  );
}
