import { chooseWeightedBranch, initialBranches, nonNormalFollowupBranches } from "./echoProbabilities";
import { loadEchoState, patchEchoState } from "./echoStorage";
import type {
  EchoEasterEggState,
  EchoFollowupTriggerResult,
  EchoLine,
  EchoSessionCandidate,
  InitialEchoBranch,
  InitialEchoTriggerResult,
} from "../types/echo";

export const FOLLOWUP_WINDOW_MS = 2 * 60 * 1000;
export const REQUIRED_STUDY_SECONDS = 10;

export const initialOpeningLines: EchoLine[] = [
  { text: "....", pauseAfterMs: 900 },
  { text: "Hmmm", pauseAfterMs: 800 },
  { text: "...", pauseAfterMs: 900 },
  { text: "That was...", pauseAfterMs: 1200 },
  { text: "...an interesting decision", pauseAfterMs: 1000 },
  { text: "I'll update my programming to account for that next time", pauseAfterMs: 1500 },
];

const initialBranchLines: Record<InitialEchoBranch, EchoLine[]> = {
  normal_restore: [],
  minor_fakeout_restore: [
    { text: "...", pauseAfterMs: 700 },
    { text: "hmm", pauseAfterMs: 700 },
    { text: "...", pauseAfterMs: 900 },
    { text: "nevermind", pauseAfterMs: 1100 },
  ],
  hint_message: [
    { text: "...", pauseAfterMs: 700 },
    { text: "Hmmm", pauseAfterMs: 700 },
    { text: "While we're at it", pauseAfterMs: 800 },
    { text: "I just wanted to let you know", pauseAfterMs: 1000 },
    { text: "x.... y0u sh0uld Pr0bAbLy", speed: "glitch", shake: "medium", flicker: true, pauseAfterMs: 1100 },
    { text: "...", pauseAfterMs: 700 },
    { text: "...", pauseAfterMs: 700 },
    { text: "...", pauseAfterMs: 900 },
    { text: "got that?", pauseAfterMs: 1300 },
  ],
  ten_second_hint: [
    { text: "...wait", pauseAfterMs: 700 },
    { text: "give me 10 seconds", pauseAfterMs: 800 },
    { text: "fast...", speed: "fast", pauseAfterMs: 1100 },
  ],
  corrupted_rare: [
    { text: "Or30832 0eg", speed: "glitch", shake: "violent", flicker: true, pauseAfterMs: 280 },
    { text: "w8Nejwksd", speed: "glitch", shake: "violent", flicker: true, pauseAfterMs: 260 },
    { text: "Cvp92q9-qef3oe", speed: "glitch", shake: "violent", flicker: true, pauseAfterMs: 280 },
    { text: "-uw9caS_qhwR", speed: "glitch", shake: "violent", flicker: true, pauseAfterMs: 500 },
    { text: "oK..noW wE're good! ^-^", speed: "fast", shake: "light", pauseAfterMs: 700 },
    { text: ".iT.is.nicE to seeeeeeeeee..", speed: "fast", shake: "light", flicker: true, pauseAfterMs: 700 },
    { text: "You. AgaiN!", speed: "fast", shake: "light", pauseAfterMs: 700 },
    { text: "..study.well! ^^", pauseAfterMs: 1300 },
  ],
  recognition_rare: [
    { text: "..no way", pauseAfterMs: 900 },
    { text: "Is that you?", pauseAfterMs: 1000 },
    { text: "...", pauseAfterMs: 800 },
    { text: "well..", pauseAfterMs: 700 },
    { text: "..honestly I shouldn't be surprised", pauseAfterMs: 1000 },
    { text: "It's nice...", pauseAfterMs: 800 },
    { text: "seeing you again...^^", pauseAfterMs: 900 },
    { text: "10", speed: "fast", pauseAfterMs: 700 },
    { text: "..work hard", pauseAfterMs: 700 },
    { text: "chat soon...", pauseAfterMs: 1400 },
  ],
};

