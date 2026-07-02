import { useEffect, useState } from "react";
import { TimerStatusCard } from "../components/Timer/TimerStatusCard";
import { getTimerState, pauseTimer, resumeTimer, stopTimer } from "../lib/chrome";
import { saveStudySession } from "../lib/setup";
import type { TimerDisplayState } from "../types";

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

  return (
    <div className="sidepanel-shell text-[var(--ink)]">
      <div className="mx-auto flex min-h-screen w-full max-w-[420px] flex-col px-6 py-6">
        <header className="shrink-0">
          <p className="sw-display-accent text-[10px] uppercase tracking-widest text-[var(--muted)]">Status Window</p>
          <h1 className="sw-panel-title mt-2">Always-visible timer</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">
            Keep a compact session card open while you move around Chrome.
          </p>
        </header>

        <main className="flex-1 py-8">
          {timer ? (
            <TimerStatusCard
              timer={timer}
              onPause={async () => {
                await run(async () => {
                  const response = await pauseTimer();
                  if (!response.ok || !response.data) {
                    throw new Error(response.error ?? "Unable to pause.");
                  }
                  setTimer(response.data);
                });
              }}
              onResume={async () => {
                await run(async () => {
                  const response = await resumeTimer();
                  if (!response.ok || !response.data) {
                    throw new Error(response.error ?? "Unable to resume.");
                  }
                  setTimer(response.data);
                });
              }}
              onStop={async () => {
                await run(async () => {
                  const response = await stopTimer();
                  if (!response.ok || !response.data) {
                    throw new Error(response.error ?? "Unable to stop.");
                  }
                  if (response.data.savedInBackground) {
                    setTimer(null);
                    setMessage("Timer closed. The finished session was already saved.");
                    return;
                  }

                  if (response.data.durationSeconds > 0) {
                    await saveStudySession(response.data.draft);
                  }
                  setTimer(null);
                  setMessage("Session saved. Side panel is ready for your next round.");
                });
              }}
            />
          ) : (
            <div className="sw-empty mt-4 px-4 py-8">{message}</div>
          )}
        </main>

        {timer ? (
          <div className="mt-auto flex items-center justify-center gap-3 pb-2 text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">
            <span>{timer.completed ? "Finished" : timer.paused ? "Paused" : "Active"}</span>
            <span className="h-1 w-1 rounded-full bg-[var(--muted)]" />
            <span>{timer.mode === "timer" ? "Timer" : "Stopwatch"}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
