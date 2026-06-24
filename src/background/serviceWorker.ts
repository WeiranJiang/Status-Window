import { createClient } from "@supabase/supabase-js";
import { getTimerSnapshot } from "../lib/stats";
import type {
  ServiceWorkerResponse,
  SessionDraft,
  TimerCompletionNotice,
  TimerDisplayState,
  TimerStartPayload,
  TimerState,
  TimerStateResponse,
} from "../types";

const TIMER_STATE_KEY = "status-window-timer-state";
const TIMER_NOTICE_KEY = "status-window-timer-notice";
const TIMER_ALARM = "status-window-timer-alarm";
const OFFSCREEN_PATH = "offscreen.html";
const offscreenChrome = globalThis.chrome;

const emptyTimerState = (): TimerState => ({
  active: false,
  mode: null,
  subjectId: null,
  subjectName: null,
  subjectColor: null,
  startedAtMs: null,
  lastResumedAtMs: null,
  accumulatedMs: 0,
  targetDurationMs: null,
  paused: false,
  userId: null,
  authAccessToken: null,
  authRefreshToken: null,
});

const getTimerState = async (): Promise<TimerState> => {
  const result = await offscreenChrome.storage.local.get(TIMER_STATE_KEY);
  return (result[TIMER_STATE_KEY] as TimerState | undefined) ?? emptyTimerState();
};

const setTimerState = async (state: TimerState) => {
  await offscreenChrome.storage.local.set({ [TIMER_STATE_KEY]: state });
};

const clearTimerState = async () => {
  await offscreenChrome.storage.local.set({ [TIMER_STATE_KEY]: emptyTimerState() });
};

const getTimerNotice = async (): Promise<TimerCompletionNotice | null> => {
  const result = await offscreenChrome.storage.local.get(TIMER_NOTICE_KEY);
  return (result[TIMER_NOTICE_KEY] as TimerCompletionNotice | undefined) ?? null;
};

const setTimerNotice = async (notice: TimerCompletionNotice | null) => {
  if (notice) {
    await offscreenChrome.storage.local.set({ [TIMER_NOTICE_KEY]: notice });
    return;
  }

  await offscreenChrome.storage.local.remove(TIMER_NOTICE_KEY);
};

const getDisplayState = (state: TimerState): TimerDisplayState => ({
  ...state,
  ...getTimerSnapshot(state),
});

const timerStateToDraft = (state: TimerState, elapsedMs: number): SessionDraft => {
  const durationSeconds = Math.max(0, Math.round(elapsedMs / 1000));
  const startTime = new Date(state.startedAtMs ?? Date.now() - elapsedMs).toISOString();
  const endTime = new Date((state.startedAtMs ?? Date.now()) + elapsedMs).toISOString();

  return {
    user_id: state.userId ?? "",
    subject_id: state.subjectId ?? "",
    mode: state.mode ?? "stopwatch",
    start_time: startTime,
    end_time: endTime,
    duration_seconds: durationSeconds,
  };
};

const createSupabaseServiceClient = async (state: TimerState) => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase environment variables are missing.");
  }

  if (!state.authAccessToken || !state.authRefreshToken) {
    throw new Error("Missing auth session for background save.");
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  await supabase.auth.setSession({
    access_token: state.authAccessToken,
    refresh_token: state.authRefreshToken,
  });

  return supabase;
};

const saveDraftToSupabase = async (state: TimerState, draft: SessionDraft) => {
  const supabase = await createSupabaseServiceClient(state);
  const { error } = await supabase.from("study_sessions").insert(draft);
  if (error) {
    throw error;
  }
};

const ensureOffscreenDocument = async () => {
  if (!offscreenChrome.offscreen) {
    return;
  }

  const existingContexts = await offscreenChrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
    documentUrls: [offscreenChrome.runtime.getURL(OFFSCREEN_PATH)],
  });

  if (existingContexts.length > 0) {
    return;
  }

  await offscreenChrome.offscreen.createDocument({
    url: OFFSCREEN_PATH,
    reasons: [offscreenChrome.offscreen.Reason.AUDIO_PLAYBACK],
    justification: "Play timer completion audio when the popup is closed.",
  });
};

const playCompletionSound = async (volume: number) => {
  try {
    await ensureOffscreenDocument();
    offscreenChrome.runtime.sendMessage({
      type: "offscreen/play-audio",
      payload: { sound: "completion", volume },
    });
  } catch {
    // Audio is best-effort. A failed sound should not block session saving.
  }
};

const scheduleTimerAlarm = async (state: TimerState) => {
  if (!state.active || state.mode !== "timer" || !state.targetDurationMs || state.paused) {
    await offscreenChrome.alarms.clear(TIMER_ALARM);
    return;
  }

  const elapsedMs = getTimerSnapshot(state).elapsedMs;
  const remainingMs = Math.max(state.targetDurationMs - elapsedMs, 0);

  await offscreenChrome.alarms.create(TIMER_ALARM, {
    when: Date.now() + remainingMs,
  });
};

