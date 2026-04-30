"use client";

import { useRef, useCallback } from "react";

/**
 * Applies two notch/bandstop filters to suppress firefighter-environment noise:
 *   - 100–200 Hz diesel rumble
 *   - 700–1200 Hz siren harmonics
 *
 * Returns an AudioNode that can be connected to an AnalyserNode for waveform
 * or to a MediaStreamDestination for a filtered stream.
 */
export function buildVadFilter(ctx: AudioContext, source: MediaStreamAudioSourceNode): BiquadFilterNode {
  // Diesel notch: centre ~150 Hz, wide Q
  const dieselNotch = ctx.createBiquadFilter();
  dieselNotch.type = "notch";
  dieselNotch.frequency.value = 150;
  dieselNotch.Q.value = 0.5;

  // Siren notch: centre ~950 Hz, wide Q
  const sirenNotch = ctx.createBiquadFilter();
  sirenNotch.type = "notch";
  sirenNotch.frequency.value = 950;
  sirenNotch.Q.value = 0.5;

  // High-pass at 80 Hz to kill sub-rumble
  const highPass = ctx.createBiquadFilter();
  highPass.type = "highpass";
  highPass.frequency.value = 80;
  highPass.Q.value = 0.7;

  source.connect(highPass);
  highPass.connect(dieselNotch);
  dieselNotch.connect(sirenNotch);

  return sirenNotch;
}

export interface UseVadReturn {
  /** Call with an AudioContext + source to get a filtered node + analyser */
  buildPipeline: (
    ctx: AudioContext,
    source: MediaStreamAudioSourceNode
  ) => { filtered: BiquadFilterNode; analyser: AnalyserNode };
  /** Returns current RMS level 0–1 from the analyser */
  getRms: () => number;
}

export function useVad(): UseVadReturn {
  const analyserRef = useRef<AnalyserNode | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bufferRef = useRef<any>(null);

  const buildPipeline = useCallback(
    (ctx: AudioContext, source: MediaStreamAudioSourceNode) => {
      const filtered = buildVadFilter(ctx, source);

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.3;
      filtered.connect(analyser);

      analyserRef.current = analyser;
      bufferRef.current = new Float32Array(analyser.fftSize);

      return { filtered, analyser };
    },
    []
  );

  const getRms = useCallback((): number => {
    const analyser = analyserRef.current;
    const buf = bufferRef.current;
    if (!analyser || !buf) return 0;
    analyser.getFloatTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
    return Math.sqrt(sum / buf.length);
  }, []);

  return { buildPipeline, getRms };
}
