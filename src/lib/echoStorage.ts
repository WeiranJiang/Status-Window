import { getStorageItem, setStorageItem } from "./storage";
import { isSupabaseConfigured, supabase } from "./supabaseClient";
import type { EchoEasterEggState, EchoStateRecord } from "../types/echo";

const ECHO_STATE_STORAGE_KEY_PREFIX = "status-window-echo-state:";
const ECHO_TABLE = "echo_easter_egg_state";
const ECHO_COLUMNS =
  "user_id, has_seen_initial_echo, initial_echo_branch, initial_echo_seen_at, initial_echo_completed, eligible_for_10s_followup, followup_window_started_at, studied_10s_after_echo, studied_10s_after_echo_at, got_non_normal_branch, got_normal_40_branch, name_prompt_shown, name_prompt_attempt_count, submitted_name, name_was_correct, level_10_echo_pending, level_10_echo_seen, created_at, updated_at";

function getEchoStorageKey(userId: string) {
  return `${ECHO_STATE_STORAGE_KEY_PREFIX}${userId}`;
}

function isRecoverableEchoStorageError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /(schema cache|table|relation|network|fetch|offline|failed to fetch|timeout)/i.test(message);
}

export function createDefaultEchoState(userId: string): EchoEasterEggState {
  const now = new Date().toISOString();
  return {
    user_id: userId,
    has_seen_initial_echo: false,
    initial_echo_branch: null,
    initial_echo_seen_at: null,
    initial_echo_completed: false,
    eligible_for_10s_followup: false,
    followup_window_started_at: null,
    studied_10s_after_echo: false,
    studied_10s_after_echo_at: null,
    got_non_normal_branch: false,
    got_normal_40_branch: false,
    name_prompt_shown: false,
    name_prompt_attempt_count: 0,
    submitted_name: null,
    name_was_correct: null,
    level_10_echo_pending: false,
    level_10_echo_seen: false,
    created_at: now,
    updated_at: now,
  };
}

async function readLocalEchoState(userId: string): Promise<EchoStateRecord> {
  const fallback = createDefaultEchoState(userId);
  const rawState = await getStorageItem(getEchoStorageKey(userId), "local");
  if (!rawState) {
    return { state: fallback, source: "local" };
  }

  try {
    const parsed = JSON.parse(rawState) as Partial<EchoEasterEggState>;
    return {
      state: {
        ...fallback,
        ...parsed,
        user_id: userId,
      },
      source: "local",
    };
  } catch {
    return { state: fallback, source: "local" };
  }
}

async function writeLocalEchoState(userId: string, updates: Partial<EchoEasterEggState>): Promise<EchoStateRecord> {
  const current = await readLocalEchoState(userId);
  const nextState: EchoEasterEggState = {
    ...current.state,
    ...updates,
    user_id: userId,
    updated_at: new Date().toISOString(),
  };

  await setStorageItem(getEchoStorageKey(userId), JSON.stringify(nextState), "local");
  return { state: nextState, source: "local" };
}

export async function loadEchoState(userId: string): Promise<EchoStateRecord> {
  if (!isSupabaseConfigured) {
    return readLocalEchoState(userId);
  }

  try {
    const { data, error } = await supabase.from(ECHO_TABLE).select(ECHO_COLUMNS).eq("user_id", userId).maybeSingle();
    if (error) {
      throw error;
    }

    if (!data) {
      return { state: createDefaultEchoState(userId), source: "supabase" };
    }

    return {
      state: {
        ...createDefaultEchoState(userId),
        ...(data as Partial<EchoEasterEggState>),
        user_id: userId,
      },
      source: "supabase",
    };
  } catch (error) {
    if (!isRecoverableEchoStorageError(error)) {
      throw error;
    }

    return readLocalEchoState(userId);
  }
}

export async function patchEchoState(
  userId: string,
  updates: Partial<EchoEasterEggState>,
): Promise<EchoStateRecord> {
  if (!isSupabaseConfigured) {
    return writeLocalEchoState(userId, updates);
  }

  const nextTimestamp = new Date().toISOString();

  try {
    const { data, error } = await supabase
      .from(ECHO_TABLE)
      .upsert(
        {
          user_id: userId,
          ...updates,
          updated_at: nextTimestamp,
        },
        { onConflict: "user_id" },
      )
      .select(ECHO_COLUMNS)
      .single();

    if (error) {
      throw error;
    }

    return {
      state: {
        ...createDefaultEchoState(userId),
        ...(data as Partial<EchoEasterEggState>),
        user_id: userId,
      },
      source: "supabase",
    };
  } catch (error) {
    if (!isRecoverableEchoStorageError(error)) {
      throw error;
    }

    return writeLocalEchoState(userId, updates);
  }
}
