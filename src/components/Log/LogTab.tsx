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
    if (totalMinutes > 360) {
      setFormError("Maximum session length is 6 hours (360 minutes).");
      return;
    }

    const durationMs = mode === "timer" ? totalMinutes * 60_000 : null;

    if (mode === "timer" && (!Number.isFinite(totalMinutes) || totalMinutes <= 0)) {
      setFormError("Timer mode needs at least one minute.");
      return;
    }

    setFormError(null);
    await onStart({ subject: selectedSubject, mode, durationMs });
  };

  return (
    <div className="flex h-full flex-col gap-3">
      {activeTimer ? (
        <TimerStatusCard timer={activeTimer} onPause={onPause} onResume={onResume} onStop={onStop} />
      ) : (
        <div className="flex flex-col gap-6 py-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
          {/* SUBJECT SELECTOR */}
          <div>
            <span className="sw-display-accent text-[12px] uppercase tracking-widest text-[var(--muted)]">Subject</span>
            <div className="mt-3">
              <select
                value={selectedSubjectId}
                onChange={(e) => setSelectedSubjectId(e.target.value)}
                className="sw-display-accent w-full rounded-xl border border-[var(--border)] bg-[var(--paper)] px-4 py-3.5 text-sm text-[var(--ink)] focus:border-[var(--sky)] focus:ring-1 focus:ring-[var(--sky)] appearance-none cursor-pointer"
              >
                {activeSubjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* MODE & TIME */}
          <div>
            <span className="sw-display-accent text-[12px] uppercase tracking-widest text-[var(--muted)]">Session Mode</span>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setMode("stopwatch")}
                className={`flex flex-col items-center gap-2 rounded-2xl border p-4 transition-all ${
                  mode === "stopwatch" ? "border-[var(--sky)] bg-[var(--paper)] shadow-md ring-1 ring-[var(--sky)]" : "border-[var(--border)] bg-[var(--paper)]/60 opacity-60"
                }`}
              >
                <Clock3 className={`h-6 w-6 ${mode === "stopwatch" ? "text-[var(--sky)]" : ""}`} />
                <span className="sw-display-accent text-[11px] uppercase tracking-tight">Stopwatch</span>
              </button>
              <button
                type="button"
                onClick={() => setMode("timer")}
                className={`flex flex-col items-center gap-2 rounded-2xl border p-4 transition-all ${
                  mode === "timer" ? "border-[var(--sky)] bg-[var(--paper)] shadow-md ring-1 ring-[var(--sky)]" : "border-[var(--border)] bg-[var(--paper)]/60 opacity-60"
                }`}
              >
                <TimerReset className={`h-6 w-6 ${mode === "timer" ? "text-[var(--sky)]" : ""}`} />
                <span className="sw-display-accent text-[11px] uppercase tracking-tight">Timer</span>
              </button>
            </div>

            {mode === "timer" ? (
              <div className="mt-4 flex animate-in slide-in-from-top-2 items-center gap-3">
                <div className="relative flex-1">
                  <input
                    type="number"
                    min="0"
                    value={hours}
                    onChange={(e) => setHours(e.target.value)}
                    className="sw-display-accent w-full rounded-xl border border-[var(--border)] bg-[var(--paper)] px-4 py-3 text-lg text-[var(--ink)] focus:border-[var(--sky)] focus:ring-1 focus:ring-[var(--sky)]"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-[var(--muted)]">HOURS</span>
                </div>
                <div className="relative flex-1">
                  <input
                    type="number"
                    min="0"
                    value={minutes}
                    onChange={(e) => setMinutes(e.target.value)}
                    className="sw-display-accent w-full rounded-xl border border-[var(--border)] bg-[var(--paper)] px-4 py-3 text-lg text-[var(--ink)] focus:border-[var(--sky)] focus:ring-1 focus:ring-[var(--sky)]"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-[var(--muted)]">MINS</span>
                </div>
              </div>
            ) : null}
          </div>

          {/* ACTION */}
          <div className="mt-4">
            <button
              onClick={() => void startSession()}
              className="sw-display-accent flex w-full items-center justify-center gap-3 rounded-2xl bg-[var(--ink)] py-5 text-lg tracking-tight text-white shadow-2xl transition-all hover:bg-black active:scale-[0.98]"
            >
              <Play className="h-6 w-6 fill-white" />
              START SESSION
            </button>
            {formError ? <div className="mt-4 rounded-xl bg-red-50 p-3 text-center text-xs font-bold text-red-500">{formError}</div> : null}
          </div>
        </div>
      )}
    </div>
  );
}
