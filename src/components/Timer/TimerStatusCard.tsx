import { Pause, Play, Square } from "lucide-react";
import { formatSeconds } from "../../lib/stats";
import type { TimerDisplayState } from "../../types";

export function TimerStatusCard({
  timer,
  onPause,
  onResume,
  onStop,
}: {
  timer: TimerDisplayState;
  onPause: () => Promise<void>;
  onResume: () => Promise<void>;
  onStop: () => Promise<void>;
}) {
  const displaySeconds =
    timer.mode === "timer" && timer.remainingMs !== null
      ? Math.ceil(timer.remainingMs / 1000)
      : Math.floor(timer.elapsedMs / 1000);
  const showCompletionState = timer.completed;

  return (
    <div className="flex flex-col items-center justify-center py-10 text-center animate-in zoom-in-95 duration-300">
      <div className="mb-4">
        <span
          className="sw-display-accent inline-block rounded-full px-6 py-2.5 text-base uppercase tracking-[0.16em] text-white shadow-md ring-2 ring-white/20"
          style={{ backgroundColor: timer.subjectColor ?? "var(--sky)" }}
        >
          {timer.subjectName}
        </span>
      </div>

      <div className="sw-display-accent my-8 text-7xl tracking-tighter text-[var(--ink)] tabular-nums">
        {formatSeconds(displaySeconds)}
      </div>

      {showCompletionState ? (
        <p className="sw-display-accent text-sm uppercase tracking-[0.18em] text-[var(--danger)]">
          Time&apos;s up
        </p>
      ) : null}

      <div className="mt-6 flex items-center gap-6">
        {!timer.paused && !showCompletionState ? (
          <button
            onClick={() => void onPause()}
            className="flex h-16 w-16 items-center justify-center rounded-3xl bg-[var(--paper)] border border-[var(--border)] text-[var(--ink)] transition-all hover:border-[var(--sky)] hover:text-[var(--sky-dark)] hover:shadow-lg active:scale-95"
          >
            <Pause className="h-7 w-7 fill-current" />
          </button>
        ) : null}

        {timer.paused && !showCompletionState ? (
          <button
            onClick={() => void onResume()}
            className="flex h-16 w-16 items-center justify-center rounded-3xl bg-[var(--sky)] text-white transition-all hover:bg-[var(--sky-dark)] shadow-xl active:scale-95"
          >
            <Play className="h-7 w-7 fill-current ml-1" />
          </button>
        ) : null}

        <button
          onClick={() => void onStop()}
          className="flex h-16 w-16 items-center justify-center rounded-3xl bg-[var(--paper)] border border-red-100 text-red-500 transition-all hover:border-red-200 hover:bg-red-50 hover:shadow-lg active:scale-95"
        >
          <Square className="h-6 w-6 fill-current" />
        </button>
      </div>
    </div>
  );
}
