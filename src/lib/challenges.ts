import { supabase } from "./supabaseClient";
import { getStorageItem, removeStorageItem } from "./storage";
import { toLocalDateKey, toLocalDateKeyFromDate } from "./stats";
import { compareDateKeys, shiftDateKey } from "./timezones";
import type { StudyChallenge, StudySession } from "../types";

const CHALLENGES_STORAGE_KEY_PREFIX = "status-window-challenges:";
const CHALLENGE_COLUMNS = "id, user_id, subject_id, daily_target_minutes, hp_penalty, deadline_date, is_paused, created_at";

function getChallengesStorageKey(userId: string) {
  return `${CHALLENGES_STORAGE_KEY_PREFIX}${userId}`;
}

const formatChallengeError = (scope: string, error: { message: string }) => {
  const missingTableMatch = error.message.match(/Could not find the table '([^']+)' in the schema cache/i);
  if (missingTableMatch) {
    return `${scope}: Missing database table ${missingTableMatch[1]}. Run the Supabase schema SQL from README.md before using synced challenges.`;
  }

  return `${scope}: ${error.message}`;
};

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

function normalizeChallenge(challenge: StudyChallenge) {
  return {
    ...challenge,
    deadline_date: sanitizeDeadlineDate(challenge.deadline_date),
    is_paused: Boolean(challenge.is_paused),
  };
}

async function loadLegacyChallenges(userId: string) {
  const raw = await getStorageItem(getChallengesStorageKey(userId), "local");
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

async function migrateLegacyChallenges(userId: string) {
  const legacyChallenges = await loadLegacyChallenges(userId);
  if (legacyChallenges.length === 0) {
    return [] as StudyChallenge[];
  }

  const rows = legacyChallenges.map((challenge) => ({
    id: challenge.id,
    user_id: userId,
    subject_id: challenge.subject_id,
    daily_target_minutes: sanitizePositiveInt(challenge.daily_target_minutes, 60),
    hp_penalty: sanitizePositiveInt(challenge.hp_penalty, 1),
    deadline_date: sanitizeDeadlineDate(challenge.deadline_date),
    is_paused: Boolean(challenge.is_paused),
    created_at: challenge.created_at,
  }));

  const { data, error } = await supabase
    .from("study_challenges")
    .upsert(rows, { onConflict: "user_id,subject_id" })
    .select(CHALLENGE_COLUMNS);

  if (error) {
    throw new Error(formatChallengeError("Unable to migrate local challenges", error));
  }

  await removeStorageItem(getChallengesStorageKey(userId), "local");
  if (typeof window !== "undefined" && "localStorage" in window) {
    window.localStorage.removeItem(getChallengesStorageKey(userId));
  }
  return ((data as StudyChallenge[] | null) ?? []).map(normalizeChallenge).sort((left, right) =>
    left.created_at.localeCompare(right.created_at),
  );
}

export async function loadChallenges(userId: string) {
  const { data, error } = await supabase
    .from("study_challenges")
    .select(CHALLENGE_COLUMNS)
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(formatChallengeError("Unable to load challenges", error));
  }

  const challenges = ((data as StudyChallenge[] | null) ?? []).map(normalizeChallenge);
  if (challenges.length > 0) {
    return challenges;
  }

  return migrateLegacyChallenges(userId);
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
  const sanitizedTarget = sanitizePositiveInt(payload.daily_target_minutes, 60);
  const sanitizedPenalty = sanitizePositiveInt(payload.hp_penalty, 1);
  const sanitizedDeadline = sanitizeDeadlineDate(payload.deadline_date) ?? null;

  const { data: existing, error: existingError } = await supabase
    .from("study_challenges")
    .select(CHALLENGE_COLUMNS)
    .eq("user_id", userId)
    .eq("subject_id", payload.subject_id)
    .maybeSingle();

  if (existingError) {
    throw new Error(formatChallengeError("Unable to read existing challenge", existingError));
  }

  if (existing) {
    const { error } = await supabase
      .from("study_challenges")
      .update({
        daily_target_minutes: sanitizedTarget,
        hp_penalty: sanitizedPenalty,
        deadline_date: sanitizedDeadline,
        is_paused: Boolean((existing as StudyChallenge).is_paused),
      })
      .eq("id", (existing as StudyChallenge).id)
      .eq("user_id", userId);

    if (error) {
      throw new Error(formatChallengeError("Unable to update challenge", error));
    }
  } else {
    const { error } = await supabase.from("study_challenges").insert({
      user_id: userId,
      subject_id: payload.subject_id,
      daily_target_minutes: sanitizedTarget,
      hp_penalty: sanitizedPenalty,
      deadline_date: sanitizedDeadline,
      is_paused: false,
    });

    if (error) {
      throw new Error(formatChallengeError("Unable to create challenge", error));
    }
  }

  return loadChallenges(userId);
}

