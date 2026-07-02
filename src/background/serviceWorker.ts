import { createClient } from "@supabase/supabase-js";
import { getTimerSnapshot } from "../lib/stats";
import { isHexColor, isRecord, isTrimmedString, isUuid } from "../lib/validation";
import type {
  ServiceWorkerResponse,
  SessionDraft,
  TimerCompletionNotice,
  TimerDisplayState,
  TimerStopResponse,
  TimerStartPayload,
  TimerState,
  TimerStateResponse,
} from "../types";

const TIMER_STATE_KEY = "status-window-timer-state";
const TIMER_NOTICE_KEY = "status-window-timer-notice";
const TIMER_FINISH_ALARM = "status-window-timer-finish-alarm";
const TIMER_AUTO_STOP_ALARM = "status-window-timer-auto-stop-alarm";
const offscreenChrome = globalThis.chrome;
const manifestBackground = offscreenChrome?.runtime?.getManifest?.().background;
const backgroundWorkerPath =
  manifestBackground && "service_worker" in manifestBackground ? manifestBackground.service_worker : undefined;
const distPrefix = backgroundWorkerPath?.startsWith("dist/") ? "dist/" : "";
const OFFSCREEN_PATH = `${distPrefix}offscreen.html`;
const SIDEPANEL_PATH = `${distPrefix}sidepanel.html`;
const MAX_TIMER_DURATION_MS = 6 * 60 * 60 * 1000;
const MAX_COMPLETION_ALERT_MS = 10 * 60 * 1000;
const extensionPagePrefix = offscreenChrome.runtime.getURL("");
const timerStorageArea = offscreenChrome.storage.session ?? offscreenChrome.storage.local;

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
  completedAtMs: null,
  savedAtCompletion: false,
  userId: null,
  authAccessToken: null,
  authRefreshToken: null,
});

const getTimerState = async (): Promise<TimerState> => {
  const result = await timerStorageArea.get(TIMER_STATE_KEY);
  return (result[TIMER_STATE_KEY] as TimerState | undefined) ?? emptyTimerState();
};

const setTimerState = async (state: TimerState) => {
  await timerStorageArea.set({ [TIMER_STATE_KEY]: state });
};

const clearTimerState = async () => {
  await timerStorageArea.set({ [TIMER_STATE_KEY]: emptyTimerState() });
};

const getTimerNotice = async (): Promise<TimerCompletionNotice | null> => {
  const result = await timerStorageArea.get(TIMER_NOTICE_KEY);
  return (result[TIMER_NOTICE_KEY] as TimerCompletionNotice | undefined) ?? null;
};

const setTimerNotice = async (notice: TimerCompletionNotice | null) => {
  if (notice) {
    await timerStorageArea.set({ [TIMER_NOTICE_KEY]: notice });
    return;
  }

  await timerStorageArea.remove(TIMER_NOTICE_KEY);
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
      type: "offscreen/start-completion-audio",
      payload: { sound: "completion", volume },
    });
  } catch {
    // Audio is best-effort. A failed sound should not block session saving.
  }
};

const stopCompletionSound = async () => {
  try {
    await ensureOffscreenDocument();
    offscreenChrome.runtime.sendMessage({
      type: "offscreen/stop-completion-audio",
    });
  } catch {
    // Audio stop is best-effort.
  }
};

const scheduleTimerFinishAlarm = async (state: TimerState) => {
  if (!state.active || !state.targetDurationMs || state.paused || state.completedAtMs) {
    await offscreenChrome.alarms.clear(TIMER_FINISH_ALARM);
    return;
  }

  const elapsedMs = getTimerSnapshot(state).elapsedMs;
  const remainingMs = Math.max(state.targetDurationMs - elapsedMs, 0);

  await offscreenChrome.alarms.create(TIMER_FINISH_ALARM, {
    when: Date.now() + remainingMs,
  });
};

const scheduleCompletionAutoStopAlarm = async (state: TimerState) => {
  if (!state.active || !state.completedAtMs) {
    await offscreenChrome.alarms.clear(TIMER_AUTO_STOP_ALARM);
    return;
  }

  await offscreenChrome.alarms.create(TIMER_AUTO_STOP_ALARM, {
    when: state.completedAtMs + MAX_COMPLETION_ALERT_MS,
  });
};

