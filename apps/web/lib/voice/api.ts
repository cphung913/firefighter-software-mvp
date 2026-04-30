import { apiFetch } from "@/lib/api/client";

export interface VoiceSessionOut {
  id: string;
  session_code: string;
  started_at: string;
  ended_at: string | null;
  sync_status: string;
  extraction_status: string;
  extracted_fields: Record<string, unknown> | null;
}

export interface VoiceLogOut {
  id: string;
  session_id: string;
  recorded_by: string | null;
  entry_type: string | null;
  audio_ref: string | null;
  raw_transcript: string | null;
  ai_extracted: Record<string, unknown> | null;
  review_status: string;
  sync_status: string;
  created_at: string;
}

/** Per-field extraction result with confidence score. */
export interface ExtractionField {
  value: unknown | null;
  confidence: number;
}

/** All NERIS fields as returned by the backend — each wrapped with a confidence score. */
export interface ExtractionResult {
  incident_type: ExtractionField;
  location_address: ExtractionField;
  alarm_time: ExtractionField;
  dispatch_time: ExtractionField;
  en_route_time: ExtractionField;
  on_scene_time: ExtractionField;
  controlled_time: ExtractionField;
  cleared_time: ExtractionField;
  units_responding: ExtractionField;
  personnel_on_scene: ExtractionField;
  casualty_civilian: ExtractionField;
  casualty_ff: ExtractionField;
  actions_taken: ExtractionField;
  property_use: ExtractionField;
  narrative: ExtractionField;
}

export interface ExtractionOut {
  voice_log_id: string;
  session_id: string;
  review_status: string;
  fields: ExtractionResult;
}

/** Flat editable NERIS fields for the review form — values unwrapped from ExtractionField. */
export interface ExtractedNERISFields {
  incident_type: string | null;
  location_address: string | null;
  alarm_time: string | null;
  dispatch_time: string | null;
  en_route_time: string | null;
  on_scene_time: string | null;
  controlled_time: string | null;
  cleared_time: string | null;
  units_responding: string[] | null;
  personnel_on_scene: string[] | null;
  casualty_civilian: number | null;
  casualty_ff: number | null;
  actions_taken: string[] | null;
  property_use: string | null;
  narrative: string | null;
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

export async function extractSession(sessionId: string): Promise<ExtractionOut> {
  return apiFetch<ExtractionOut>(`/api/v1/voice-sessions/${sessionId}/extract`, {
    method: "POST",
  });
}

export async function approveSession(sessionId: string): Promise<ExtractionOut> {
  return apiFetch<ExtractionOut>(`/api/v1/voice-sessions/${sessionId}/approve`, {
    method: "POST",
  });
}
