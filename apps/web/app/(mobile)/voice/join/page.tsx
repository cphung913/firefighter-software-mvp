"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { joinSession } from "@/lib/voice/api";
import { db } from "@/lib/db";

const CODE_LENGTH = 6;
// Characters used by the server: A-Z (minus I/O) + 2-9
const VALID_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export default function VoiceJoinPage() {
  const router = useRouter();
  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const code = digits.join("").toUpperCase();
  const ready = code.replace(/\s/g, "").length === CODE_LENGTH;

  const handleChange = (i: number, val: string) => {
    const ch = val.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(-1);
    if (ch && !VALID_CHARS.includes(ch)) return; // block O/0/I/1
    const next = [...digits];
    next[i] = ch;
    setDigits(next);
    if (ch && i < CODE_LENGTH - 1) {
      inputRefs.current[i + 1]?.focus();
    }
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      inputRefs.current[i - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text").toUpperCase().replace(/[^A-Z0-9]/g, "");
    const next = [...digits];
    let j = 0;
    for (let i = 0; i < CODE_LENGTH && j < text.length; i++) {
      const ch = text[j];
      if (VALID_CHARS.includes(ch)) {
        next[i] = ch;
        j++;
      }
    }
    setDigits(next);
    inputRefs.current[Math.min(j, CODE_LENGTH - 1)]?.focus();
  };

  const handleJoin = async () => {
    if (!ready) return;
    setLoading(true);
    setError(null);
    try {
      const session = await joinSession(code);
      await db.voice_sessions.put({
        id: session.id,
        session_code: session.session_code,
        started_at: session.started_at,
        ended_at: session.ended_at,
        sync_status: session.sync_status,
        cached_at: new Date().toISOString(),
      });
      router.push(`/voice/session/${session.id}`);
    } catch {
      setError("Session not found. Check the code and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center gap-8 px-4 text-center">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Join session</h1>
        <p className="text-muted-foreground text-sm">
          Enter the 6-character code shown on the session leader&apos;s screen.
        </p>
      </div>

      {/* Code entry */}
      <div className="flex gap-2" onPaste={handlePaste}>
        {Array.from({ length: CODE_LENGTH }).map((_, i) => (
          <input
            key={i}
            ref={(el) => { inputRefs.current[i] = el; }}
            type="text"
            inputMode="text"
            maxLength={1}
            value={digits[i]}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            className="h-14 w-12 rounded-xl border-2 bg-card text-center text-2xl font-mono font-bold uppercase transition-colors focus:border-primary focus:outline-none"
            aria-label={`Code character ${i + 1}`}
          />
        ))}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <button
        onClick={handleJoin}
        disabled={!ready || loading}
        className="h-[56px] w-full max-w-xs rounded-xl bg-primary text-primary-foreground font-semibold text-base transition active:scale-95 disabled:opacity-40"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <div className="h-4 w-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
            Joining…
          </span>
        ) : (
          "Join session"
        )}
      </button>

      <button
        onClick={() => router.push("/voice/new")}
        className="text-sm text-primary underline min-h-[44px]"
      >
        Start a new session instead
      </button>
    </div>
  );
}