const dismissTimerState = async (state: TimerState): Promise<TimerStopResponse> => {
  const displayState = getDisplayState(state);
  const durationSeconds = Math.max(0, Math.round(displayState.elapsedMs / 1000));
  const draft = timerStateToDraft(state, displayState.elapsedMs);

  await Promise.all([
    offscreenChrome.alarms.clear(TIMER_FINISH_ALARM),
    offscreenChrome.alarms.clear(TIMER_AUTO_STOP_ALARM),
    stopCompletionSound(),
  ]);
  await clearTimerState();

  return {
    draft,
    durationSeconds,
    savedInBackground: state.savedAtCompletion,
  };
};

const completeTimerState = async (state: TimerState) => {
  const displayState = getDisplayState(state);
  const durationSeconds = Math.max(0, Math.round(displayState.elapsedMs / 1000));
  const draft = timerStateToDraft(state, displayState.elapsedMs);
  let savedInBackground = false;

  if (durationSeconds > 0) {
    let notice: TimerCompletionNotice;
    try {
      await saveDraftToSupabase(state, draft);
      savedInBackground = true;
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

  const completedState: TimerState = {
    ...state,
    paused: true,
    accumulatedMs: displayState.elapsedMs,
    lastResumedAtMs: null,
    completedAtMs: Date.now(),
    savedAtCompletion: savedInBackground,
  };

  await offscreenChrome.alarms.clear(TIMER_FINISH_ALARM);
  await setTimerState(completedState);
  await scheduleCompletionAutoStopAlarm(completedState);

  return { draft, durationSeconds, savedInBackground };
};

const toResponse = <T>(data: T): ServiceWorkerResponse<T> => ({ ok: true, data });
const toError = (error: unknown): ServiceWorkerResponse => ({
  ok: false,
  error: error instanceof Error ? error.message : "Something went wrong.",
});

type RuntimeTimerMessage =
  | { type: "timer/get-state" }
  | { type: "timer/start"; payload: TimerStartPayload }
  | { type: "timer/pause" }
  | { type: "timer/resume" }
  | { type: "timer/stop" }
  | { type: "timer/acknowledge-notice"; payload: { noticeId: string } };

const isTrustedExtensionSender = (sender: chrome.runtime.MessageSender) =>
  sender.id === offscreenChrome.runtime.id &&
  (typeof sender.url !== "string" || sender.url.startsWith(extensionPagePrefix));

const isTimerStartPayload = (payload: unknown): payload is TimerStartPayload => {
  if (!isRecord(payload)) {
    return false;
  }

  const targetDurationMs = payload.targetDurationMs;

  return (
    (payload.mode === "stopwatch" || payload.mode === "timer") &&
    isUuid(payload.subjectId) &&
    isTrimmedString(payload.subjectName, 80) &&
    (payload.subjectColor === null || isHexColor(payload.subjectColor)) &&
    isUuid(payload.userId) &&
    isTrimmedString(payload.authAccessToken, 4096) &&
    isTrimmedString(payload.authRefreshToken, 4096) &&
    ((payload.mode === "stopwatch" && targetDurationMs === null) ||
      (payload.mode === "timer" &&
        typeof targetDurationMs === "number" &&
        Number.isFinite(targetDurationMs) &&
        targetDurationMs > 0 &&
        targetDurationMs <= MAX_TIMER_DURATION_MS))
  );
};

const parseRuntimeMessage = (message: unknown): RuntimeTimerMessage | null => {
  if (!isRecord(message) || typeof message.type !== "string") {
    return null;
  }

  switch (message.type) {
    case "timer/get-state":
    case "timer/pause":
    case "timer/resume":
    case "timer/stop":
      return { type: message.type };
    case "timer/start":
      return isTimerStartPayload(message.payload) ? { type: "timer/start", payload: message.payload } : null;
    case "timer/acknowledge-notice":
      return isRecord(message.payload) && typeof message.payload.noticeId === "string"
        ? { type: "timer/acknowledge-notice", payload: { noticeId: message.payload.noticeId } }
        : null;
    default:
      return null;
  }
};

offscreenChrome.runtime.onInstalled.addListener(async () => {
  await setTimerState(emptyTimerState());
  await setTimerNotice(null);
  if (offscreenChrome.sidePanel) {
    await offscreenChrome.sidePanel.setOptions({
      enabled: false,
      path: SIDEPANEL_PATH,
    });
  }
});

offscreenChrome.runtime.onMessage.addListener((rawMessage, sender, sendResponse) => {
  if (!isTrustedExtensionSender(sender)) {
    sendResponse(toError(new Error("Rejected message from an untrusted sender.")));
    return false;
  }

  const message = parseRuntimeMessage(rawMessage);
  if (!message) {
    sendResponse(toError(new Error("Rejected malformed extension message.")));
    return false;
  }

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

        const payload = message.payload;
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
          targetDurationMs: payload.mode === "stopwatch" ? 6 * 60 * 60 * 1000 : payload.targetDurationMs,
          paused: false,
          completedAtMs: null,
          savedAtCompletion: false,
          userId: payload.userId,
          authAccessToken: payload.authAccessToken,
          authRefreshToken: payload.authRefreshToken,
        };

        await Promise.all([
          offscreenChrome.alarms.clear(TIMER_AUTO_STOP_ALARM),
          setTimerNotice(null),
          stopCompletionSound(),
        ]);
        await setTimerState(nextState);
        await scheduleTimerFinishAlarm(nextState);
        sendResponse(toResponse(getDisplayState(nextState)));
        return;
      }
      case "timer/pause": {
        const state = await getTimerState();
        if (!state.active || state.paused || !state.lastResumedAtMs || state.completedAtMs) {
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
        await offscreenChrome.alarms.clear(TIMER_FINISH_ALARM);
        sendResponse(toResponse(getDisplayState(pausedState)));
        return;
      }
      case "timer/resume": {
        const state = await getTimerState();
        if (state.completedAtMs) {
          sendResponse(toError(new Error("This timer is finished. Press stop to close it.")));
          return;
        }

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
        await scheduleTimerFinishAlarm(resumedState);
        sendResponse(toResponse(getDisplayState(resumedState)));
        return;
      }
      case "timer/stop": {
        const state = await getTimerState();
        if (!state.active) {
          sendResponse(toError(new Error("No timer is currently running.")));
          return;
        }

        const finalized = await dismissTimerState(state);
        sendResponse(toResponse<TimerStopResponse>(finalized));
        return;
      }
      case "timer/acknowledge-notice": {
        const notice = await getTimerNotice();
        if (notice && notice.id === message.payload.noticeId) {
          await Promise.all([
            setTimerNotice(null),
            stopCompletionSound(),
          ]);
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
  const state = await getTimerState();
  if (!state.active) {
    return;
  }

  if (alarm.name === TIMER_FINISH_ALARM) {
    const displayState = getDisplayState(state);
    const reachedStopwatchLimit =
      state.mode === "stopwatch" &&
      state.targetDurationMs !== null &&
      displayState.elapsedMs >= state.targetDurationMs;
    const reachedTimerLimit = state.mode === "timer" && displayState.remainingMs === 0;

    if ((!reachedTimerLimit && !reachedStopwatchLimit) || state.completedAtMs) {
      await scheduleTimerFinishAlarm(state);
      return;
    }

    const completed = await completeTimerState(state);

    const result = await offscreenChrome.storage.local.get("status-window-settings");
    const cachedSettings = result["status-window-settings"] as
      | {
          volume?: number;
          timer_sound_enabled?: boolean;
        }
      | undefined;
    const volume = typeof cachedSettings?.volume === "number" ? cachedSettings.volume : 0.5;
    const timerSoundEnabled = cachedSettings?.timer_sound_enabled ?? true;
    if (state.mode === "timer" && timerSoundEnabled && completed.durationSeconds > 0) {
      await playCompletionSound(volume);
    }
    return;
  }

  if (alarm.name === TIMER_AUTO_STOP_ALARM) {
    if (!state.completedAtMs) {
      await offscreenChrome.alarms.clear(TIMER_AUTO_STOP_ALARM);
      return;
    }

    if (Date.now() < state.completedAtMs + MAX_COMPLETION_ALERT_MS) {
      await scheduleCompletionAutoStopAlarm(state);
      return;
    }

    await dismissTimerState(state);
  }
});
