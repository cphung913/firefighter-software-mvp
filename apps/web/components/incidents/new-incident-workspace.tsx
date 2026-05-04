"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
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
        <h1 className="font-display text-[clamp(28px,4vw,40px)] uppercase tracking-[-0.005em] font-medium text-[var(--bone)]">Log incident</h1>
        <p className="font-body text-[var(--bone-dim)]">
          Large controls for the rig, timed autosave every 30 seconds, and one-tap GPS capture.
        </p>
      </div>

      <Card className="bg-[var(--bone)] border-[#d6cfbf]">
        <CardHeader>
          <CardTitle className="text-[var(--ink)]">New incident report</CardTitle>
          <CardDescription className="text-[#4a4842]">NERIS-aligned. Saves offline, syncs when signal returns.</CardDescription>
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
