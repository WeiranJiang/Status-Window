import { resolveExtensionAsset } from "./chrome";
import type { UserSettings, SoundType } from "../types";

const soundFiles: Record<SoundType, string> = {
  completion: "sounds/completion.wav",
  button: "sounds/button.wav",
  tab: "sounds/tab.wav",
};

const audioCache = new Map<string, HTMLAudioElement>();
let audioContext: AudioContext | null = null;

const isEnabled = (settings: UserSettings, sound: SoundType) => {
  if (sound === "button") {
    return settings.button_sounds_enabled;
  }
  if (sound === "tab") {
    return settings.tab_sounds_enabled;
  }
  return settings.timer_sound_enabled;
};

const getAudioContext = async () => {
  if (typeof AudioContext === "undefined") {
    return null;
  }

  if (!audioContext) {
    audioContext = new AudioContext();
  }

  if (audioContext.state === "suspended") {
    await audioContext.resume();
  }

  return audioContext;
};

const synthesizeButtonSound = async (volume: number) => {
  const context = await getAudioContext();
  if (!context) {
    return;
  }

  const now = context.currentTime;
  const masterGain = context.createGain();
  masterGain.connect(context.destination);
  masterGain.gain.setValueAtTime(0.0001, now);
  masterGain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume * 0.22), now + 0.012);
  masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);

  [420, 620].forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency * 0.9, now);
    oscillator.frequency.exponentialRampToValueAtTime(frequency, now + 0.07);
    gainNode.gain.setValueAtTime(index === 0 ? 0.9 : 0.55, now);
    oscillator.connect(gainNode);
    gainNode.connect(masterGain);
    oscillator.start(now);
    oscillator.stop(now + 0.075);
  });
};

const synthesizeTabSound = async (volume: number) => {
  const context = await getAudioContext();
  if (!context) {
    return;
  }

  const now = context.currentTime;
  const masterGain = context.createGain();
  masterGain.connect(context.destination);
  masterGain.gain.setValueAtTime(0.0001, now);
  masterGain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume * 0.18), now + 0.004);
  masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);

  [900, 1200].forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();
    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(frequency, now);
    gainNode.gain.setValueAtTime(index === 0 ? 0.8 : 0.45, now);
    oscillator.connect(gainNode);
    gainNode.connect(masterGain);
    oscillator.start(now);
    oscillator.stop(now + 0.045);
  });
};

export const playSound = async (sound: SoundType, settings: UserSettings) => {
  if (!isEnabled(settings, sound)) {
    return;
  }

  const volume = Math.min(1, Math.max(0, settings.volume));

  if (sound === "button") {
    await synthesizeButtonSound(volume);
    return;
  }

  if (sound === "tab") {
    await synthesizeTabSound(volume);
    return;
  }

  if (typeof Audio === "undefined") {
    return;
  }

  const src = resolveExtensionAsset(soundFiles[sound]);
  const audio = audioCache.get(src) ?? new Audio(src);
  audioCache.set(src, audio);
  audio.volume = volume;
  audio.currentTime = 0;

  try {
    await audio.play();
  } catch {
    // Browsers can block autoplay for non-user-initiated audio. Failing silently keeps the UI smooth.
  }
};
