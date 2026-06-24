import type {
  SessionDraft,
  ServiceWorkerResponse,
  TimerCompletionNotice,
  TimerDisplayState,
  TimerStartPayload,
  TimerStateResponse,
} from "../types";

const extensionChrome = globalThis.chrome;
const manifestBackground = extensionChrome?.runtime?.getManifest?.().background;
const backgroundWorkerPath =
  manifestBackground && "service_worker" in manifestBackground ? manifestBackground.service_worker : undefined;
const distPrefix = backgroundWorkerPath?.startsWith("dist/") ? "dist/" : "";

const withDistPrefix = (path: string) => `${distPrefix}${path.replace(/^\//, "")}`;

export const hasChromeRuntime = Boolean(extensionChrome?.runtime?.id);
export const hasChromeIdentity = Boolean(extensionChrome?.identity?.launchWebAuthFlow);
export const hasChromeSidePanel = Boolean(extensionChrome?.sidePanel);

export const sendRuntimeMessage = async <TResponse>(
  message: Record<string, unknown>,
): Promise<TResponse> => {
  if (!extensionChrome?.runtime?.sendMessage) {
    throw new Error("Chrome runtime messaging is unavailable in this environment.");
  }

  return new Promise<TResponse>((resolve, reject) => {
    extensionChrome.runtime.sendMessage(message, (response: TResponse) => {
      const lastError = extensionChrome.runtime.lastError;
      if (lastError) {
        reject(new Error(lastError.message));
        return;
      }

      resolve(response);
    });
  });
};

export const getExtensionRedirectUrl = () => extensionChrome?.identity?.getRedirectURL();

export const openGoogleOAuthWindow = async (url: string) => {
  if (!extensionChrome?.identity?.launchWebAuthFlow) {
    throw new Error("Google auth in extension mode is not available.");
  }

  return new Promise<string>((resolve, reject) => {
    extensionChrome.identity.launchWebAuthFlow({ url, interactive: true }, (redirectedTo) => {
      const lastError = extensionChrome.runtime?.lastError;
      if (lastError) {
        reject(new Error(lastError.message));
        return;
      }

      if (!redirectedTo) {
        reject(new Error("Google login did not return a redirect URL."));
        return;
      }

      resolve(redirectedTo);
    });
  });
};

export const getTimerState = async () =>
  sendRuntimeMessage<ServiceWorkerResponse<TimerStateResponse>>({ type: "timer/get-state" });

export const startTimer = async (payload: TimerStartPayload) =>
  sendRuntimeMessage<ServiceWorkerResponse<TimerDisplayState>>({ type: "timer/start", payload });

export const pauseTimer = async () =>
  sendRuntimeMessage<ServiceWorkerResponse<TimerDisplayState>>({ type: "timer/pause" });

export const resumeTimer = async () =>
  sendRuntimeMessage<ServiceWorkerResponse<TimerDisplayState>>({ type: "timer/resume" });

export const stopTimer = async () =>
  sendRuntimeMessage<ServiceWorkerResponse<{ durationSeconds: number; draft: SessionDraft }>>({
    type: "timer/stop",
  });

export const acknowledgeTimerNotice = async (noticeId: string) =>
  sendRuntimeMessage<ServiceWorkerResponse<TimerCompletionNotice | null>>({
    type: "timer/acknowledge-notice",
    payload: { noticeId },
  });

export const setFloatingMode = async (enabled: boolean) => {
  if (!extensionChrome?.sidePanel) {
    return;
  }

  await extensionChrome.sidePanel.setOptions({
    enabled,
    path: withDistPrefix("sidepanel.html"),
  });

  if (enabled && extensionChrome.windows?.getCurrent) {
    const currentWindow = await extensionChrome.windows.getCurrent();
    if (currentWindow.id) {
      await extensionChrome.sidePanel.open({ windowId: currentWindow.id });
    }
  }
};

export const resolveExtensionAsset = (path: string) =>
  extensionChrome?.runtime?.getURL ? extensionChrome.runtime.getURL(withDistPrefix(path)) : path;
