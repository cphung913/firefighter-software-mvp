import { apiFetch } from "@/lib/api/client";

export interface VoiceSessionOut {
  id: string;
  session_code: string;
  started_at: string;
  ended_at: string | null;
  sync_status: string;
}

export interface VoiceLogOut {
  id: string;
  session_id: string;
  recorded_by: string | null;
  entry_type: string | null;
  audio_ref: string | null;
  raw_transcript: string | null;
  review_status: string;
  sync_status: string;
  created_at: string;
}

export async function createSession(): Promise<VoiceSessionOut> {
  return apiFetch<VoiceSessionOut>("/api/v1/voice-sessions", { method: "POST" });
}

export async function joinSession(code: string): Promise<VoiceSessionOut> {
  return apiFetch<VoiceSessionOut>(`/api/v1/voice-sessions/join/${code.toUpperCase()}`);
}

export async function getSession(id: string): Promise<VoiceSessionOut> {
  return apiFetch<VoiceSessionOut>(`/api/v1/voice-sessions/${id}`);
}

export async function endSession(id: string): Promise<VoiceSessionOut> {
  return apiFetch<VoiceSessionOut>(`/api/v1/voice-sessions/${id}/end`, { method: "POST" });
}

export async function listLogs(sessionId: string): Promise<VoiceLogOut[]> {
  return apiFetch<VoiceLogOut[]>(`/api/v1/voice-sessions/${sessionId}/logs`);
}

export async function uploadClip(
  sessionId: string,
  blob: Blob,
  opts: { recordedById?: string; rawTranscript?: string; entryType?: string }
): Promise<VoiceLogOut> {
  const form = new FormData();
  form.append("audio", blob, "clip.webm");
  if (opts.recordedById) form.append("recorded_by_id", opts.recordedById);
  if (opts.rawTranscript) form.append("raw_transcript", opts.rawTranscript);
  if (opts.entryType) form.append("entry_type", opts.entryType);
  return apiFetch<VoiceLogOut>(`/api/v1/voice-sessions/${sessionId}/logs`, {
    method: "POST",
    body: form,
  });
}
