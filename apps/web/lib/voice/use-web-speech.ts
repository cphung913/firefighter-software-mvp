"use client";

import { useRef, useState, useCallback, useEffect } from "react";

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: Event) => void) | null;
  onend: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  }
}

export interface UseWebSpeechReturn {
  transcript: string;
  isListening: boolean;
  supported: boolean;
  startListening: () => void;
  stopListening: () => void;
  reset: () => void;
}

export function useWebSpeech(): UseWebSpeechReturn {
  const [transcript, setTranscript] = useState("");
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  const Ctor =
    typeof window !== "undefined"
      ? window.SpeechRecognition ?? window.webkitSpeechRecognition
      : undefined;
  const supported = !!Ctor;

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  const startListening = useCallback(() => {
    if (!Ctor) return;
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";

    rec.onresult = (e: SpeechRecognitionEvent) => {
      let full = "";
      for (let i = 0; i < e.results.length; i++) {
        full += e.results[i][0].transcript;
      }
      setTranscript(full);
    };

    rec.onerror = () => {
      setIsListening(false);
    };

    rec.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = rec;
    rec.start();
    setIsListening(true);
  }, [Ctor]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  const reset = useCallback(() => {
    recognitionRef.current?.stop();
    setTranscript("");
    setIsListening(false);
  }, []);

  return { transcript, isListening, supported, startListening, stopListening, reset };
}
