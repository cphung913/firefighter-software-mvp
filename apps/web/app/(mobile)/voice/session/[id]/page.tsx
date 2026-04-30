"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Mic, Square, Play, Pause, RotateCcw, Check, ChevronLeft, Users, Wifi, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRecorder } from "@/lib/voice/use-recorder";
import { useWebSpeech } from "@/lib/voice/use-web-speech";
import { enqueueClip, flushAudioQueue, pendingAudioCount } from "@/lib/voice/audio-queue";
import { getSession as fetchSession, endSession, uploadClip } from "@/lib/voice/api";
import type { VoiceSessionOut } from "@/lib/voice/api";
import { db } from "@/lib/db";
import type { DepartmentRosterUser } from "@vfd/shared-types";
import { useSyncStore } from "@/store/sync-store";

// ─── Waveform bar visualiser ──────────────────────────────────────────────────

function Waveform({ samples, active }: { samples: number[]; active: boolean }) {
  const bars = 40;
  const padded = [...samples];
  while (padded.length < bars) padded.unshift(0);
  const display = padded.slice(-bars);

  return (
    <div className="flex h-16 items-end justify-center gap-[2px] px-2" aria-hidden>
      {display.map((v, i) => (
        <div
          key={i}
          className={cn(
            "w-1 rounded-full transition-all duration-75",
            active ? "bg-red-500" : "bg-muted-foreground/40"
          )}
          style={{ height: `${Math.max(4, Math.round(v * 60))}px` }}
        />
      ))}
    </div>
  );
}

// ─── Clip list entry ──────────────────────────────────────────────────────────

