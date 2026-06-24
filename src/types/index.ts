export type AppTab = "log" | "stats" | "friends" | "settings" | "info";
export type AuthMode = "signup" | "login";
export type SessionMode = "stopwatch" | "timer";
export type ThemeMode = "light" | "dark";
export type SoundType = "button" | "tab" | "completion";

export interface Profile {
  id: string;
  display_name: string | null;
  created_at: string;
}

export interface Subject {
  id: string;
  user_id: string;
  name: string;
  color: string | null;
  is_active: boolean;
  created_at: string;
}

export interface StudySession {
  id: string;
  user_id: string;
  subject_id: string;
  mode: SessionMode;
  start_time: string;
  end_time: string;
  duration_seconds: number;
  created_at: string;
  subject?: Pick<Subject, "id" | "name" | "color" | "is_active"> | null;
}

export interface UserSettings {
  id: string;
  user_id: string;
  theme: ThemeMode;
  color_scheme: string | null;
  button_sounds_enabled: boolean;
  tab_sounds_enabled: boolean;
  timer_sound_enabled: boolean;
  volume: number;
  floating_mode_enabled: boolean;
  created_at: string;
}

export interface ColorScheme {
  id: string;
  name: string;
  description: string;
  bg: string;
  paper: string;
  ink: string;
  inkSoft: string;
  muted: string;
  accent: string;
  accentSoft: string;
  accentStrong: string;
  success: string;
  danger: string;
  border: string;
}

export interface TimerState {
  active: boolean;
  mode: SessionMode | null;
  subjectId: string | null;
  subjectName: string | null;
  subjectColor: string | null;
  startedAtMs: number | null;
  lastResumedAtMs: number | null;
  accumulatedMs: number;
  targetDurationMs: number | null;
  paused: boolean;
  userId: string | null;
  authAccessToken: string | null;
  authRefreshToken: string | null;
}

export interface TimerDisplayState extends TimerState {
  elapsedMs: number;
  remainingMs: number | null;
  completed: boolean;
}

export interface TimerCompletionNotice {
  id: string;
  subjectName: string;
  durationSeconds: number;
  saved: boolean;
  errorMessage?: string;
}

export interface SessionDraft {
  user_id: string;
  subject_id: string;
  mode: SessionMode;
  start_time: string;
  end_time: string;
  duration_seconds: number;
}

export interface DashboardData {
  profile: Profile | null;
  subjects: Subject[];
  sessions: StudySession[];
  settings: UserSettings;
}

export interface DashboardCoreData {
  profile: Profile | null;
  subjects: Subject[];
  settings: UserSettings;
}

export interface TimerStartPayload {
  mode: SessionMode;
  subjectId: string;
  subjectName: string;
  subjectColor: string | null;
  targetDurationMs: number | null;
  userId: string;
  authAccessToken: string;
  authRefreshToken: string;
}

export interface ServiceWorkerResponse<T = undefined> {
  ok: boolean;
  data?: T;
  error?: string;
}

export interface TimerStateResponse {
  timer: TimerDisplayState;
  notice: TimerCompletionNotice | null;
}
