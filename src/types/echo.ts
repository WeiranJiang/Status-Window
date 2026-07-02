import type { StudySession } from "./index";

export type InitialEchoBranch =
  | "normal_restore"
  | "minor_fakeout_restore"
  | "hint_message"
  | "ten_second_hint"
  | "corrupted_rare"
  | "recognition_rare";

export type NonNormalFollowupBranch = "level_10_hint" | "be_careful" | "weak_signal";

export type EchoLineSpeed = "normal" | "fast" | "glitch";
export type EchoLineShake = "none" | "light" | "medium" | "violent";
export type EchoOverlayResult = "completed" | "skipped";

export interface EchoLine {
  text: string;
  speed?: EchoLineSpeed;
  pauseAfterMs?: number;
  shake?: EchoLineShake;
  flicker?: boolean;
}

export interface EchoEasterEggState {
  user_id: string;
  has_seen_initial_echo: boolean;
  initial_echo_branch: InitialEchoBranch | null;
  initial_echo_seen_at: string | null;
  initial_echo_completed: boolean;
  eligible_for_10s_followup: boolean;
  followup_window_started_at: string | null;
  studied_10s_after_echo: boolean;
  studied_10s_after_echo_at: string | null;
  got_non_normal_branch: boolean;
  got_normal_40_branch: boolean;
  name_prompt_shown: boolean;
  name_prompt_attempt_count: number;
  submitted_name: string | null;
  name_was_correct: boolean | null;
  level_10_echo_pending: boolean;
  level_10_echo_seen: boolean;
  created_at: string;
  updated_at: string;
}

export interface EchoStateRecord {
  state: EchoEasterEggState;
  source: "supabase" | "local";
}

export interface InitialEchoTriggerResult {
  branch: InitialEchoBranch;
  state: EchoEasterEggState;
}

export interface EchoFollowupTriggerResult {
  initialBranch: InitialEchoBranch;
  followupBranch: NonNormalFollowupBranch | null;
  state: EchoEasterEggState;
}

export interface EchoNamePromptResult {
  type: "submit" | "timeout" | "skipped";
  value?: string;
}

export interface EchoSessionCandidate {
  duration_seconds: StudySession["duration_seconds"];
  start_time: StudySession["start_time"];
  end_time: StudySession["end_time"];
}
