import type { AuthResponse, User } from "@supabase/supabase-js";
import { DEFAULT_SETTINGS, DEFAULT_SUBJECTS } from "./constants";
import { supabase } from "./supabaseClient";
import type { DashboardData, Profile, SessionDraft, StudySession, Subject, UserSettings } from "../types";

const getFallbackDisplayName = (user: User) =>
  user.user_metadata?.display_name ??
  user.user_metadata?.full_name ??
  user.user_metadata?.name ??
  user.email?.split("@")[0] ??
  "Study Hero";

export const ensureInitialUserData = async (user: User) => {
  const displayName = getFallbackDisplayName(user);
  const profilePromise = supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
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
    throw profileResult.error;
  }

  let profile = profileResult.data as Profile | null;

  if (!profile) {
    const insertResult = await supabase
      .from("profiles")
      .insert({
        id: user.id,
        display_name: displayName,
      })
      .select()
      .single();

    if (insertResult.error) {
      throw insertResult.error;
    }

    profile = insertResult.data as Profile;
  }

  if ((subjectsResult.count ?? 0) === 0) {
    await supabase.from("subjects").insert(
      DEFAULT_SUBJECTS.map((subject) => ({
        user_id: user.id,
        name: subject.name,
        color: subject.color,
      })),
    );
  }

  if ((settingsResult.count ?? 0) === 0) {
    await supabase.from("user_settings").insert({
      user_id: user.id,
      ...DEFAULT_SETTINGS,
    });
  }

  return profile;
};

export const loadDashboardData = async (userId: string): Promise<DashboardData> => {
  const [profileResult, subjectsResult, sessionsResult, settingsResult] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.from("subjects").select("*").eq("user_id", userId).order("created_at", { ascending: true }),
    supabase
      .from("study_sessions")
      .select("*, subject:subjects(id, name, color, is_active)")
      .eq("user_id", userId)
      .order("start_time", { ascending: false }),
    supabase.from("user_settings").select("*").eq("user_id", userId).maybeSingle(),
  ]);

  if (profileResult.error) {
    throw profileResult.error;
  }
  if (subjectsResult.error) {
    throw subjectsResult.error;
  }
  if (sessionsResult.error) {
    throw sessionsResult.error;
  }
  if (settingsResult.error) {
    throw settingsResult.error;
  }

  return {
    profile: (profileResult.data as Profile | null) ?? null,
    subjects: (subjectsResult.data as Subject[]) ?? [],
    sessions: (sessionsResult.data as StudySession[]) ?? [],
    settings: (settingsResult.data as UserSettings) ?? {
      id: "local-default",
      user_id: userId,
      created_at: new Date().toISOString(),
      ...DEFAULT_SETTINGS,
    },
  };
};

export const saveStudySession = async (draft: SessionDraft) => {
  const { data, error } = await supabase
    .from("study_sessions")
    .insert(draft)
    .select("*, subject:subjects(id, name, color, is_active)")
    .single();

  if (error) {
    throw error;
  }

  return data as StudySession;
};

export const updateProfileDisplayName = async (userId: string, displayName: string) => {
  const { data, error } = await supabase
    .from("profiles")
    .upsert({ id: userId, display_name: displayName }, { onConflict: "id" })
    .select()
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
    .select()
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
    .select()
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
    .select()
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
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as UserSettings;
};

export const signInWithEmail = async (email: string, password: string): Promise<AuthResponse> =>
  supabase.auth.signInWithPassword({ email, password });

export const signUpWithEmail = async (email: string, password: string, displayName: string): Promise<AuthResponse> =>
  supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: displayName,
      },
    },
  });
