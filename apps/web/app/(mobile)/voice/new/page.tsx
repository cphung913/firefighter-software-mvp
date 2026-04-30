"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Radio } from "lucide-react";
import { createSession } from "@/lib/voice/api";
import { db } from "@/lib/db";
import type { VoiceSessionOut } from "@/lib/voice/api";

export default function VoiceNewPage() {
  const router = useRouter();
  const [session, setSession] = useState<VoiceSessionOut | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    createSession()
      .then(async (s) => {
        await db.voice_sessions.put({
          id: s.id,
          session_code: s.session_code,
          started_at: s.started_at,
          ended_at: s.ended_at,
          sync_status: s.sync_status,
          cached_at: new Date().toISOString(),
        });
        setSession(s);
      })
      .catch(() => setError("Could not create session. Check your connection."));
  }, []);

  const handleStart = () => {
    if (!session) return;
    router.push(`/voice/session/${session.id}`);
  };

  if (error) {
    return (
      <div className="flex min-h-[80vh] flex-col items-center justify-center gap-4 text-center px-4">
        <p className="text-destructive font-medium">{error}</p>
        <button onClick={() => router.back()} className="text-sm text-primary underline min-h-[44px]">
          Go back
        </button>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-[80vh] flex-col items-center justify-center gap-4">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <p className="text-sm text-muted-foreground">Starting session…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 px-4">
      <div className="flex items-center">
        <button
          onClick={() => router.push("/dashboard")}
          className="flex items-center gap-1 text-sm text-muted-foreground min-h-[44px] -ml-1"
        >
          <ChevronLeft size={18} /> Back
        </button>
      </div>
      <div className="flex flex-col items-center gap-8 text-center">
      <div className="flex flex-col items-center gap-3">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <Radio size={32} className="text-primary" />
        </div>
        <h1 className="text-2xl font-bold">Ride-back log</h1>
        <p className="text-muted-foreground text-sm max-w-xs">
          Share this code so other devices can join the same session.
        </p>
      </div>

      {/* Session code — big, readable at arm's length */}
      <div className="flex flex-col items-center gap-2 rounded-2xl border-2 border-primary/30 bg-primary/5 px-10 py-6 w-full max-w-xs">
        <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Session code
        </span>
        <span className="text-5xl font-mono font-black tracking-[0.2em] text-primary select-all">
          {session.session_code}
        </span>
      </div>

      <button
        onClick={handleStart}
        className="h-[56px] w-full max-w-xs rounded-xl bg-primary text-primary-foreground font-semibold text-base transition active:scale-95"
      >
        Start recording
      </button>

      <button
        onClick={() => router.push("/voice/join")}
        className="text-sm text-muted-foreground min-h-[44px]"
      >
        Join an existing session instead
      </button>
      </div>
    </div>
  );
}
