import { getStorageItem, setStorageItem } from "./storage";
import { toLocalDateKey, toLocalDateKeyFromDate } from "./stats";
import type { StudyChallenge, StudySession } from "../types";

const CHALLENGES_STORAGE_KEY_PREFIX = "status-window-challenges:";

function getChallengesStorageKey(userId: string) {
  return `${CHALLENGES_STORAGE_KEY_PREFIX}${userId}`;
}

function sanitizePositiveInt(value: number, fallback: number) {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(1, Math.round(value));
}

function sanitizeDeadlineDate(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed && /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}

function parseLocalDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function normalizeChallenge(challenge: StudyChallenge) {
  return {
    ...challenge,
    deadline_date: sanitizeDeadlineDate(challenge.deadline_date),
    is_paused: Boolean(challenge.is_paused),
  };
}

export async function loadChallenges(userId: string) {
  const raw = await getStorageItem(getChallengesStorageKey(userId));
  if (!raw) {
    return [] as StudyChallenge[];
  }

  try {
    const parsed = JSON.parse(raw) as StudyChallenge[];
    return Array.isArray(parsed) ? parsed.map((challenge) => normalizeChallenge(challenge)) : [];
  } catch {
    return [];
  }
}

export async function upsertChallenge(
  userId: string,
  payload: {
    subject_id: string;
    daily_target_minutes: number;
    hp_penalty: number;
    deadline_date?: string | null;
  },
) {
  const current = await loadChallenges(userId);
  const existing = current.find((challenge) => challenge.subject_id === payload.subject_id);

  const nextChallenge: StudyChallenge = existing
    ? {
        ...existing,
        daily_target_minutes: sanitizePositiveInt(payload.daily_target_minutes, existing.daily_target_minutes),
        hp_penalty: sanitizePositiveInt(payload.hp_penalty, existing.hp_penalty),
        deadline_date: sanitizeDeadlineDate(payload.deadline_date) ?? null,
        is_paused: Boolean(existing.is_paused),
      }
    : {
        id: crypto.randomUUID(),
        user_id: userId,
        subject_id: payload.subject_id,
        daily_target_minutes: sanitizePositiveInt(payload.daily_target_minutes, 60),
        hp_penalty: sanitizePositiveInt(payload.hp_penalty, 1),
        deadline_date: sanitizeDeadlineDate(payload.deadline_date) ?? null,
        is_paused: false,
        created_at: new Date().toISOString(),
      };

  const next = [...current.filter((challenge) => challenge.subject_id !== payload.subject_id), nextChallenge].sort((left, right) =>
    left.created_at.localeCompare(right.created_at),
  );

  await setStorageItem(getChallengesStorageKey(userId), JSON.stringify(next));
  return next;
}

export async function deleteChallenge(userId: string, challengeId: string) {
  const current = await loadChallenges(userId);
  const next = current.filter((challenge) => challenge.id !== challengeId);
  await setStorageItem(getChallengesStorageKey(userId), JSON.stringify(next));
  return next;
}

export async function setChallengePaused(userId: string, challengeId: string, isPaused: boolean) {
  const current = await loadChallenges(userId);
  const next = current.map((challenge) =>
    challenge.id === challengeId
      ? {
          ...challenge,
          is_paused: isPaused,
        }
      : challenge,
  );
  await setStorageItem(getChallengesStorageKey(userId), JSON.stringify(next));
  return next;
}

export function calculateChallengePenalty(sessions: StudySession[], challenges: StudyChallenge[], today = new Date()) {
  if (challenges.length === 0) {
    return {
      totalPenalty: 0,
      breakdown: [] as Array<{
        challengeId: string;
        subjectId: string;
        missedDays: number;
        totalPenalty: number;
      }>,
    };
  }

  const subjectDaySeconds = sessions.reduce((map, session) => {
    const key = `${session.subject_id}:${toLocalDateKey(session.start_time)}`;
    map.set(key, (map.get(key) ?? 0) + session.duration_seconds);
    return map;
  }, new Map<string, number>());

  const lastCompletedDay = new Date(today);
  lastCompletedDay.setHours(0, 0, 0, 0);
  lastCompletedDay.setDate(lastCompletedDay.getDate() - 1);

  const breakdown = challenges.map((challenge) => {
    if (challenge.is_paused) {
      return {
        challengeId: challenge.id,
        subjectId: challenge.subject_id,
        missedDays: 0,
        totalPenalty: 0,
      };
    }

    const startDay = new Date(challenge.created_at);
    startDay.setHours(0, 0, 0, 0);

    const deadlineDay = challenge.deadline_date ? parseLocalDateKey(challenge.deadline_date) : null;
    const penaltyEndDay =
      deadlineDay && deadlineDay < lastCompletedDay
        ? deadlineDay
        : lastCompletedDay;

    let missedDays = 0;
    const cursor = new Date(startDay);
    while (cursor <= penaltyEndDay) {
      const key = `${challenge.subject_id}:${toLocalDateKeyFromDate(cursor)}`;
      const studiedSeconds = subjectDaySeconds.get(key) ?? 0;
      if (studiedSeconds < challenge.daily_target_minutes * 60) {
        missedDays += 1;
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    return {
      challengeId: challenge.id,
      subjectId: challenge.subject_id,
      missedDays,
      totalPenalty: missedDays * challenge.hp_penalty,
    };
  });

  return {
    totalPenalty: breakdown.reduce((sum, item) => sum + item.totalPenalty, 0),
    breakdown,
  };
}

export function getChallengeTodayStatus(
  sessions: StudySession[],
  challenge: StudyChallenge,
  today = new Date(),
) {
  const todayKey = toLocalDateKeyFromDate(today);
  const studiedSeconds = sessions
    .filter((session) => session.subject_id === challenge.subject_id && toLocalDateKey(session.start_time) === todayKey)
    .reduce((sum, session) => sum + session.duration_seconds, 0);

  const studiedMinutes = Math.floor(studiedSeconds / 60);
  const remainingMinutes = Math.max(challenge.daily_target_minutes - studiedMinutes, 0);
  const completed = remainingMinutes === 0;
  const expired = Boolean(challenge.deadline_date && todayKey > challenge.deadline_date);
  const paused = challenge.is_paused;
  const status = paused
    ? "paused"
    : expired
      ? "expired"
      : completed
        ? "completed"
        : "not_yet";

  return {
    status,
    completed,
    paused,
    expired,
    studiedMinutes,
    remainingMinutes,
    targetMinutes: challenge.daily_target_minutes,
    deadlineDate: challenge.deadline_date,
  };
}
