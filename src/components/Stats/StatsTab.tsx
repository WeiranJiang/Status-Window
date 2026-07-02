import { memo, useEffect, useMemo, useState } from "react";
import { Minus, Pause, Play, Trash2 } from "lucide-react";
import { calculateChallengePenalty, getChallengeTodayStatus } from "../../lib/challenges";
import { calculateHP, calculateTotalStudySeconds, formatDurationShort, getLevelProgress, toLocalDateKey } from "../../lib/stats";
import { formatInTimeZone, getStartOfWeekDateKey, shiftDateKey } from "../../lib/timezones";
import { calculateSubjectHours } from "../../lib/radarStats";
import type { StudyChallenge, StudySession, Subject } from "../../types";
import { SvgRadarChart } from "./RadarChart";
import { RadarSubjectSelector } from "./RadarSubjectSelector";

// ── Types ────────────────────────────────────────────────────────────────────

interface StatsTabProps {
  subjects: Subject[];
  sessions: StudySession[];
  challenges: StudyChallenge[];
  timeZone: string | null;
  baseHp: number;
  challengePenalty: number;
  radarSubjectIds: string[];
  onChangeRadarIds: (ids: string[]) => void;
  onSaveChallenge: (payload: { subjectId: string; dailyTargetMinutes: number; hpPenalty: number; deadlineDate: string | null }) => Promise<void>;
  onDeleteChallenge: (challengeId: string) => Promise<void>;
  onToggleChallengePaused: (challengeId: string, paused: boolean) => Promise<void>;
  onReduceSessionTime: (session: StudySession, secondsToRemove: number) => Promise<void>;
}

const sectionHeadingClassName = "sw-display-accent text-[12px] uppercase tracking-widest text-[var(--muted)]";

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Last 7 days: returns [{ dateKey, seconds }] newest→oldest */
function last7DaysSessions(sessions: StudySession[], timeZone: string | null): { label: string; hours: number }[] {
  const days: { label: string; hours: number }[] = [];
  const today = new Date();
  const todayKey = toLocalDateKey(today.toISOString(), timeZone);
  for (let i = 6; i >= 0; i--) {
    const key = shiftDateKey(todayKey, -i);
    const label = formatInTimeZone(new Date(`${key}T12:00:00Z`), { weekday: "short" }, "UTC");
    const seconds = sessions
      .filter((s) => toLocalDateKey(s.start_time, timeZone) === key)
      .reduce((sum, s) => sum + s.duration_seconds, 0);
    days.push({ label, hours: seconds / 3600 });
  }
  return days;
}

