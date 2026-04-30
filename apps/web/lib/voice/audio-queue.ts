"use client";

import { db } from "@/lib/db";
import { uploadClip } from "./api";

export async function enqueueClip(opts: {
  localClipId: string;
  sessionId: string;
  blob: Blob;
  recordedById?: string | null;
  rawTranscript?: string | null;
  entryType?: string | null;
}): Promise<void> {
  await db.pending_audio.add({
    local_clip_id: opts.localClipId,
    session_id: opts.sessionId,
    blob: opts.blob,
    recorded_by_id: opts.recordedById ?? null,
    raw_transcript: opts.rawTranscript ?? null,
    entry_type: opts.entryType ?? null,
    created_at: new Date().toISOString(),
    attempts: 0,
  });
}

export async function flushAudioQueue(): Promise<void> {
  const pending = await db.pending_audio.orderBy("created_at").toArray();
  for (const item of pending) {
    try {
      await uploadClip(item.session_id, item.blob, {
        recordedById: item.recorded_by_id ?? undefined,
        rawTranscript: item.raw_transcript ?? undefined,
        entryType: item.entry_type ?? undefined,
      });
      if (item.id !== undefined) await db.pending_audio.delete(item.id);
    } catch {
      // bump attempt count; leave in queue for next flush
      if (item.id !== undefined) {
        await db.pending_audio.update(item.id, { attempts: item.attempts + 1 });
      }
    }
  }
}

export async function pendingAudioCount(): Promise<number> {
  return db.pending_audio.count();
}