const finalizeTimerState = async (state: TimerState, saveInBackground: boolean) => {
  const displayState = getDisplayState(state);
  const durationSeconds = Math.max(0, Math.round(displayState.elapsedMs / 1000));
  const draft = timerStateToDraft(state, displayState.elapsedMs);

  await offscreenChrome.alarms.clear(TIMER_ALARM);
  await clearTimerState();

  if (saveInBackground && durationSeconds > 0) {
    let notice: TimerCompletionNotice;

    try {
      await saveDraftToSupabase(state, draft);
      notice = {
        id: crypto.randomUUID(),
        subjectName: state.subjectName ?? "Session",
        durationSeconds,
        saved: true,
      };
    } catch (error) {
      notice = {
        id: crypto.randomUUID(),
        subjectName: state.subjectName ?? "Session",
        durationSeconds,
        saved: false,
        errorMessage: error instanceof Error ? error.message : "Unable to save session automatically.",
      };
    }

    await setTimerNotice(notice);
  }

  return { draft, durationSeconds };
};

const toResponse = <T>(data: T): ServiceWorkerResponse<T> => ({ ok: true, data });
const toError = (error: unknown): ServiceWorkerResponse => ({
  ok: false,
  error: error instanceof Error ? error.message : "Something went wrong.",
});

offscreenChrome.runtime.onInstalled.addListener(async () => {
  await setTimerState(emptyTimerState());
  if (offscreenChrome.sidePanel) {
    await offscreenChrome.sidePanel.setOptions({
      enabled: false,
      path: "sidepanel.html",
    });
  }
});

offscreenChrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const handle = async () => {
    switch (message.type) {
      case "timer/get-state": {
        const [timer, notice] = await Promise.all([getTimerState(), getTimerNotice()]);
        sendResponse(toResponse<TimerStateResponse>({ timer: getDisplayState(timer), notice }));
        return;
      }
      case "timer/start": {
        const current = await getTimerState();
        if (current.active) {
          sendResponse(toError(new Error("A timer is already running.")));
          return;
        }

        const payload = message.payload as TimerStartPayload;
        const now = Date.now();
        const nextState: TimerState = {
          active: true,
          mode: payload.mode,
          subjectId: payload.subjectId,
          subjectName: payload.subjectName,
          subjectColor: payload.subjectColor,
          startedAtMs: now,
          lastResumedAtMs: now,
          accumulatedMs: 0,
          targetDurationMs: payload.targetDurationMs,
          paused: false,
          userId: payload.userId,
          authAccessToken: payload.authAccessToken,
          authRefreshToken: payload.authRefreshToken,
        };

        await setTimerState(nextState);
        await scheduleTimerAlarm(nextState);
        sendResponse(toResponse(getDisplayState(nextState)));
        return;
      }
      case "timer/pause": {
        const state = await getTimerState();
        if (!state.active || state.paused || !state.lastResumedAtMs) {
          sendResponse(toError(new Error("No active timer is available to pause.")));
          return;
        }

        const elapsedSinceResume = Date.now() - state.lastResumedAtMs;
        const pausedState: TimerState = {
          ...state,
          paused: true,
          accumulatedMs: state.accumulatedMs + elapsedSinceResume,
          lastResumedAtMs: null,
        };

        await setTimerState(pausedState);
        await offscreenChrome.alarms.clear(TIMER_ALARM);
        sendResponse(toResponse(getDisplayState(pausedState)));
        return;
      }
      case "timer/resume": {
        const state = await getTimerState();
        if (!state.active || !state.paused) {
          sendResponse(toError(new Error("No paused timer is available to resume.")));
          return;
        }

        const resumedState: TimerState = {
          ...state,
          paused: false,
          lastResumedAtMs: Date.now(),
        };

        await setTimerState(resumedState);
        await scheduleTimerAlarm(resumedState);
        sendResponse(toResponse(getDisplayState(resumedState)));
        return;
      }
      case "timer/stop": {
        const state = await getTimerState();
        if (!state.active) {
          sendResponse(toError(new Error("No timer is currently running.")));
          return;
        }

        const finalized = await finalizeTimerState(state, false);
        sendResponse(toResponse(finalized));
        return;
      }
      case "timer/acknowledge-notice": {
        const notice = await getTimerNotice();
        if (notice && notice.id === message.payload?.noticeId) {
          await setTimerNotice(null);
        }

        sendResponse(toResponse(null));
        return;
      }
      default:
        return;
    }
  };

  void handle().catch((error) => sendResponse(toError(error)));
  return true;
});

offscreenChrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== TIMER_ALARM) {
    return;
  }

  const state = await getTimerState();
  if (!state.active || state.mode !== "timer") {
    return;
  }

  const displayState = getDisplayState(state);
  if (displayState.remainingMs !== 0) {
    await scheduleTimerAlarm(state);
    return;
  }

  await finalizeTimerState(state, true);

  const result = await offscreenChrome.storage.local.get("status-window-settings");
  const cachedSettings = result["status-window-settings"] as
    | {
        volume?: number;
        timer_sound_enabled?: boolean;
      }
    | undefined;
  const volume = typeof cachedSettings?.volume === "number" ? cachedSettings.volume : 0.5;
  const timerSoundEnabled = cachedSettings?.timer_sound_enabled ?? true;
  if (timerSoundEnabled) {
    await playCompletionSound(volume);
  }
});
