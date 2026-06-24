import { memo, useMemo } from "react";
import { calculateHP, calculateTotalStudySeconds, formatDurationShort, toLocalDateKey } from "../../lib/stats";
import { calculateSubjectHours } from "../../lib/radarStats";
import type { StudySession, Subject } from "../../types";
import { SvgRadarChart } from "./RadarChart";
import { RadarSubjectSelector } from "./RadarSubjectSelector";

// ── Types ────────────────────────────────────────────────────────────────────

interface StatsTabProps {
  subjects: Subject[];
  sessions: StudySession[];
  radarSubjectIds: string[];
  onChangeRadarIds: (ids: string[]) => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Last 7 days: returns [{ dateKey, seconds }] newest→oldest */
function last7DaysSessions(sessions: StudySession[]): { label: string; hours: number }[] {
  const days: { label: string; hours: number }[] = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = toLocalDateKey(d.toISOString());
    const label = d.toLocaleDateString(undefined, { weekday: "short" });
    const seconds = sessions
      .filter((s) => toLocalDateKey(s.start_time) === key)
      .reduce((sum, s) => sum + s.duration_seconds, 0);
    days.push({ label, hours: seconds / 3600 });
  }
  return days;
}

// ── Mini weekly bar chart (pure SVG, no recharts) ─────────────────────────────

