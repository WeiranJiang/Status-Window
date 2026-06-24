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

  return (
    <section className="rounded-[24px] border border-white/60 bg-white/85 p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
            {timer.mode === "timer" ? "Timer Session" : "Stopwatch Session"}
          </p>
          <h2 className="mt-1 text-lg font-bold text-slate-900">{timer.subjectName}</h2>
        </div>
        <div
          className="rounded-full px-3 py-1 text-xs font-semibold text-slate-700"
          style={{
            backgroundColor: timer.subjectColor ? `${timer.subjectColor}22` : "rgba(148, 163, 184, 0.25)",
          }}
        >
          {timer.paused ? "Paused" : "In Progress"}
        </div>
      </div>

      <div className="mt-4 rounded-[24px] bg-slate-900 px-4 py-5 text-center text-white shadow-card">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-300">
          {timer.mode === "timer" ? "Remaining" : "Elapsed"}
        </p>
        <div className="mt-3 font-display text-4xl font-bold tracking-[0.16em] text-white">
          {formatSeconds(displaySeconds)}
        </div>
      </div>

      <div className="mt-4 flex gap-3">
        {timer.paused ? (
          <button
            type="button"
            onClick={() => void onResume()}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-100 px-4 py-3 text-sm font-semibold text-emerald-900 transition hover:-translate-y-0.5"
          >
            <Play className="h-4 w-4" />
            Resume
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void onPause()}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-amber-100 px-4 py-3 text-sm font-semibold text-amber-900 transition hover:-translate-y-0.5"
          >
            <Pause className="h-4 w-4" />
            Pause
          </button>
        )}

        <button
          type="button"
          onClick={() => void onStop()}
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-rose-100 px-4 py-3 text-sm font-semibold text-rose-900 transition hover:-translate-y-0.5"
        >
          <Square className="h-4 w-4" />
          Stop
        </button>
      </div>
    </section>
  );
}
