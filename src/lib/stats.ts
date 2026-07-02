import type { StudySession, Subject } from "../types";
import { compareDateKeys, shiftDateKey, toDateKeyInTimeZone } from "./timezones";

export const formatSeconds = (totalSeconds: number) => {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
};

export const formatDurationShort = (totalSeconds: number) => {
  const hours = totalSeconds / 3600;
  if (hours >= 1) {
    return `${hours.toFixed(hours >= 10 ? 0 : 1)}h`;
  }

  const minutes = Math.max(1, Math.round(totalSeconds / 60));
  return `${minutes}m`;
};

export const formatSessionDate = (isoString: string, timeZone: string | null = null) =>
  new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    ...(timeZone ? { timeZone } : {}),
  }).format(new Date(isoString));

export const toLocalDateKey = (isoString: string, timeZone: string | null = null) =>
  toDateKeyInTimeZone(isoString, timeZone);

export const toLocalDateKeyFromDate = (date: Date, timeZone: string | null = null) => toDateKeyInTimeZone(date, timeZone);

export const calculateTotalStudySeconds = (sessions: StudySession[]) =>
  sessions.reduce((sum, session) => sum + session.duration_seconds, 0);

export const getTotalHoursRequiredForLevel = (level: number) => {
  const safeLevel = Math.max(0, Math.floor(level));
  if (safeLevel === 0) {
    return 0;
  }

  if (safeLevel <= 10) {
    return safeLevel * 100;
  }

  return 1000 + (safeLevel - 10) * 1000;
};

export const calculateLevel = (totalSeconds: number) => {
  const hours = Math.max(0, totalSeconds / 3600);
  let level = 0;

  while (hours >= getTotalHoursRequiredForLevel(level + 1)) {
    level += 1;
  }

  return level;
};

export const getLevelProgress = (totalSeconds: number) => {
  const hours = Math.max(0, totalSeconds / 3600);
  const currentLevel = calculateLevel(totalSeconds);
  const previousThresholdHours = getTotalHoursRequiredForLevel(currentLevel);
  const nextThresholdHours = getTotalHoursRequiredForLevel(currentLevel + 1);
  const spanHours = Math.max(nextThresholdHours - previousThresholdHours, 1);
  const progress = Math.min(Math.max((hours - previousThresholdHours) / spanHours, 0), 1);
  const hoursToNextLevel = Math.max(nextThresholdHours - hours, 0);

  return {
    currentLevel,
    nextLevel: currentLevel + 1,
    previousThresholdHours,
    nextThresholdHours,
    progress,
    hoursToNextLevel,
  };
};

export const calculateHoursBySubject = (sessions: StudySession[], subjects: Subject[]) => {
  const subjectMap = new Map(subjects.map((subject) => [subject.id, subject]));

  return Array.from(
    sessions.reduce((map, session) => {
      const current = map.get(session.subject_id) ?? 0;
      map.set(session.subject_id, current + session.duration_seconds);
      return map;
    }, new Map<string, number>()),
  )
    .map(([subjectId, totalSeconds]) => ({
      subjectId,
      name: subjectMap.get(subjectId)?.name ?? "Archived Subject",
      color: subjectMap.get(subjectId)?.color ?? "#93a0b6",
      totalSeconds,
      totalHours: Number((totalSeconds / 3600).toFixed(2)),
    }))
    .sort((left, right) => right.totalSeconds - left.totalSeconds);
};

export const calculateHP = (sessions: StudySession[], today = new Date(), timeZone: string | null = null) => {
  if (sessions.length === 0) {
    return 0;
  }

  let earliestDayKey = toLocalDateKey(sessions[0].start_time, timeZone);
  const sessionsByDay = sessions.reduce((map, session) => {
    const key = toLocalDateKey(session.start_time, timeZone);
    if (compareDateKeys(key, earliestDayKey) < 0) {
      earliestDayKey = key;
    }

    const current = map.get(key) ?? 0;
    map.set(key, current + session.duration_seconds);
    return map;
  }, new Map<string, number>());
  const endDayKey = toLocalDateKeyFromDate(today, timeZone);

  let hp = 0;
  for (
    let cursor = earliestDayKey;
    compareDateKeys(cursor, endDayKey) <= 0;
    cursor = shiftDateKey(cursor, 1)
  ) {
    const key = cursor;
    const total = sessionsByDay.get(key) ?? 0;
    hp += total >= 3600 ? 1 : -1;
  }

  return hp;
};

export const getTimerSnapshot = (state: {
  active: boolean;
  mode: "stopwatch" | "timer" | null;
  paused: boolean;
  accumulatedMs: number;
  lastResumedAtMs: number | null;
  targetDurationMs: number | null;
}) => {
  if (!state.active || !state.mode) {
    return { elapsedMs: 0, remainingMs: state.targetDurationMs, completed: false };
  }

  const runningMs = state.paused || !state.lastResumedAtMs ? 0 : Date.now() - state.lastResumedAtMs;
  const elapsedMs = state.accumulatedMs + runningMs;
  const remainingMs =
    state.mode === "timer" && state.targetDurationMs !== null
      ? Math.max(state.targetDurationMs - elapsedMs, 0)
      : null;
  const completedAtLimit =
    state.targetDurationMs !== null && elapsedMs >= state.targetDurationMs;

  return {
    elapsedMs,
    remainingMs,
    completed: state.mode === "timer" ? remainingMs === 0 : completedAtLimit,
  };
};