function WeeklyBars({ days }: { days: { label: string; hours: number }[] }) {
  const maxH = Math.max(0.01, ...days.map((d) => d.hours));
  const barW = 22;
  const gap = 8;
  const chartH = 56;
  const totalW = days.length * (barW + gap) - gap;

  return (
    <svg
      width={totalW}
      height={chartH + 18}
      viewBox={`0 0 ${totalW} ${chartH + 18}`}
      aria-label="Weekly study hours bar chart"
      className="mx-auto"
    >
      {days.map((day, i) => {
        const barH = Math.max(2, (day.hours / maxH) * chartH);
        const x = i * (barW + gap);
        const y = chartH - barH;
        return (
          <g key={i}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={barH}
              rx={4}
              fill="var(--sky)"
              opacity={day.hours === 0 ? 0.18 : 0.82}
            />
            <text
              x={x + barW / 2}
              y={chartH + 11}
              textAnchor="middle"
              fontSize={7.5}
              fontWeight={800}
              fontFamily="inherit"
              fill="var(--muted)"
              letterSpacing="0.04em"
              style={{ textTransform: "uppercase" }}
            >
              {day.label.slice(0, 2)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Subject breakdown row ────────────────────────────────────────────────────

function SubjectRow({
  name,
  color,
  hours,
  maxHours,
}: {
  name: string;
  color: string | null;
  hours: number;
  maxHours: number;
}) {
  const pct = maxHours > 0 ? (hours / maxHours) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: color ?? "var(--sky)" }}
      />
      <span className="w-20 truncate text-[10px] font-bold text-[var(--ink)]">{name}</span>
      <div className="flex-1 overflow-hidden rounded-full bg-[var(--border)]" style={{ height: 5 }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color ?? "var(--sky)" }}
        />
      </div>
      <span className="w-10 shrink-0 text-right text-[10px] font-black text-[var(--muted)]">
        {hours >= 1 ? `${hours.toFixed(1)}h` : hours > 0 ? `${Math.round(hours * 60)}m` : "—"}
      </span>
    </div>
  );
}

// ── Session history item ─────────────────────────────────────────────────────

function SessionItem({ session }: { session: StudySession }) {
  const dateLabel = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(session.start_time));

  return (
    <div className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--paper)] px-4 py-3">
      {session.subject && (
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: session.subject.color ?? "var(--sky)" }}
        />
      )}
      <div className="flex flex-1 flex-col">
        <span className="text-[11px] font-black text-[var(--ink)]">
          {session.subject?.name ?? "Unknown"}
        </span>
        <span className="text-[9px] font-bold uppercase tracking-wide text-[var(--muted)]">
          {dateLabel}
        </span>
      </div>
      <span className="text-[11px] font-black text-[var(--sky-dark)]">
        {formatDurationShort(session.duration_seconds)}
      </span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export const StatsTab = memo(function StatsTab({
  subjects,
  sessions,
  radarSubjectIds,
  onChangeRadarIds,
}: StatsTabProps) {
  // ─ Aggregate metrics ─
  const totalSeconds = useMemo(() => calculateTotalStudySeconds(sessions), [sessions]);
  const totalHours = totalSeconds / 3600;
  const hp = useMemo(() => calculateHP(sessions), [sessions]);
  const weeklyDays = useMemo(() => last7DaysSessions(sessions), [sessions]);
  const subjectHours = useMemo(
    () => calculateSubjectHours(subjects, sessions),
    [subjects, sessions],
  );
  const maxSubjectHours = useMemo(
    () => Math.max(0, ...subjectHours.map((s) => s.totalHours)),
    [subjectHours],
  );

  // ─ Radar data ─
  const selectedRadarData = useMemo(
    () =>
      subjectHours
        .filter((item) => radarSubjectIds.includes(item.subjectId))
        .map((item) => ({
          subjectId: item.subjectId,
          subjectName: item.subjectName,
          totalHours: item.totalHours,
          color: item.color,
        })),
    [subjectHours, radarSubjectIds],
  );

  const activeSubjects = useMemo(() => subjects.filter((s) => s.is_active), [subjects]);
  const hasEnoughSubjects = activeSubjects.length >= 3;
  const hasEnoughSelected = radarSubjectIds.length >= 3;

  // ─ Recent sessions (latest 20) ─
  const recentSessions = useMemo(
    () => [...sessions].sort((a, b) => b.start_time.localeCompare(a.start_time)).slice(0, 20),
    [sessions],
  );

  return (
    <div className="flex flex-col gap-8 py-4 pb-24 animate-in fade-in slide-in-from-bottom-2 duration-500">

      {/* ── Primary metrics ── */}
      <section className="grid grid-cols-2 gap-3">
        <div className="flex flex-col rounded-2xl border border-[var(--border)] bg-[var(--paper)] p-4 shadow-sm">
          <span className="text-[9px] font-black uppercase tracking-widest text-[var(--muted)]">
            Focus Hours
          </span>
          <span className="mt-1 text-3xl font-black tracking-tight text-[var(--ink)]">
            {totalHours.toFixed(1)}
          </span>
          <span className="mt-0.5 text-[9px] font-bold text-[var(--muted)]">all-time</span>
        </div>
        <div className="flex flex-col rounded-2xl border border-[var(--border)] bg-[var(--paper)] p-4 shadow-sm">
          <span className="text-[9px] font-black uppercase tracking-widest text-[var(--muted)]">
            Survival HP
          </span>
          <span
            className={`mt-1 text-3xl font-black tracking-tight ${
              hp < 0 ? "text-[var(--danger)]" : "text-[var(--leaf)]"
            }`}
          >
            {hp}
          </span>
          <span className="mt-0.5 text-[9px] font-bold text-[var(--muted)]">
            {hp >= 0 ? "keep it up" : "study today!"}
          </span>
        </div>
      </section>

      {/* ── Weekly bars ── */}
      <section>
        <span className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">
          This Week
        </span>
        <div className="mt-3 flex justify-center rounded-2xl border border-[var(--border)] bg-[var(--paper)] py-4 shadow-sm">
          <WeeklyBars days={weeklyDays} />
        </div>
      </section>

      {/* ── Radar subject selector ── */}
      <section>
        <RadarSubjectSelector
          subjects={subjects}
          selectedSubjectIds={radarSubjectIds}
          onChange={onChangeRadarIds}
        />

        <div className="mt-3 flex min-h-[200px] items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--paper)] py-4 shadow-sm">
          {!hasEnoughSubjects ? (
            <p className="px-6 py-4 text-center text-[10px] font-bold uppercase tracking-widest text-[var(--muted)] opacity-60">
              Add at least 3 subjects to unlock the radar chart
            </p>
          ) : !hasEnoughSelected ? (
            <p className="px-6 py-4 text-center text-[10px] font-bold uppercase tracking-widest text-[var(--muted)] opacity-60">
              Select at least 3 subjects to show the radar chart
            </p>
          ) : (
            <SvgRadarChart data={selectedRadarData} size={256} />
          )}
        </div>
      </section>

      {/* ── Subject breakdown ── */}
      {subjectHours.length > 0 && (
        <section>
          <span className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">
            By Subject
          </span>
          <div className="mt-3 flex flex-col gap-2.5 rounded-2xl border border-[var(--border)] bg-[var(--paper)] p-4 shadow-sm">
            {subjectHours.map((sh) => (
              <SubjectRow
                key={sh.subjectId}
                name={sh.subjectName}
                color={sh.color}
                hours={sh.totalHours}
                maxHours={maxSubjectHours}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Recent sessions ── */}
      <section>
        <span className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">
          History
        </span>
        {recentSessions.length === 0 ? (
          <p className="mt-3 text-[10px] font-bold uppercase tracking-widest text-[var(--muted)] opacity-60">
            No sessions yet — start your first timer!
          </p>
        ) : (
          <div className="mt-3 flex flex-col gap-2">
            {recentSessions.map((session) => (
              <SessionItem key={session.id} session={session} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
});
