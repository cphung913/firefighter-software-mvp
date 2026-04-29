"use client";

import { useRef, useState, useCallback } from "react";
import { useVad } from "./use-vad";

export type RecorderState = "idle" | "recording" | "stopped";

export interface ClipResult {
  blob: Blob;
  durationMs: number;
  waveformSamples: number[]; // 40 normalised samples 0-1 for waveform display
}

export interface UseRecorderReturn {
  state: RecorderState;
  waveform: number[]; // live samples while recording
  clip: ClipResult | null;
  start: () => Promise<void>;
  stop: () => void;
  discard: () => void;
  error: string | null;
}

const MIME = "audio/webm;codecs=opus";
const WAVEFORM_SLOTS = 40;

export function useRecorder(): UseRecorderReturn {
  const [state, setState] = useState<RecorderState>("idle");
  const [waveform, setWaveform] = useState<number[]>([]);
  const [clip, setClip] = useState<ClipResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const rafRef = useRef<number>(0);
  const liveWaveformRef = useRef<number[]>([]);

  const { buildPipeline, getRms } = useVad();

  const cleanup = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    streamRef.current = null;
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    liveWaveformRef.current = [];
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setClip(null);
    setWaveform([]);
    liveWaveformRef.current = [];

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch (e) {
      setError("Microphone permission denied.");
      return;
    }
    streamRef.current = stream;

    const ctx = new AudioContext();
    audioCtxRef.current = ctx;
    const source = ctx.createMediaStreamSource(stream);
    buildPipeline(ctx, source);

    const mimeType = MediaRecorder.isTypeSupported(MIME) ? MIME : "audio/webm";
    const recorder = new MediaRecorder(stream, { mimeType });
    mediaRecorderRef.current = recorder;
    chunksRef.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const durationMs = Date.now() - startTimeRef.current;
      const blob = new Blob(chunksRef.current, { type: mimeType });

      // downsample live waveform to WAVEFORM_SLOTS points
      const raw = [...liveWaveformRef.current];
      const slots: number[] = [];
      if (raw.length <= WAVEFORM_SLOTS) {
        slots.push(...raw);
        while (slots.length < WAVEFORM_SLOTS) slots.push(0);
      } else {
        const step = raw.length / WAVEFORM_SLOTS;
        for (let i = 0; i < WAVEFORM_SLOTS; i++) {
          const start = Math.floor(i * step);
          const end = Math.floor((i + 1) * step);
          const slice = raw.slice(start, end);
          slots.push(slice.reduce((a, b) => a + b, 0) / (slice.length || 1));
        }
      }

      setClip({ blob, durationMs, waveformSamples: slots });
      setState("stopped");
      cleanup();
    };

    startTimeRef.current = Date.now();
    recorder.start(100);
    setState("recording");

    const tick = () => {
      const rms = getRms();
      liveWaveformRef.current.push(rms);
      setWaveform((prev) => {
        const next = [...prev, rms];
        return next.length > WAVEFORM_SLOTS ? next.slice(-WAVEFORM_SLOTS) : next;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [buildPipeline, getRms, cleanup]);

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    mediaRecorderRef.current?.stop();
  }, []);

  const discard = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    if (mediaRecorderRef.current?.state !== "inactive") {
      mediaRecorderRef.current?.stop();
    }
    cleanup();
    setClip(null);
    setWaveform([]);
    setState("idle");
  }, [cleanup]);

  return { state, waveform, clip, start, stop, discard, error };
}
