import { clampUnitInterval, isRecord } from "../lib/validation";

const offscreenChrome = globalThis.chrome;

const isTrustedExtensionSender = (sender: chrome.runtime.MessageSender) =>
  sender.id === offscreenChrome.runtime.id;

const isPlayAudioMessage = (
  message: unknown,
): message is
  | { type: "offscreen/start-completion-audio"; payload?: { sound?: string; volume?: number } }
  | { type: "offscreen/stop-completion-audio" } =>
  isRecord(message) &&
  (message.type === "offscreen/start-completion-audio" || message.type === "offscreen/stop-completion-audio");

let completionAudioContext: AudioContext | null = null;
let completionAlarmIntervalId: number | null = null;

const stopCuteAlarm = () => {
  if (completionAlarmIntervalId !== null) {
    window.clearInterval(completionAlarmIntervalId);
    completionAlarmIntervalId = null;
  }
};

const getAudioContext = async () => {
  if (typeof AudioContext === "undefined") {
    return null;
  }

  if (!completionAudioContext) {
    completionAudioContext = new AudioContext();
  }

  if (completionAudioContext.state === "suspended") {
    await completionAudioContext.resume();
  }

  return completionAudioContext;
};

const playChimeNote = (
  context: AudioContext,
  startTime: number,
  frequency: number,
  volume: number,
  durationSeconds: number,
) => {
  const oscillator = context.createOscillator();
  const shimmerOscillator = context.createOscillator();
  const gainNode = context.createGain();

  oscillator.type = "triangle";
  oscillator.frequency.setValueAtTime(frequency, startTime);
  oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.015, startTime + durationSeconds);

  shimmerOscillator.type = "sine";
  shimmerOscillator.frequency.setValueAtTime(frequency * 2, startTime);

  gainNode.gain.setValueAtTime(0.0001, startTime);
  gainNode.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), startTime + 0.02);
  gainNode.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume * 0.22), startTime + durationSeconds * 0.55);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + durationSeconds);

  oscillator.connect(gainNode);
  shimmerOscillator.connect(gainNode);
  gainNode.connect(context.destination);

  oscillator.start(startTime);
  shimmerOscillator.start(startTime);
  oscillator.stop(startTime + durationSeconds);
  shimmerOscillator.stop(startTime + durationSeconds);
};

const scheduleCuteAlarmPattern = (context: AudioContext, requestedVolume: number) => {
  const volume = clampUnitInterval(requestedVolume, 0.5) * 0.16;
  const startTime = context.currentTime + 0.02;
  const pattern = [
    { offset: 0, frequency: 659.25, durationSeconds: 0.26 },
    { offset: 0.18, frequency: 830.61, durationSeconds: 0.24 },
    { offset: 0.38, frequency: 987.77, durationSeconds: 0.34 },
  ];

  pattern.forEach(({ offset, frequency, durationSeconds }) => {
    playChimeNote(context, startTime + offset, frequency, volume, durationSeconds);
  });
};

const startCuteAlarm = async (requestedVolume: number) => {
  stopCuteAlarm();

  const context = await getAudioContext();
  if (!context) {
    return;
  }

  scheduleCuteAlarmPattern(context, requestedVolume);
  completionAlarmIntervalId = window.setInterval(() => {
    scheduleCuteAlarmPattern(context, requestedVolume);
  }, 1800);
};

offscreenChrome.runtime.onMessage.addListener((message, sender) => {
  if (!isTrustedExtensionSender(sender) || !isPlayAudioMessage(message)) {
    return;
  }

  if (message.type === "offscreen/stop-completion-audio") {
    stopCuteAlarm();
    return;
  }

  if (message.payload?.sound !== "completion") {
    return;
  }

  void startCuteAlarm(message.payload?.volume ?? 0.5).catch(() => undefined);
});