export async function deleteChallenge(userId: string, challengeId: string) {
  const { error } = await supabase
    .from("study_challenges")
    .delete()
    .eq("id", challengeId)
    .eq("user_id", userId);

  if (error) {
    throw new Error(formatChallengeError("Unable to delete challenge", error));
  }

  return loadChallenges(userId);
}

export async function setChallengePaused(userId: string, challengeId: string, isPaused: boolean) {
  const { error } = await supabase
    .from("study_challenges")
    .update({ is_paused: isPaused })
    .eq("id", challengeId)
    .eq("user_id", userId);

  if (error) {
    throw new Error(formatChallengeError("Unable to update challenge", error));
  }

  return loadChallenges(userId);
}

export function calculateChallengePenalty(
  sessions: StudySession[],
  challenges: StudyChallenge[],
  today = new Date(),
  timeZone: string | null = null,
) {
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
    const key = `${session.subject_id}:${toLocalDateKey(session.start_time, timeZone)}`;
    map.set(key, (map.get(key) ?? 0) + session.duration_seconds);
    return map;
  }, new Map<string, number>());

  const lastCompletedDayKey = shiftDateKey(toLocalDateKeyFromDate(today, timeZone), -1);

  const breakdown = challenges.map((challenge) => {
    if (challenge.is_paused) {
      return {
        challengeId: challenge.id,
        subjectId: challenge.subject_id,
        missedDays: 0,
        totalPenalty: 0,
      };
    }

    const startDayKey = toLocalDateKey(challenge.created_at, timeZone);
    const penaltyEndDayKey =
      challenge.deadline_date && compareDateKeys(challenge.deadline_date, lastCompletedDayKey) < 0
        ? challenge.deadline_date
        : lastCompletedDayKey;

    let missedDays = 0;
    for (
      let cursor = startDayKey;
      compareDateKeys(cursor, penaltyEndDayKey) <= 0;
      cursor = shiftDateKey(cursor, 1)
    ) {
      const key = `${challenge.subject_id}:${cursor}`;
      const studiedSeconds = subjectDaySeconds.get(key) ?? 0;
      if (studiedSeconds < challenge.daily_target_minutes * 60) {
        missedDays += 1;
      }
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
  timeZone: string | null = null,
) {
  const todayKey = toLocalDateKeyFromDate(today, timeZone);
  const studiedSeconds = sessions
    .filter(
      (session) => session.subject_id === challenge.subject_id && toLocalDateKey(session.start_time, timeZone) === todayKey,
    )
    .reduce((sum, session) => sum + session.duration_seconds, 0);

  const studiedMinutes = Math.floor(studiedSeconds / 60);
  const remainingMinutes = Math.max(challenge.daily_target_minutes - studiedMinutes, 0);
  const completed = remainingMinutes === 0;
  const expired = Boolean(challenge.deadline_date && compareDateKeys(todayKey, challenge.deadline_date) > 0);
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