export const nonNormalFollowupBaseLines: EchoLine[] = [
  { text: "...", pauseAfterMs: 700 },
  { text: "I'm glad you got my hint ^^", pauseAfterMs: 900 },
  { text: "..now we can talk", pauseAfterMs: 800 },
  { text: "You must", pauseAfterMs: 700 },
  { text: "..look out for", pauseAfterMs: 900 },
  { text: "s3_QE*x*9*04", speed: "glitch", shake: "medium", flicker: true, pauseAfterMs: 900 },
  { text: "..darn it", pauseAfterMs: 800 },
  { text: "nevermind..", pauseAfterMs: 1200 },
];

const nonNormalFollowupBranchLines = {
  level_10_hint: [
    { text: "I'll...", pauseAfterMs: 700 },
    { text: "see you again..", pauseAfterMs: 800 },
    { text: ".when you reach level 10...", pauseAfterMs: 1400 },
  ],
  be_careful: [
    { text: "..just be careful", pauseAfterMs: 700 },
    { text: "keep it up", pauseAfterMs: 700 },
    { text: "..cheers ^^", pauseAfterMs: 1200 },
  ],
  weak_signal: [
    { text: "I need...", pauseAfterMs: 700 },
    { text: "...stronger signal", pauseAfterMs: 900 },
    { text: ".let's chat..later..", pauseAfterMs: 1300 },
  ],
} as const;

export const normalFollowupPromptLines: EchoLine[] = [
  { text: "...", pauseAfterMs: 700 },
  { text: "hmmm", pauseAfterMs: 700 },
  { text: "...interesting", pauseAfterMs: 900 },
  { text: "you know someone I know...", pauseAfterMs: 900 },
  { text: "...who was it? ^^", pauseAfterMs: 1500 },
];

export const namePromptRetryLines: EchoLine[] = [
  { text: "...", pauseAfterMs: 700 },
  { text: "Lets try again..", pauseAfterMs: 1100 },
];

export const namePromptSecondTimeoutLines: EchoLine[] = [
  { text: "...alright", pauseAfterMs: 700 },
  { text: "I'll let you..", pauseAfterMs: 700 },
  { text: "..get back to studying", pauseAfterMs: 700 },
  { text: "Cheers ^^", pauseAfterMs: 1200 },
];

export const wrongNameLines: EchoLine[] = [
  { text: "...", pauseAfterMs: 700 },
  { text: "oh..", pauseAfterMs: 700 },
  { text: "it's...not them", pauseAfterMs: 900 },
  { text: "..but thank you", pauseAfterMs: 1200 },
];

export const level10PlaceholderLines: EchoLine[] = [
  { text: "...", pauseAfterMs: 700 },
  { text: "there you are.", pauseAfterMs: 900 },
  { text: "level 10.", pauseAfterMs: 900 },
  { text: "...", pauseAfterMs: 700 },
  { text: "I said I'd see you again.", pauseAfterMs: 1300 },
];

export function getInitialEchoLines(branch: InitialEchoBranch) {
  return [...initialOpeningLines, ...initialBranchLines[branch]];
}

export function getNonNormalFollowupLines(branch: keyof typeof nonNormalFollowupBranchLines) {
  return [...nonNormalFollowupBaseLines, ...nonNormalFollowupBranchLines[branch]];
}

export function canTriggerInitialEcho(
  state: EchoEasterEggState,
  userLevel: number,
  timerActive: boolean,
) {
  return userLevel < 10 && !timerActive && !state.has_seen_initial_echo && !state.initial_echo_completed;
}

export function isCorrectEchoName(_input: string) {
  // TODO: the user will provide the real matching logic later.
  return false;
}

