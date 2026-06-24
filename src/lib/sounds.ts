import { resolveExtensionAsset } from "./chrome";
import type { UserSettings, SoundType } from "../types";

const soundFiles: Record<SoundType, string> = {
  button: "sounds/button.wav",
  tab: "sounds/tab.wav",
  completion: "sounds/completion.wav",
};

const audioCache = new Map<string, HTMLAudioElement>();

const isEnabled = (settings: UserSettings, sound: SoundType) => {
  if (sound === "button") {
    return settings.button_sounds_enabled;
  }
  if (sound === "tab") {
    return settings.tab_sounds_enabled;
  }
  return settings.timer_sound_enabled;
};

export const playSound = async (sound: SoundType, settings: UserSettings) => {
  if (typeof Audio === "undefined" || !isEnabled(settings, sound)) {
    return;
  }

  const src = resolveExtensionAsset(soundFiles[sound]);
  const audio = audioCache.get(src) ?? new Audio(src);
  audioCache.set(src, audio);
  audio.volume = Math.min(1, Math.max(0, settings.volume));
  audio.currentTime = 0;

  try {
    await audio.play();
  } catch {
    // Browsers can block autoplay for non-user-initiated audio. Failing silently keeps the UI smooth.
  }
};
