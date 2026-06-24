import type { AuthResponse, User } from "@supabase/supabase-js";
import { getEmailAuthRedirectUrl } from "./authRedirect";
import { DEFAULT_SETTINGS, DEFAULT_SUBJECTS } from "./constants";
import { supabase } from "./supabaseClient";
import type { DashboardCoreData, Profile, SessionDraft, StudySession, Subject, UserSettings } from "../types";

const PROFILE_COLUMNS = "id, display_name, created_at";
const SUBJECT_COLUMNS = "id, user_id, name, color, is_active, created_at";
const SETTINGS_COLUMNS =
  "id, user_id, theme, color_scheme, button_sounds_enabled, tab_sounds_enabled, timer_sound_enabled, volume, floating_mode_enabled, created_at";
const SESSION_COLUMNS =
  "id, user_id, subject_id, mode, start_time, end_time, duration_seconds, created_at, subject:subjects(id, name, color, is_active)";
const shouldLogDataTiming = import.meta.env.DEV;
const formatDataError = (scope: string, error: { message: string }) => {
  const missingTableMatch = error.message.match(/Could not find the table '([^']+)' in the schema cache/i);
  if (missingTableMatch) {
    return `${scope}: Missing database table ${missingTableMatch[1]}. Run the Supabase schema SQL from README.md before using the extension.`;
  }

  return `${scope}: ${error.message}`;
};

async function withDataTiming<T>(label: string, task: () => Promise<T>): Promise<T> {
  if (!shouldLogDataTiming) {
    return task();
  }

  console.time(label);

  try {
    return await task();
  } finally {
    console.timeEnd(label);
  }
}

const normalizeStudySession = (session: {
  subject?: Pick<Subject, "id" | "name" | "color" | "is_active"> | Pick<Subject, "id" | "name" | "color" | "is_active">[] | null;
}): StudySession => {
  const relatedSubject = Array.isArray(session.subject) ? session.subject[0] ?? null : session.subject ?? null;
  return {
    ...(session as StudySession),
    subject: relatedSubject,
  };
};

const getFallbackDisplayName = (user: User) =>
  user.user_metadata?.display_name ??
  user.user_metadata?.full_name ??
  user.user_metadata?.name ??
  user.email?.split("@")[0] ??
  "Study Hero";

export const ensureInitialUserData = async (user: User) => {
  return withDataTiming("ensureInitialUserData", async () => {
    const displayName = getFallbackDisplayName(user);
    const profilePromise = supabase.from("profiles").select(PROFILE_COLUMNS).eq("id", user.id).maybeSingle();
    const subjectsPromise = supabase
      .from("subjects")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);

    const settingsPromise = supabase
      .from("user_settings")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);

    const [profileResult, subjectsResult, settingsResult] = await Promise.all([
      profilePromise,
      subjectsPromise,
      settingsPromise,
    ]);

    if (profileResult.error) {
      throw new Error(formatDataError("Unable to read profile", profileResult.error));
    }
    if (subjectsResult.error) {
      throw new Error(formatDataError("Unable to read subjects", subjectsResult.error));
    }
    if (settingsResult.error) {
      throw new Error(formatDataError("Unable to read settings", settingsResult.error));
    }

    let profile = profileResult.data as Profile | null;

    if (!profile) {
      const insertResult = await supabase
        .from("profiles")
        .insert({
          id: user.id,
          display_name: displayName,
        })
        .select(PROFILE_COLUMNS)
        .single();

      if (insertResult.error) {
        throw new Error(formatDataError("Unable to create profile", insertResult.error));
      }

      profile = insertResult.data as Profile;
    }

    if ((subjectsResult.count ?? 0) === 0) {
      const { error } = await supabase.from("subjects").insert(
        DEFAULT_SUBJECTS.map((subject) => ({
          user_id: user.id,
          name: subject.name,
          color: subject.color,
        })),
      );

      if (error) {
        throw new Error(formatDataError("Unable to create subjects", error));
      }
    }

    if ((settingsResult.count ?? 0) === 0) {
      const { error } = await supabase.from("user_settings").insert({
        user_id: user.id,
        ...DEFAULT_SETTINGS,
      });

      if (error) {
        throw new Error(formatDataError("Unable to create settings", error));
      }
    }

    return profile;
  });
};