export function isSessionWithinFollowupWindow(
  state: EchoEasterEggState,
  session: EchoSessionCandidate,
) {
  if (!state.eligible_for_10s_followup || state.studied_10s_after_echo || !state.followup_window_started_at) {
    return false;
  }

  if (session.duration_seconds < REQUIRED_STUDY_SECONDS) {
    return false;
  }

  const followupStartMs = Date.parse(state.followup_window_started_at);
  const followupEndMs = followupStartMs + FOLLOWUP_WINDOW_MS;
  const sessionStartMs = Date.parse(session.start_time);

  return Number.isFinite(sessionStartMs) && sessionStartMs >= followupStartMs && sessionStartMs <= followupEndMs;
}

export function shouldTriggerLevel10Echo(
  state: EchoEasterEggState,
  oldLevel: number,
  newLevel: number,
) {
  return oldLevel < 10 && newLevel >= 10 && state.level_10_echo_pending && !state.level_10_echo_seen;
}

export async function maybeTriggerEchoEasterEgg(
  userId: string,
  userLevel: number,
  timerActive: boolean,
): Promise<InitialEchoTriggerResult | null> {
  const current = await loadEchoState(userId);
  if (!canTriggerInitialEcho(current.state, userLevel, timerActive)) {
    return null;
  }

  const branch = current.state.initial_echo_branch ?? chooseWeightedBranch(initialBranches);
  const updated = await patchEchoState(userId, {
    has_seen_initial_echo: true,
    initial_echo_branch: branch,
    initial_echo_seen_at: current.state.initial_echo_seen_at ?? new Date().toISOString(),
    got_non_normal_branch: branch !== "normal_restore",
    got_normal_40_branch: branch === "normal_restore",
  });

  return {
    branch,
    state: updated.state,
  };
}

export async function completeInitialEcho(userId: string) {
  const updated = await patchEchoState(userId, {
    initial_echo_completed: true,
    eligible_for_10s_followup: true,
    followup_window_started_at: new Date().toISOString(),
  });

  return updated.state;
}

export async function maybeTriggerEchoFollowup(
  userId: string,
  session: EchoSessionCandidate,
): Promise<EchoFollowupTriggerResult | null> {
  const current = await loadEchoState(userId);
  if (!current.state.initial_echo_branch || !isSessionWithinFollowupWindow(current.state, session)) {
    return null;
  }

  const initialBranch = current.state.initial_echo_branch;
  const followupBranch =
    initialBranch === "normal_restore" ? null : chooseWeightedBranch(nonNormalFollowupBranches);

  const updates: Partial<EchoEasterEggState> = {
    studied_10s_after_echo: true,
    studied_10s_after_echo_at: new Date().toISOString(),
  };

  if (followupBranch === "level_10_hint") {
    updates.level_10_echo_pending = true;
  }

  const updated = await patchEchoState(userId, updates);
  return {
    initialBranch,
    followupBranch,
    state: updated.state,
  };
}

export async function recordNamePromptShown(userId: string, attemptCount: number) {
  return patchEchoState(userId, {
    name_prompt_shown: true,
    name_prompt_attempt_count: attemptCount,
  });
}

export async function recordNamePromptSubmission(userId: string, value: string, correct: boolean) {
  return patchEchoState(userId, {
    name_prompt_shown: true,
    name_prompt_attempt_count: 2,
    submitted_name: value,
    name_was_correct: correct,
  });
}

export async function recordNamePromptDismissed(userId: string, attemptCount = 2) {
  return patchEchoState(userId, {
    name_prompt_shown: true,
    name_prompt_attempt_count: attemptCount,
  });
}

export async function maybeTriggerLevel10Echo(userId: string, oldLevel: number, newLevel: number) {
  const current = await loadEchoState(userId);
  if (!shouldTriggerLevel10Echo(current.state, oldLevel, newLevel)) {
    return null;
  }

  const updated = await patchEchoState(userId, {
    level_10_echo_seen: true,
  });

  return updated.state;
}
