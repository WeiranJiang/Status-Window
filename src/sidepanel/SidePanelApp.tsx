import { Pause, Play, Square } from "lucide-react";
import { useEffect, useState } from "react";
import { getTimerState, pauseTimer, resumeTimer, stopTimer } from "../lib/chrome";
import { saveStudySession } from "../lib/setup";
import { formatSeconds } from "../lib/stats";
import type { SessionDraft, TimerDisplayState } from "../types";

export function SidePanelApp() {
  const [timer, setTimer] = useState<TimerDisplayState | null>(null);
  const [message, setMessage] = useState("Waiting for a session...");

  useEffect(() => {
    const sync = async () => {
      try {
        const response = await getTimerState();
        if (response.ok && response.data) {
          setTimer(response.data.timer.active ? response.data.timer : null);
        }
      } catch {
        setMessage("Status Window could not reach the extension timer service.");
      }
    };

    void sync();
    const interval = window.setInterval(() => void sync(), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const run = async (task: () => Promise<void>) => {
    try {
      await task();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Something went wrong.");
    }
  };

  const displaySeconds =
    timer?.mode === "timer" && timer.remainingMs !== null
      ? Math.ceil(timer.remainingMs / 1000)
      : Math.floor((timer?.elapsedMs ?? 0) / 1000);

  return (
    <div className="sidepanel-shell min-h-screen p-4 text-[var(--sw-ink,#25304d)]">
      <div className="mx-auto max-w-md rounded-[28px] border border-white/60 bg-white/85 p-5 shadow-soft backdrop-blur-xl">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Status Window</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Always-visible timer</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">Keep a compact session card open while you move around Chrome.</p>

        {timer ? (
          <div className="mt-5 rounded-[24px] bg-slate-900 px-4 py-6 text-center text-white shadow-card">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-300">{timer.subjectName}</p>
            <div className="mt-3 font-display text-4xl font-bold tracking-[0.14em]">{formatSeconds(displaySeconds)}</div>
            <div className="mt-5 flex gap-3">
              {timer.paused ? (
                <button
                  type="button"
                  onClick={() =>
                    void run(async () => {
                      const response = await resumeTimer();
                      if (!response.ok || !response.data) {
                        throw new Error(response.error ?? "Unable to resume.");
                      }
                      setTimer(response.data);
                    })
                  }
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-100 px-4 py-3 text-sm font-semibold text-emerald-900"
                >
                  <Play className="h-4 w-4" />
                  Resume
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    void run(async () => {
                      const response = await pauseTimer();
                      if (!response.ok || !response.data) {
                        throw new Error(response.error ?? "Unable to pause.");
                      }
                      setTimer(response.data);
                    })
                  }
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-amber-100 px-4 py-3 text-sm font-semibold text-amber-900"
                >
                  <Pause className="h-4 w-4" />
                  Pause
                </button>
              )}

              <button
                type="button"
                onClick={() =>
                  void run(async () => {
                    const response = await stopTimer();
                    if (!response.ok || !response.data) {
                      throw new Error(response.error ?? "Unable to stop.");
                    }
                    if (response.data.durationSeconds > 0) {
                      await saveStudySession(response.data.draft);
                    }
                    setTimer(null);
                    setMessage("Session saved. Side panel is ready for your next round.");
                  })
                }
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-rose-100 px-4 py-3 text-sm font-semibold text-rose-900"
              >
                <Square className="h-4 w-4" />
                Stop
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-5 rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
            {message}
          </div>
        )}
      </div>
    </div>
  );
}