export const loadCoreDashboardData = async (userId: string): Promise<DashboardCoreData> => {
  return withDataTiming("loadCoreDashboardData", async () => {
    const [profileResult, subjectsResult, settingsResult] = await Promise.all([
      supabase.from("profiles").select(PROFILE_COLUMNS).eq("id", userId).maybeSingle(),
      supabase.from("subjects").select(SUBJECT_COLUMNS).eq("user_id", userId).order("created_at", { ascending: true }),
      supabase.from("user_settings").select(SETTINGS_COLUMNS).eq("user_id", userId).maybeSingle(),
    ]);

    if (profileResult.error) {
      throw new Error(formatDataError("Unable to load profile", profileResult.error));
    }
    if (subjectsResult.error) {
      throw new Error(formatDataError("Unable to load subjects", subjectsResult.error));
    }
    if (settingsResult.error) {
      throw new Error(formatDataError("Unable to load settings", settingsResult.error));
    }

    return {
      profile: (profileResult.data as Profile | null) ?? null,
      subjects: (subjectsResult.data as Subject[]) ?? [],
      settings: (settingsResult.data as UserSettings) ?? {
        id: "local-default",
        user_id: userId,
        created_at: new Date().toISOString(),
        ...DEFAULT_SETTINGS,
      },
    };
  });
};

export const loadStatsSessions = async (userId: string): Promise<StudySession[]> => {
  return withDataTiming("loadStatsSessions", async () => {
    const { data, error } = await supabase
      .from("study_sessions")
      .select(SESSION_COLUMNS)
      .eq("user_id", userId)
      .order("start_time", { ascending: false });

    if (error) {
      throw error;
    }

    return ((data as Array<Parameters<typeof normalizeStudySession>[0]>) ?? []).map(normalizeStudySession);
  });
};

export const saveStudySession = async (draft: SessionDraft) => {
  const { data, error } = await supabase
    .from("study_sessions")
    .insert(draft)
    .select(SESSION_COLUMNS)
    .single();

  if (error) {
    throw error;
  }

  return normalizeStudySession(data as Parameters<typeof normalizeStudySession>[0]);
};

export const updateProfileDisplayName = async (userId: string, displayName: string) => {
  const { data, error } = await supabase
    .from("profiles")
    .upsert({ id: userId, display_name: displayName }, { onConflict: "id" })
    .select(PROFILE_COLUMNS)
    .single();

  if (error) {
    throw error;
  }

  return data as Profile;
};

export const addSubject = async (userId: string, name: string, color: string) => {
  const { data, error } = await supabase
    .from("subjects")
    .insert({ user_id: userId, name, color, is_active: true })
    .select(SUBJECT_COLUMNS)
    .single();

  if (error) {
    throw error;
  }

  return data as Subject;
};

export const renameSubject = async (subjectId: string, name: string, color: string) => {
  const { data, error } = await supabase
    .from("subjects")
    .update({ name, color })
    .eq("id", subjectId)
    .select(SUBJECT_COLUMNS)
    .single();

  if (error) {
    throw error;
  }

  return data as Subject;
};

export const archiveSubject = async (subjectId: string) => {
  const { data, error } = await supabase
    .from("subjects")
    .update({ is_active: false })
    .eq("id", subjectId)
    .select(SUBJECT_COLUMNS)
    .single();

  if (error) {
    throw error;
  }

  return data as Subject;
};

export const updateUserSettings = async (userId: string, updates: Partial<UserSettings>) => {
  const { data, error } = await supabase
    .from("user_settings")
    .update(updates)
    .eq("user_id", userId)
    .select(SETTINGS_COLUMNS)
    .single();

  if (error) {
    throw error;
  }

  return data as UserSettings;
};

export const signInWithEmail = async (email: string, password: string): Promise<AuthResponse> =>
  supabase.auth.signInWithPassword({ email, password });

export const signUpWithEmail = async (email: string, password: string, displayName: string): Promise<AuthResponse> => {
  const emailRedirectTo = getEmailAuthRedirectUrl();

  return supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: displayName,
      },
      ...(emailRedirectTo ? { emailRedirectTo } : {}),
    },
  });
};
