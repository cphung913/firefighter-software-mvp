"use client";

import { useState } from "react";
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

const FALLBACK_DRAFT_ID = "active-incident-draft";

interface NewIncidentWorkspaceProps {
  draftId?: string;
}

export function NewIncidentWorkspace({ draftId: dispatchDraftId }: NewIncidentWorkspaceProps) {
  const router = useRouter();
  const resolvedDraftId = dispatchDraftId ?? FALLBACK_DRAFT_ID;
  const [showDispatchBanner, setShowDispatchBanner] = useState(Boolean(dispatchDraftId));

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

      {showDispatchBanner && dispatchDraftId ? (
        <div className="border border-[#d6cfbf] bg-[#ede8de]/90 px-4 py-2.5 font-body text-[13px] text-[#4a4842]">
          Loading draft from cleared dispatch...
        </div>
      ) : null}

      <Card className="bg-[var(--bone)] border-[#d6cfbf] text-[var(--ink)] [&_input]:border-b-[#1a1d22] [&_input]:text-[var(--ink)] [&_input]:placeholder:text-[#a09a8e]">
        <CardHeader>
          <CardTitle className="text-[var(--ink)]">New incident report</CardTitle>
          <CardDescription className="text-[#4a4842]">NERIS-aligned. Saves offline, syncs when signal returns.</CardDescription>
        </CardHeader>
        <CardContent>
          <IncidentForm
            draftId={resolvedDraftId}
            onBootstrapComplete={dispatchDraftId ? () => setShowDispatchBanner(false) : undefined}
            submitLabel="Log incident"
            onSubmitSuccess={() => router.push("/incidents")}
          />
        </CardContent>
      </Card>
    </div>
  );
}