function calculateLongestCheckInStreak(sessions: StudySession[], timeZone: string | null) {
  if (sessions.length === 0) {
    return 0;
  }

  const dayKeys = Array.from(new Set(sessions.map((session) => toLocalDateKey(session.start_time, timeZone)))).sort();
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

// ── Mini weekly bar chart (pure SVG, no recharts) ─────────────────────────────

function WeeklyBars({ days }: { days: { label: string; hours: number }[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const maxH = Math.max(0.01, ...days.map((d) => d.hours));
  const maxScale = Math.max(1, Math.ceil(maxH));
  const tickValues = [maxScale, maxScale * (2 / 3), maxScale * (1 / 3), 0];
  const topPad = 18;
  const axisW = 24;
  const barW = 22;
  const gap = 8;
  const chartH = 56;
  const barsW = days.length * (barW + gap) - gap;
  const totalW = axisW + 8 + barsW;
  const totalH = topPad + chartH + 22;
  const formatHoverHours = (hours: number) => (hours === 0 ? "0h" : `${hours.toFixed(hours >= 10 ? 0 : 1)}h`);
  const activeDay = activeIndex === null ? null : days[activeIndex];
  const activeX = activeIndex === null ? null : axisW + 8 + activeIndex * (barW + gap);

  return (
    <svg
      width={totalW}
      height={totalH}
      viewBox={`0 0 ${totalW} ${totalH}`}
      aria-label="Weekly study hours bar chart"
      className="mx-auto"
    >
      {tickValues.map((tick) => {
        const y = topPad + chartH - (tick / maxScale) * chartH;
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
              fontFamily="var(--font-display)"
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
        const y = topPad + chartH - barH;
        return (
          <g
            key={i}
            onMouseEnter={() => setActiveIndex(i)}
            onMouseLeave={() => setActiveIndex((current) => (current === i ? null : current))}
          >
            <rect
              x={x}
              y={y}
              width={barW}
              height={barH}
              rx={4}
              fill="var(--sky)"
              opacity={day.hours === 0 ? 0.18 : activeIndex === i ? 1 : 0.82}
            />
            <rect
              x={x - 2}
              y={topPad}
              width={barW + 4}
              height={chartH}
              rx={6}
              fill="transparent"
            />
            <text
              x={x + barW / 2}
              y={topPad + chartH + 15}
              textAnchor="middle"
              fontSize={7.5}
              fontWeight={800}
              fontFamily="var(--font-display)"
              fill="var(--muted)"
              letterSpacing="0.04em"
              style={{ textTransform: "uppercase" }}
            >
              {day.label.slice(0, 2)}
            </text>
          </g>
        );
      })}
      {activeDay && activeX !== null ? (
        <g pointerEvents="none">
          <rect
            x={activeX - 9}
            y={1}
            width={barW + 18}
            height={14}
            rx={7}
            fill="var(--paper)"
            stroke="var(--border)"
          />
          <text
            x={activeX + barW / 2}
            y={10.5}
            textAnchor="middle"
            fontSize={7.5}
            fontWeight={800}
            fontFamily="var(--font-display)"
            fill="var(--ink)"
            letterSpacing="0.04em"
          >
            {formatHoverHours(activeDay.hours)}
          </text>
        </g>
      ) : null}
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
      <span className="sw-display-accent w-24 truncate text-[12px] text-[var(--ink)]">{name}</span>
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

function ChallengeRow({
  label,
  detail,
}: {
  label: string;
  detail: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="sw-display-accent text-[10px] uppercase tracking-wide text-[var(--ink)]">{label}</span>
      <span className="sw-display-accent text-right text-[10px] text-[var(--muted)]">{detail}</span>
    </div>
  );
}

// ── Session history item ─────────────────────────────────────────────────────

function SessionItem({
  session,
  timeZone,
  onReduceTime,
}: {
  session: StudySession;
  timeZone: string | null;
  onReduceTime: (secondsToRemove: number) => Promise<void>;
}) {
  const dateLabel = formatInTimeZone(
    new Date(session.start_time),
    {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    },
    timeZone,
  );
  const [editing, setEditing] = useState(false);
  const [removeMinutesInput, setRemoveMinutesInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const maxMinutes = Math.max(1, Math.ceil(session.duration_seconds / 60));
  const quickAdjustments = [5, 15, 30, 60].filter((minutes) => minutes < maxMinutes);

  const closeEditor = () => {
    setEditing(false);
    setRemoveMinutesInput("");
    setSubmitting(false);
  };

  const submitReduction = async (requestedMinutes: number) => {
    const nextMinutes = Math.floor(requestedMinutes);
    if (!Number.isFinite(nextMinutes) || nextMinutes <= 0) {
      return;
    }

    const safeSecondsToRemove = Math.min(nextMinutes * 60, session.duration_seconds);
    const removesEntireSession = safeSecondsToRemove >= session.duration_seconds;
    if (removesEntireSession) {
      const confirmed = window.confirm(
        `Remove ${session.subject?.name ?? "this session"} from your history entirely?`,
      );
      if (!confirmed) {
        return;
      }
    }

    setSubmitting(true);
    try {
      await onReduceTime(safeSecondsToRemove);
      closeEditor();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--paper)] px-4 py-3">
      <div className="flex items-center gap-3">
        {session.subject && (
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: session.subject.color ?? "var(--sky)" }}
          />
        )}
        <div className="flex flex-1 flex-col">
          <span className="sw-display-accent text-[11px] text-[var(--ink)]">
            {session.subject?.name ?? "Unknown"}
          </span>
          <span className="sw-display-accent text-[9px] uppercase tracking-wide text-[var(--muted)]">
            {dateLabel}
          </span>
        </div>
        <span className="sw-display-accent text-[11px] text-[var(--sky-dark)]">
          {formatDurationShort(session.duration_seconds)}
        </span>
        <button
          type="button"
          aria-label={`Subtract time from ${session.subject?.name ?? "this session"}`}
          onClick={() => {
            if (submitting) {
              return;
            }

            if (editing) {
              closeEditor();
              return;
            }

            setEditing(true);
            setRemoveMinutesInput("");
          }}
          className="flex shrink-0 items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-1.5 text-[9px] font-black uppercase tracking-wide text-red-600 transition-all hover:bg-red-100 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
          title={editing ? "Close adjustment controls" : "Subtract time from this session"}
          disabled={submitting}
        >
          <Minus className="h-3.5 w-3.5 shrink-0" />
          <span>{editing ? "Close" : "Adjust"}</span>
        </button>
      </div>
      {editing ? (
        <div className="mt-3 rounded-xl bg-[var(--sky-soft)] px-3 py-3">
          <div className="mb-2 flex flex-wrap gap-2">
            {quickAdjustments.map((minutes) => (
              <button
                key={minutes}
                type="button"
                onClick={() => void submitReduction(minutes)}
                className="rounded-full border border-red-200 bg-white px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-red-600 transition-all hover:bg-red-50 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={submitting}
              >
                -{minutes >= 60 ? `${minutes / 60}h` : `${minutes}m`}
              </button>
            ))}
            <button
              type="button"
              onClick={() => void submitReduction(maxMinutes)}
              className="rounded-full border border-red-200 bg-white px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-red-600 transition-all hover:bg-red-50 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={submitting}
            >
              Remove all
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="number"
              min="1"
              max={maxMinutes}
              step="1"
              inputMode="numeric"
              value={removeMinutesInput}
              onChange={(event) => setRemoveMinutesInput(event.target.value)}
              placeholder={`1-${maxMinutes}`}
              className="w-24 rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-right text-xs font-black text-[var(--ink)] outline-none transition-all focus:border-[var(--sky)] focus:ring-1 focus:ring-[var(--sky)]"
              aria-label={`Minutes to remove from ${session.subject?.name ?? "session"}`}
              disabled={submitting}
            />
            <span className="text-[9px] font-black uppercase tracking-wide text-[var(--muted)]">
              Minutes to subtract
            </span>
            <button
              type="button"
              onClick={() => void submitReduction(Number(removeMinutesInput))}
              className="rounded-full bg-red-500 px-3 py-1.5 text-[9px] font-black uppercase tracking-wide text-white transition-all hover:bg-red-600 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={submitting}
            >
              {submitting ? "Saving..." : "Apply"}
            </button>
            <button
              type="button"
              onClick={closeEditor}
              className="rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-[9px] font-black uppercase tracking-wide text-[var(--muted)] transition-all hover:bg-[var(--paper)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={submitting}
            >
              Cancel
            </button>
          </div>
          <p className="mt-2 text-[9px] font-black uppercase tracking-wide text-[var(--muted)]">
            Max {maxMinutes}m ({formatDurationShort(session.duration_seconds)})
          </p>
        </div>
      ) : null}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export const StatsTab = memo(function StatsTab({
  subjects,
  sessions,
  challenges,
  timeZone,
  baseHp,
  challengePenalty,
  radarSubjectIds,
  onChangeRadarIds,
  onSaveChallenge,
  onDeleteChallenge,
  onToggleChallengePaused,
  onReduceSessionTime,
}: StatsTabProps) {
  // ─ Aggregate metrics ─
  const totalSeconds = useMemo(() => calculateTotalStudySeconds(sessions), [sessions]);
  const totalHours = totalSeconds / 3600;
  const hp = useMemo(() => calculateHP(sessions, new Date(), timeZone), [sessions, timeZone]);
  const levelProgress = useMemo(() => getLevelProgress(totalSeconds), [totalSeconds]);
  const longestCheckInStreak = useMemo(() => calculateLongestCheckInStreak(sessions, timeZone), [sessions, timeZone]);
  const weeklyDays = useMemo(() => last7DaysSessions(sessions, timeZone), [sessions, timeZone]);
  const [outerRingInput, setOuterRingInput] = useState("");
  const [selectedChallengeSubjectId, setSelectedChallengeSubjectId] = useState("");
  const [dailyTargetInput, setDailyTargetInput] = useState("60");
  const [hpPenaltyInput, setHpPenaltyInput] = useState("1");
  const [deadlineInput, setDeadlineInput] = useState("");
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
  const challengeBySubjectId = useMemo(
    () => new Map(challenges.map((challenge) => [challenge.subject_id, challenge])),
    [challenges],
  );
  const challengeSummary = useMemo(
    () => calculateChallengePenalty(sessions, challenges, new Date(), timeZone),
    [sessions, challenges, timeZone],
  );
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
      const startOfWeekKey = getStartOfWeekDateKey(new Date(), timeZone);
      return [...sessions]
        .filter((session) => toLocalDateKey(session.start_time, timeZone) >= startOfWeekKey)
        .sort((a, b) => b.start_time.localeCompare(a.start_time))
        .slice(0, 20);
    },
    [sessions, timeZone],
  );

  useEffect(() => {
    if (activeSubjects.length === 0) {
      setSelectedChallengeSubjectId("");
      return;
    }

    setSelectedChallengeSubjectId((current) =>
      activeSubjects.some((subject) => subject.id === current) ? current : activeSubjects[0].id,
    );
  }, [activeSubjects]);

  useEffect(() => {
    if (!selectedChallengeSubjectId) {
      return;
    }

    const existing = challengeBySubjectId.get(selectedChallengeSubjectId);
    setDailyTargetInput(existing ? String(existing.daily_target_minutes) : "60");
    setHpPenaltyInput(existing ? String(existing.hp_penalty) : "1");
    setDeadlineInput(existing?.deadline_date ?? "");
  }, [selectedChallengeSubjectId, challengeBySubjectId]);

  return (
    <div className="flex flex-col gap-6 pt-1 pb-20 animate-in fade-in slide-in-from-bottom-2 duration-500">

      {/* ── Primary metrics ── */}
      <section className="grid grid-cols-2 gap-3">
        <div className="flex flex-col rounded-2xl border border-[var(--border)] bg-[var(--paper)] p-4 shadow-sm">
          <span className="sw-display-accent text-[13px] uppercase tracking-widest text-[var(--muted)]">
            Focus Hours
          </span>
          <span className="sw-display-accent mt-1 text-3xl tracking-tight text-[var(--ink)]">
            {totalHours.toFixed(1)}
          </span>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--border)]">
            <div
              className="h-full rounded-full bg-[var(--sky)] transition-all duration-500"
              style={{ width: `${Math.max(levelProgress.progress * 100, 4)}%` }}
            />
          </div>
          <span className="sw-display-accent mt-1 text-[9px] text-[var(--muted)]">
            {levelProgress.hoursToNextLevel.toFixed(levelProgress.hoursToNextLevel >= 10 ? 0 : 1)}h to LVL {levelProgress.nextLevel}
          </span>
          <span className="mt-0.5 text-[9px] font-bold text-[var(--muted)]">all-time</span>
        </div>
        <div className="flex flex-col rounded-2xl border border-[var(--border)] bg-[var(--paper)] p-4 shadow-sm">
          <span className="sw-display-accent text-[13px] uppercase tracking-widest text-[var(--muted)]">
            Survival HP
          </span>
          <span
            className={`sw-display-accent mt-1 text-3xl tracking-tight ${
              baseHp - challengePenalty < 0 ? "text-[var(--danger)]" : "text-[var(--leaf)]"
            }`}
          >
            {baseHp - challengePenalty}
          </span>
          <div className="mt-0.5 flex flex-col gap-0.5 text-[9px] font-bold text-[var(--muted)]">
            <span>Base HP: {hp}</span>
            <span>Challenge loss: -{challengePenalty}</span>
            <span>
              Longest streak: {longestCheckInStreak} {longestCheckInStreak === 1 ? "day" : "days"}
            </span>
          </div>
        </div>
      </section>

      {/* ── Weekly bars ── */}
      <section>
          <span className={sectionHeadingClassName}>
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
          <span className={sectionHeadingClassName}>
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

      <section>
        <div className="flex items-baseline justify-between">
          <span className={sectionHeadingClassName}>
            Challenges
          </span>
          <span className="sw-display-accent text-[9px] uppercase tracking-wide text-[var(--muted)]">
            whole-number HP only
          </span>
        </div>

        <div className="mt-3 flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--paper)] p-4 shadow-sm">
          {activeSubjects.length === 0 ? (
            <p className="sw-display-accent text-[10px] uppercase tracking-widest text-[var(--muted)] opacity-60">
              Add a subject first to create a challenge.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-2">
                <select
                  value={selectedChallengeSubjectId}
                  onChange={(event) => setSelectedChallengeSubjectId(event.target.value)}
                  className="sw-display-accent rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-xs text-[var(--ink)] outline-none transition-all focus:border-[var(--sky)] focus:ring-1 focus:ring-[var(--sky)]"
                >
                  {activeSubjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name}
                    </option>
                  ))}
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex flex-col gap-1">
                    <span className="sw-display-accent text-[9px] uppercase tracking-wide text-[var(--muted)]">
                      Daily Minutes
                    </span>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      inputMode="numeric"
                      value={dailyTargetInput}
                      onChange={(event) => setDailyTargetInput(event.target.value)}
                      className="sw-display-accent rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-xs text-[var(--ink)] outline-none transition-all focus:border-[var(--sky)] focus:ring-1 focus:ring-[var(--sky)]"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="sw-display-accent text-[9px] uppercase tracking-wide text-[var(--muted)]">
                      HP Lost
                    </span>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      inputMode="numeric"
                      value={hpPenaltyInput}
                      onChange={(event) => setHpPenaltyInput(event.target.value)}
                      className="sw-display-accent rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-xs text-[var(--ink)] outline-none transition-all focus:border-[var(--sky)] focus:ring-1 focus:ring-[var(--sky)]"
                    />
                  </label>
                </div>
                <label className="flex flex-col gap-1">
                  <span className="sw-display-accent text-[9px] uppercase tracking-wide text-[var(--muted)]">
                    Deadline
                  </span>
                  <input
                    type="date"
                    value={deadlineInput}
                    onChange={(event) => setDeadlineInput(event.target.value)}
                    className="sw-display-accent rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-xs text-[var(--ink)] outline-none transition-all focus:border-[var(--sky)] focus:ring-1 focus:ring-[var(--sky)]"
                  />
                </label>
              </div>

              <button
                type="button"
                onClick={() => {
                  const dailyTargetMinutes = Math.max(1, Math.round(Number(dailyTargetInput)));
                  const hpLoss = Math.max(1, Math.round(Number(hpPenaltyInput)));

                  if (!selectedChallengeSubjectId || !Number.isFinite(dailyTargetMinutes) || !Number.isFinite(hpLoss)) {
                    return;
                  }

                  void onSaveChallenge({
                    subjectId: selectedChallengeSubjectId,
                    dailyTargetMinutes,
                    hpPenalty: hpLoss,
                    deadlineDate: deadlineInput.trim() || null,
                  });
                }}
                className="sw-display-accent inline-flex h-10 items-center justify-center rounded-xl bg-[var(--sky)] px-4 text-[10px] uppercase tracking-wider text-white shadow-sm transition-all hover:bg-[var(--sky-dark)] active:scale-95"
              >
                {challengeBySubjectId.has(selectedChallengeSubjectId) ? "Update challenge" : "Save challenge"}
              </button>

              <div className="rounded-xl bg-[var(--sky-soft)] px-3 py-2">
                <ChallengeRow label="Penalty so far" detail={`-${challengeSummary.totalPenalty} HP`} />
              </div>
            </>
          )}
        </div>

        {challenges.length > 0 ? (
          <div className="mt-3 flex flex-col gap-2">
            {challenges.map((challenge) => {
              const subject = activeSubjects.find((item) => item.id === challenge.subject_id) ?? subjects.find((item) => item.id === challenge.subject_id);
              const summary = challengeSummary.breakdown.find((item) => item.challengeId === challenge.id);
              const deadlineLabel = challenge.deadline_date
                ? formatInTimeZone(
                    new Date(`${challenge.deadline_date}T12:00:00Z`),
                    {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    },
                    "UTC",
                  )
                : "No deadline";

              return (
                <div
                  key={challenge.id}
                  className="flex items-start gap-3 rounded-2xl border border-[var(--border)] bg-[var(--paper)] px-4 py-3 shadow-sm"
                >
                  <div className="flex flex-1 flex-col gap-1">
                    <span className="sw-display-accent text-[13px] text-[var(--ink)]">
                      {subject?.name ?? "Archived subject"}
                    </span>
                    <span className="text-[9px] font-bold uppercase tracking-wide text-[var(--muted)]">
                      {challenge.daily_target_minutes} min daily · -{challenge.hp_penalty} HP each miss
                    </span>
                    <span className="text-[9px] font-bold uppercase tracking-wide text-[var(--muted)]">
                      {challenge.is_paused ? "Paused" : "Active"} · {deadlineLabel}
                    </span>
                    {(() => {
                      const todayStatus = getChallengeTodayStatus(sessions, challenge, new Date(), timeZone);
                      const statusTone = todayStatus.status === "completed"
                        ? {
                            backgroundColor: "var(--sky-soft)",
                            textColor: "var(--sky-dark)",
                            detailColor: "var(--ink-soft)",
                          }
                        : todayStatus.status === "paused"
                          ? {
                              backgroundColor: "color-mix(in srgb, var(--ink-soft) 10%, var(--paper))",
                              textColor: "var(--ink-soft)",
                              detailColor: "var(--ink-soft)",
                            }
                          : todayStatus.status === "expired"
                            ? {
                                backgroundColor: "color-mix(in srgb, var(--muted) 16%, var(--paper))",
                                textColor: "var(--muted)",
                                detailColor: "var(--muted)",
                              }
                            : {
                            backgroundColor: "color-mix(in srgb, var(--danger) 12%, var(--paper))",
                            textColor: "var(--danger)",
                            detailColor: "var(--danger)",
                          };
                      const statusLabel =
                        todayStatus.status === "completed"
                          ? "Completed today"
                          : todayStatus.status === "paused"
                            ? "Paused"
                            : todayStatus.status === "expired"
                              ? "Deadline passed"
                              : "Not yet";

                      return (
                        <div
                          className="mt-1 flex items-center justify-between gap-3 rounded-xl px-3 py-2"
                          style={{ backgroundColor: statusTone.backgroundColor }}
                        >
                          <span
                            className="sw-display-accent text-[9px] uppercase tracking-wide"
                            style={{ color: statusTone.textColor }}
                          >
                            {statusLabel}
                          </span>
                          <span
                            className="sw-display-accent text-[9px] uppercase tracking-wide"
                            style={{ color: statusTone.detailColor }}
                          >
                            {todayStatus.studiedMinutes}/{todayStatus.targetMinutes} min
                            {todayStatus.status === "not_yet" ? ` · ${todayStatus.remainingMinutes} min left` : ""}
                          </span>
                        </div>
                      );
                    })()}
                    <span className="text-[9px] font-bold uppercase tracking-wide text-[var(--muted)]">
                      Missed days: {summary?.missedDays ?? 0} · Total loss: -{summary?.totalPenalty ?? 0} HP
                    </span>
                  </div>
                  <div className="flex shrink-0 flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => void onToggleChallengePaused(challenge.id, !challenge.is_paused)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] transition-all hover:bg-[var(--sky-soft)] hover:text-[var(--sky-dark)] active:scale-95"
                      title={challenge.is_paused ? "Resume challenge" : "Pause challenge"}
                    >
                      {challenge.is_paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => void onDeleteChallenge(challenge.id)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] transition-all hover:bg-red-50 hover:text-red-500 active:scale-95"
                      title="Delete challenge"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="mt-3 text-[10px] font-bold uppercase tracking-widest text-[var(--muted)] opacity-60">
            No subject challenges yet.
          </p>
        )}
      </section>

      {/* ── Recent sessions ── */}
      <section>
        <div className="flex items-baseline justify-between">
          <span className={sectionHeadingClassName}>
            History
          </span>
          <span className="sw-display-accent text-[9px] uppercase tracking-wide text-[var(--muted)]">
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
              <SessionItem
                key={session.id}
                session={session}
                timeZone={timeZone}
                onReduceTime={(secondsToRemove) => onReduceSessionTime(session, secondsToRemove)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
});
