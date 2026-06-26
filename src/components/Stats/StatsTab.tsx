import { memo, useMemo, useState } from "react";
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

function calculateLongestCheckInStreak(sessions: StudySession[]) {
  if (sessions.length === 0) {
    return 0;
  }

  const dayKeys = Array.from(new Set(sessions.map((session) => toLocalDateKey(session.start_time)))).sort();
  let longest = 1;
  let current = 1;

  for (let index = 1; index < dayKeys.length; index += 1) {
    const [previousYear, previousMonth, previousDay] = dayKeys[index - 1].split("-").map(Number);
    const [currentYear, currentMonth, currentDay] = dayKeys[index].split("-").map(Number);
    const previousDate = new Date(previousYear, previousMonth - 1, previousDay);
    const currentDate = new Date(currentYear, currentMonth - 1, currentDay);
    const dayDiff = Math.round((currentDate.getTime() - previousDate.getTime()) / 86_400_000);

    if (dayDiff === 1) {
      current += 1;
      longest = Math.max(longest, current);
    } else {
      current = 1;
    }
  }

  return longest;
}

function getStartOfWeek(date = new Date()) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay());
  return start;
}

// ── Mini weekly bar chart (pure SVG, no recharts) ─────────────────────────────

function WeeklyBars({ days }: { days: { label: string; hours: number }[] }) {
  const maxH = Math.max(0.01, ...days.map((d) => d.hours));
  const maxScale = Math.max(1, Math.ceil(maxH));
  const tickValues = [maxScale, maxScale * (2 / 3), maxScale * (1 / 3), 0];
  const axisW = 24;
  const barW = 22;
  const gap = 8;
  const chartH = 56;
  const barsW = days.length * (barW + gap) - gap;
  const totalW = axisW + 8 + barsW;

  return (
    <svg
      width={totalW}
      height={chartH + 22}
      viewBox={`0 0 ${totalW} ${chartH + 22}`}
      aria-label="Weekly study hours bar chart"
      className="mx-auto"
    >
      {tickValues.map((tick) => {
        const y = chartH - (tick / maxScale) * chartH;
        return (
          <g key={tick}>
            <line
              x1={axisW}
              y1={y}
              x2={totalW}
              y2={y}
              stroke="var(--border)"
              strokeWidth={1}
              opacity={0.65}
            />
            <text
              x={axisW - 4}
              y={y + 2.5}
              textAnchor="end"
              fontSize={6.5}
              fontWeight={800}
              fontFamily="inherit"
              fill="var(--muted)"
            >
              {tick === 0 ? "0h" : `${Number(tick.toFixed(1))}h`}
            </text>
          </g>
        );
      })}
      {days.map((day, i) => {
        const barH = day.hours === 0 ? 0 : Math.max(2, (day.hours / maxScale) * chartH);
        const x = axisW + 8 + i * (barW + gap);
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
              y={chartH + 15}
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
  const longestCheckInStreak = useMemo(() => calculateLongestCheckInStreak(sessions), [sessions]);
  const weeklyDays = useMemo(() => last7DaysSessions(sessions), [sessions]);
  const [outerRingInput, setOuterRingInput] = useState("");
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
  const parsedOuterRingHours = Number(outerRingInput);
  const hasCustomOuterRing =
    outerRingInput.trim().length > 0 && Number.isFinite(parsedOuterRingHours) && parsedOuterRingHours > 0;
  const minimumRadarOuterRingHours = useMemo(
    () => Math.max(1, ...selectedRadarData.map((item) => item.totalHours)),
    [selectedRadarData],
  );
  const radarOuterRingHours = hasCustomOuterRing
    ? Math.max(parsedOuterRingHours, minimumRadarOuterRingHours)
    : Math.max(totalHours, minimumRadarOuterRingHours);

  // ─ Weekly history (latest 20 this week only) ─
  const weeklyHistorySessions = useMemo(
    () => {
      const startOfWeek = getStartOfWeek();
      return [...sessions]
        .filter((session) => new Date(session.start_time) >= startOfWeek)
        .sort((a, b) => b.start_time.localeCompare(a.start_time))
        .slice(0, 20);
    },
    [sessions],
  );

  return (
    <div className="flex flex-col gap-6 py-3 pb-20 animate-in fade-in slide-in-from-bottom-2 duration-500">

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
            Longest streak: {longestCheckInStreak} {longestCheckInStreak === 1 ? "day" : "days"}
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

        <div className="mt-2.5 flex items-end justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--paper)] px-4 py-3 shadow-sm">
          <div className="flex flex-col">
            <span className="text-[9px] font-black uppercase tracking-widest text-[var(--muted)]">
              Outer Ring
            </span>
            <span className="mt-1 text-[10px] font-bold text-[var(--muted)]">
              {hasCustomOuterRing ? "Custom scale" : "Defaults to total hours"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0.1"
              step="0.1"
              inputMode="decimal"
              value={outerRingInput}
              onChange={(event) => setOuterRingInput(event.target.value)}
              placeholder={totalHours.toFixed(1)}
              className="w-20 rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-right text-xs font-black text-[var(--ink)] outline-none transition-all focus:border-[var(--sky)] focus:ring-1 focus:ring-[var(--sky)]"
              aria-label="Radar outer ring hours"
            />
            <span className="text-[10px] font-black uppercase tracking-wide text-[var(--muted)]">
              hours
            </span>
            <button
              type="button"
              onClick={() => setOuterRingInput("")}
              className="rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-[9px] font-black uppercase tracking-wide text-[var(--muted)] transition-all hover:bg-[var(--sky-soft)] hover:text-[var(--sky-dark)] active:scale-95"
            >
              Auto
            </button>
          </div>
        </div>

        <div className="mt-2 flex min-h-[188px] items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--paper)] py-3 shadow-sm">
          {!hasEnoughSubjects ? (
            <p className="px-6 py-4 text-center text-[10px] font-bold uppercase tracking-widest text-[var(--muted)] opacity-60">
              Add at least 3 subjects to unlock the radar chart
            </p>
          ) : !hasEnoughSelected ? (
            <p className="px-6 py-4 text-center text-[10px] font-bold uppercase tracking-widest text-[var(--muted)] opacity-60">
              Select at least 3 subjects to show the radar chart
            </p>
          ) : (
            <SvgRadarChart data={selectedRadarData} outerScaleHours={radarOuterRingHours} size={256} />
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
        <div className="flex items-baseline justify-between">
          <span className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">
            History
          </span>
          <span className="text-[9px] font-bold uppercase tracking-wide text-[var(--muted)]">
            resets weekly
          </span>
        </div>
        {weeklyHistorySessions.length === 0 ? (
          <p className="mt-3 text-[10px] font-bold uppercase tracking-widest text-[var(--muted)] opacity-60">
            No check-ins this week yet.
          </p>
        ) : (
          <div className="mt-3 flex flex-col gap-2">
            {weeklyHistorySessions.map((session) => (
              <SessionItem key={session.id} session={session} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
});