interface ClipEntry {
  id: string;
  blob: Blob;
  durationMs: number;
  waveformSamples: number[];
  transcript: string;
  recordedByName: string;
  uploadStatus: "pending" | "uploading" | "done" | "error";
}

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function ClipRow({ clip, online }: { clip: ClipEntry; online: boolean }) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);

  const togglePlay = () => {
    if (!urlRef.current) {
      urlRef.current = URL.createObjectURL(clip.blob);
    }
    if (!audioRef.current) {
      audioRef.current = new Audio(urlRef.current);
      audioRef.current.onended = () => setPlaying(false);
    }
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.currentTime = 0;
      audioRef.current.play();
      setPlaying(true);
    }
  };

  return (
    <div className="rounded-xl border bg-card p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium truncate max-w-[160px]">{clip.recordedByName}</span>
        <div className="flex items-center gap-2 text-muted-foreground">
          <span>{formatDuration(clip.durationMs)}</span>
          {clip.uploadStatus === "done" && (
            <Check size={14} className="text-green-500" />
          )}
          {clip.uploadStatus === "pending" && !online && (
            <WifiOff size={14} className="text-amber-500" />
          )}
          {clip.uploadStatus === "uploading" && (
            <div className="h-3 w-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          )}
          {clip.uploadStatus === "error" && (
            <span className="text-destructive text-xs">failed</span>
          )}
        </div>
      </div>
      <Waveform samples={clip.waveformSamples} active={false} />
      {clip.transcript && (
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3 px-1">
          {clip.transcript}
        </p>
      )}
      <button
        onClick={togglePlay}
        className="flex items-center justify-center gap-2 rounded-lg border py-2 text-sm font-medium min-h-[44px] transition-colors hover:bg-muted"
        aria-label={playing ? "Pause" : "Play recording"}
      >
        {playing ? <Pause size={16} /> : <Play size={16} />}
        {playing ? "Pause" : "Listen back"}
      </button>
    </div>
  );
}

// ─── Roster picker sheet ──────────────────────────────────────────────────────

function RosterPicker({
  users,
  selected,
  onSelect,
  onClose,
}: {
  users: DepartmentRosterUser[];
  selected: DepartmentRosterUser | null;
  onSelect: (u: DepartmentRosterUser) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-sm">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <span className="font-semibold">Who&apos;s speaking?</span>
        <button onClick={onClose} className="text-sm text-muted-foreground min-h-[44px] px-2">
          Cancel
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
        {users.map((u) => (
          <button
            key={u.id}
            onClick={() => { onSelect(u); onClose(); }}
            className={cn(
              "w-full text-left rounded-xl border px-4 py-3 min-h-[56px] flex items-center justify-between transition-colors",
              selected?.id === u.id ? "border-primary bg-primary/10" : "hover:bg-muted"
            )}
          >
            <span className="font-medium">{u.name}</span>
            <span className="text-sm text-muted-foreground">{u.badge_number ?? u.role}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function VoiceSessionPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { data: authSession } = useSession();
  const online = useSyncStore((s) => s.online);

  const [session, setSession] = useState<VoiceSessionOut | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [clips, setClips] = useState<ClipEntry[]>([]);
  const [rosterUsers, setRosterUsers] = useState<DepartmentRosterUser[]>([]);
  const [activeUser, setActiveUser] = useState<DepartmentRosterUser | null>(null);
  const [showRoster, setShowRoster] = useState(false);
  const [pendingUploads, setPendingUploads] = useState(0);
  const [ending, setEnding] = useState(false);

  const { state, waveform, clip, start, stop, discard, error: recError } = useRecorder();
  const { transcript, startListening, stopListening, reset: resetSpeech, supported: speechSupported } = useWebSpeech();

  // Load session + roster
  useEffect(() => {
    fetchSession(params.id)
      .then(setSession)
      .catch(() => setLoadError("Session not found."));

    db.department_users
      .toArray()
      .then((users) => setRosterUsers(users))
      .catch(() => {});
  }, [params.id]);

  // Refresh pending upload count
  const refreshPending = useCallback(async () => {
    const n = await pendingAudioCount();
    setPendingUploads(n);
  }, []);

  useEffect(() => {
    refreshPending();
  }, [refreshPending, clips]);

  // Auto-flush queue when online
  useEffect(() => {
    if (!online) return;
    flushAudioQueue().then(refreshPending);
  }, [online, refreshPending]);

  // Set default active user from session auth
  useEffect(() => {
    if (!authSession?.user || rosterUsers.length === 0 || activeUser) return;
    const match = rosterUsers.find(
      (u) => (u as DepartmentRosterUser & { email?: string }).email === authSession.user?.email
    );
    if (match) setActiveUser(match);
    else if (rosterUsers.length === 1) setActiveUser(rosterUsers[0]);
  }, [authSession, rosterUsers, activeUser]);

  const handleStartRecording = async () => {
    resetSpeech();
    if (speechSupported) startListening();
    await start();
  };

  const handleStopRecording = () => {
    stop();
    if (speechSupported) stopListening();
  };

  const handleKeep = async () => {
    if (!clip || !session) return;
    const id = crypto.randomUUID();
    const entry: ClipEntry = {
      id,
      blob: clip.blob,
      durationMs: clip.durationMs,
      waveformSamples: clip.waveformSamples,
      transcript,
      recordedByName: activeUser?.name ?? "Unknown",
      uploadStatus: "pending",
    };
    setClips((prev) => [entry, ...prev]);

    const updateStatus = (status: ClipEntry["uploadStatus"]) => {
      setClips((prev) =>
        prev.map((c) => (c.id === id ? { ...c, uploadStatus: status } : c))
      );
    };

    if (online) {
      updateStatus("uploading");
      try {
        await uploadClip(session.id, clip.blob, {
          recordedById: activeUser?.id,
          rawTranscript: transcript || undefined,
          entryType: "narrative",
        });
        updateStatus("done");
      } catch {
        // fall back to queue
        await enqueueClip({
          localClipId: id,
          sessionId: session.id,
          blob: clip.blob,
          recordedById: activeUser?.id,
          rawTranscript: transcript || undefined,
          entryType: "narrative",
        });
        updateStatus("pending");
        await refreshPending();
      }
    } else {
      await enqueueClip({
        localClipId: id,
        sessionId: session.id,
        blob: clip.blob,
        recordedById: activeUser?.id,
        rawTranscript: transcript || undefined,
        entryType: "narrative",
      });
      await refreshPending();
    }

    discard();
    resetSpeech();
  };

  const handleDiscard = () => {
    discard();
    resetSpeech();
    stopListening();
  };

  const handleEndSession = async () => {
    if (!session) return;
    setEnding(true);
    try {
      await endSession(session.id);
    } catch {
      // best-effort
    }
    router.push(`/voice/session/${session.id}/review`);
  };

  if (loadError) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <p className="text-destructive font-medium">{loadError}</p>
        <button onClick={() => router.back()} className="text-sm text-primary underline min-h-[44px]">
          Go back
        </button>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 pb-8">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1 text-sm text-muted-foreground min-h-[44px] -ml-1"
        >
          <ChevronLeft size={18} /> Back
        </button>
        <div className="text-center">
          <div className="text-2xl font-mono font-bold tracking-widest text-primary">
            {session.session_code}
          </div>
          <div className="text-xs text-muted-foreground">Session code</div>
        </div>
        <button
          onClick={handleEndSession}
          disabled={ending}
          className="text-sm text-destructive font-medium min-h-[44px] px-1 disabled:opacity-50"
        >
          End
        </button>
      </div>

      {/* Offline banner */}
      {!online && (
        <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
          <WifiOff size={16} className="shrink-0" />
          <span>No connection — recordings saved locally. Will upload on reconnect.</span>
        </div>
      )}

      {/* Online + pending banner */}
      {online && pendingUploads > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-sm text-blue-800">
          <Wifi size={16} className="shrink-0" />
          <span>Uploading {pendingUploads} saved recording{pendingUploads !== 1 ? "s" : ""}…</span>
        </div>
      )}

      {/* Crew attribution */}
      <button
        onClick={() => setShowRoster(true)}
        className="flex items-center justify-between rounded-xl border bg-card px-4 min-h-[56px] transition-colors hover:bg-muted"
      >
        <div className="flex items-center gap-2">
          <Users size={18} className="text-muted-foreground" />
          <span className="text-sm font-medium">
            {activeUser ? activeUser.name : "Tap to select speaker"}
          </span>
        </div>
        <span className="text-xs text-muted-foreground">
          {activeUser ? activeUser.badge_number ?? activeUser.role : ""}
        </span>
      </button>

      {/* Waveform */}
      <Waveform samples={state === "recording" ? waveform : clip?.waveformSamples ?? []} active={state === "recording"} />

      {/* Live transcript */}
      {state === "recording" && transcript && (
        <p className="text-sm text-muted-foreground italic text-center px-2 leading-relaxed min-h-[40px]">
          &ldquo;{transcript}&rdquo;
        </p>
      )}

      {/* Record / Stop / Re-record / Keep */}
      <div className="flex flex-col items-center gap-4">
        {state === "idle" && (
          <button
            onClick={handleStartRecording}
            className="flex h-[56px] w-[56px] items-center justify-center rounded-full bg-red-500 text-white shadow-lg shadow-red-500/40 transition active:scale-95"
            aria-label="Start recording"
          >
            <Mic size={26} />
          </button>
        )}

        {state === "recording" && (
          <button
            onClick={handleStopRecording}
            className="flex h-[56px] w-[56px] items-center justify-center rounded-full bg-red-600 text-white shadow-lg shadow-red-600/40 transition active:scale-95 ring-4 ring-red-300 animate-pulse"
            aria-label="Stop recording"
          >
            <Square size={22} fill="white" />
          </button>
        )}

        {state === "stopped" && (
          <div className="flex items-center gap-4">
            <button
              onClick={handleDiscard}
              className="flex h-[56px] w-[56px] items-center justify-center rounded-full border-2 border-muted-foreground/30 text-muted-foreground transition active:scale-95 hover:bg-muted"
              aria-label="Discard and re-record"
            >
              <RotateCcw size={22} />
            </button>
            <button
              onClick={handleKeep}
              className="flex h-[56px] w-[56px] items-center justify-center rounded-full bg-green-500 text-white shadow-lg shadow-green-500/40 transition active:scale-95"
              aria-label="Keep recording"
            >
              <Check size={26} />
            </button>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          {state === "idle" && "Tap to record"}
          {state === "recording" && "Recording — tap to stop"}
          {state === "stopped" && "Discard ← or → Keep"}
        </p>
      </div>

      {/* Recorder error */}
      {recError && (
        <p className="text-sm text-destructive text-center">{recError}</p>
      )}

      {/* Clip list */}
      {clips.length > 0 && (
        <div className="flex flex-col gap-3 mt-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            This session
          </h2>
          {clips.map((c) => (
            <ClipRow key={c.id} clip={c} online={online} />
          ))}
        </div>
      )}

      {/* Roster sheet */}
      {showRoster && (
        <RosterPicker
          users={rosterUsers}
          selected={activeUser}
          onSelect={setActiveUser}
          onClose={() => setShowRoster(false)}
        />
      )}
    </div>
  );
}
