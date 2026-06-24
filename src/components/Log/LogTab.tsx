import { Clock3, Play, TimerReset } from "lucide-react";
import { useMemo, useState } from "react";
import { MINIMUM_CONFIRM_SAVE_SECONDS } from "../../lib/constants";
import type { Subject, TimerDisplayState } from "../../types";
import { TimerStatusCard } from "../Timer/TimerStatusCard";

export function LogTab({
  subjects,
  activeTimer,
  onStart,
  onPause,
  onResume,
  onStop,
}: {
  subjects: Subject[];
  activeTimer: TimerDisplayState | null;
  onStart: (payload: { subject: Subject; mode: "stopwatch" | "timer"; durationMs: number | null }) => Promise<void>;
  onPause: () => Promise<void>;
  onResume: () => Promise<void>;
  onStop: () => Promise<void>;
}) {
  const activeSubjects = subjects.filter((subject) => subject.is_active);
  const [selectedSubjectId, setSelectedSubjectId] = useState(activeSubjects[0]?.id ?? "");
  const [mode, setMode] = useState<"stopwatch" | "timer">("stopwatch");
  const [hours, setHours] = useState("0");
  const [minutes, setMinutes] = useState("25");
  const [formError, setFormError] = useState<string | null>(null);

  const selectedSubject = useMemo(
    () => activeSubjects.find((subject) => subject.id === selectedSubjectId) ?? activeSubjects[0],
    [activeSubjects, selectedSubjectId],
  );

  const startSession = async () => {
    if (!selectedSubject) {
      setFormError("Please choose a subject before starting.");
      return;
    }

    const totalMinutes = Number(hours) * 60 + Number(minutes);
    const durationMs = mode === "timer" ? totalMinutes * 60_000 : null;

    if (mode === "timer" && (!Number.isFinite(totalMinutes) || totalMinutes <= 0)) {
      setFormError("Timer mode needs at least one minute.");
      return;
    }

    setFormError(null);
    await onStart({ subject: selectedSubject, mode, durationMs });
  };

  return (
    <div className="space-y-4">
      <section className="rounded-[24px] border border-white/60 bg-white/85 p-4 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Log</p>
        <h2 className="mt-1 text-2xl font-bold text-slate-900">What are you focusing on?</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Pick a subject, choose your timing style, and let Status Window keep the session safe in the background.
        </p>
      </section>

      {activeTimer ? (
        <TimerStatusCard timer={activeTimer} onPause={onPause} onResume={onResume} onStop={onStop} />
      ) : (
        <>
          <section className="rounded-[24px] border border-white/60 bg-white/85 p-4 shadow-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Subjects</p>
                <h3 className="mt-1 text-lg font-bold text-slate-900">Choose a track</h3>
              </div>
              <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                {activeSubjects.length} active
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {activeSubjects.map((subject) => {
                const selected = subject.id === selectedSubject?.id;
                return (
                  <button
                    key={subject.id}
                    type="button"
                    onClick={() => setSelectedSubjectId(subject.id)}
                    className={`rounded-2xl border px-3 py-3 text-left transition ${
                      selected ? "border-slate-900 bg-slate-900 text-white" : "border-white/70 bg-white/75 text-slate-700"
                    }`}
                  >
                    <div
                      className="mb-2 h-2 w-10 rounded-full"
                      style={{ backgroundColor: subject.color ?? "#94a3b8" }}
                    />
                    <div className="font-semibold">{subject.name}</div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-[24px] border border-white/60 bg-white/85 p-4 shadow-card">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Mode</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setMode("stopwatch")}
                className={`rounded-2xl border px-4 py-4 text-left transition ${
                  mode === "stopwatch" ? "border-slate-900 bg-slate-900 text-white" : "border-white/70 bg-white/75 text-slate-700"
                }`}
              >
                <Clock3 className="h-5 w-5" />
                <div className="mt-2 text-sm font-semibold">Stopwatch</div>
                <p className="mt-1 text-xs opacity-80">Open-ended focus with pause, resume, and manual stop.</p>
              </button>
              <button
                type="button"
                onClick={() => setMode("timer")}
                className={`rounded-2xl border px-4 py-4 text-left transition ${
                  mode === "timer" ? "border-slate-900 bg-slate-900 text-white" : "border-white/70 bg-white/75 text-slate-700"
                }`}
              >
                <TimerReset className="h-5 w-5" />
                <div className="mt-2 text-sm font-semibold">Timer</div>
                <p className="mt-1 text-xs opacity-80">Counts down, auto-saves, and can finish even after closing the popup.</p>
              </button>
            </div>

            {mode === "timer" ? (
              <div className="mt-4 grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Hours
                  </span>
                  <input
                    type="number"
                    min="0"
                    value={hours}
                    onChange={(event) => setHours(event.target.value)}
                    className="w-full rounded-2xl border border-white/70 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-card outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-slate-200"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Minutes
                  </span>
                  <input
                    type="number"
                    min="0"
                    value={minutes}
                    onChange={(event) => setMinutes(event.target.value)}
                    className="w-full rounded-2xl border border-white/70 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-card outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-slate-200"
                  />
                </label>
              </div>
            ) : null}

            <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-500">
              Sessions under {MINIMUM_CONFIRM_SAVE_SECONDS} seconds will ask before saving, so accidental taps do not clutter your history.
            </div>

            {formError ? <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{formError}</div> : null}

            <button
              type="button"
              onClick={() => void startSession()}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-800 px-4 py-3 text-sm font-semibold text-white shadow-card transition hover:-translate-y-0.5 hover:bg-slate-900"
            >
              <Play className="h-4 w-4" />
              Start Session
            </button>
          </section>
        </>
      )}
    </div>
  );
}
