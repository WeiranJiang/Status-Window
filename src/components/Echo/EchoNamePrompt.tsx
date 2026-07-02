import { useEffect, useMemo, useState } from "react";
import { usePrefersReducedMotion } from "../../hooks/usePrefersReducedMotion";
import type { EchoNamePromptResult } from "../../types/echo";

const PROMPT_TIMEOUT_MS = 30_000;

interface EchoNamePromptProps {
  attemptNumber: number;
  onResolve: (result: EchoNamePromptResult) => void;
}

function getShakeClassName(
  elapsedMs: number,
  prefersReducedMotion: boolean,
) {
  if (prefersReducedMotion || elapsedMs < 2_000) {
    return "";
  }

  if (elapsedMs < 8_000) {
    return "echo-shake-light";
  }

  if (elapsedMs < 18_000) {
    return "echo-shake-medium";
  }

  return "echo-shake-violent";
}

export function EchoNamePrompt({
  attemptNumber,
  onResolve,
}: EchoNamePromptProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [value, setValue] = useState("");
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    let active = true;
    const startedAt = Date.now();
    const interval = window.setInterval(() => {
      if (!active) {
        return;
      }

      const nextElapsedMs = Date.now() - startedAt;
      setElapsedMs(nextElapsedMs);
      if (nextElapsedMs >= PROMPT_TIMEOUT_MS) {
        active = false;
        window.clearInterval(interval);
        onResolve({ type: "timeout" });
      }
    }, 250);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [onResolve]);

  const shakeClassName = useMemo(
    () => getShakeClassName(elapsedMs, prefersReducedMotion),
    [elapsedMs, prefersReducedMotion],
  );

  return (
    <div className="echo-overlay-backdrop">
      <div className="echo-overlay-panel">
        <div className="flex items-start justify-between gap-4">
          <div className="echo-overlay-label">Echo</div>
          <button
            type="button"
            onClick={() => onResolve({ type: "skipped" })}
            className="echo-overlay-skip"
          >
            Skip
          </button>
        </div>
        <div className="mt-5 rounded-3xl border border-[var(--border)] bg-black/5 px-4 py-4">
          <p className="echo-line">Name?</p>
          <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.24em] text-[var(--muted)]">
            Attempt {attemptNumber} of 2
          </p>
          <div className="mt-4 flex items-center gap-2">
            <input
              value={value}
              onChange={(event) => setValue(event.target.value)}
              className="flex-1 rounded-2xl border border-[var(--border)] bg-[var(--paper)] px-4 py-3 text-sm font-bold text-[var(--ink)] outline-none transition-all focus:border-[var(--sky)] focus:ring-1 focus:ring-[var(--sky)]"
              placeholder="Name?"
              autoFocus
            />
            <button
              type="button"
              onClick={() => onResolve({ type: "submit", value })}
              disabled={!value.trim()}
              className={[
                "rounded-2xl bg-[var(--ink)] px-4 py-3 text-xs font-black uppercase tracking-[0.18em] text-white transition-all disabled:opacity-40",
                shakeClassName,
              ]
                .filter(Boolean)
                .join(" ")}
            >
              Submit
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
