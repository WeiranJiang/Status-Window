import { resolveExtensionAsset } from "../lib/chrome";

globalThis.chrome.runtime.onMessage.addListener((message) => {
  if (message.type !== "offscreen/play-audio") {
    return;
  }

  const audio = new Audio(resolveExtensionAsset("sounds/completion.wav"));
  audio.volume = Number(message.payload?.volume ?? 0.5);
  void audio.play().catch(() => undefined);
});
