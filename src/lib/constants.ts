import type { ColorScheme, UserSettings } from "../types";

export const DEFAULT_SUBJECTS = [
  { name: "Math", color: "#7aa8ff" },
  { name: "Science", color: "#57c794" },
  { name: "Language", color: "#f6a36f" },
  { name: "History", color: "#d68de1" },
];

export const COLOR_SCHEMES: ColorScheme[] = [
  {
    id: "soft-blue",
    name: "Soft Blue",
    description: "Airy blue notes with bright paper.",
    surface: "#f8fbff",
    accent: "#8cb7ff",
    accentSoft: "#dce9ff",
    accentStrong: "#4878d8",
    shadow: "rgba(85, 112, 181, 0.18)",
    ink: "#25304d",
    page: "linear-gradient(180deg, #edf4ff 0%, #fff9f4 100%)",
    border: "#d9e6ff",
  },
  {
    id: "sakura-pink",
    name: "Sakura Pink",
    description: "A rosy notebook page with calm warmth.",
    surface: "#fff8fc",
    accent: "#f39ac4",
    accentSoft: "#ffe0f0",
    accentStrong: "#cc5f98",
    shadow: "rgba(201, 115, 159, 0.2)",
    ink: "#43273b",
    page: "linear-gradient(180deg, #fff2f8 0%, #fffaf2 100%)",
    border: "#ffd7ea",
  },
  {
    id: "mint-green",
    name: "Mint Green",
    description: "Fresh and tidy with a crisp mint accent.",
    surface: "#f7fffb",
    accent: "#7fd3af",
    accentSoft: "#daf9ea",
    accentStrong: "#2e8e6b",
    shadow: "rgba(76, 146, 117, 0.18)",
    ink: "#234033",
    page: "linear-gradient(180deg, #effdf7 0%, #fefdf4 100%)",
    border: "#d3f4e3",
  },
  {
    id: "lavender",
    name: "Lavender",
    description: "Soft lilac pages with a quiet evening feel.",
    surface: "#fbf8ff",
    accent: "#b99cf4",
    accentSoft: "#eee5ff",
    accentStrong: "#7750c5",
    shadow: "rgba(117, 92, 181, 0.2)",
    ink: "#33284b",
    page: "linear-gradient(180deg, #f4efff 0%, #fff8fb 100%)",
    border: "#e1d7ff",
  },
  {
    id: "warm-cream",
    name: "Warm Cream",
    description: "Cozy desk-lamp colors with paper texture energy.",
    surface: "#fffdf8",
    accent: "#f0b76e",
    accentSoft: "#fff0d7",
    accentStrong: "#b9711f",
    shadow: "rgba(191, 142, 85, 0.18)",
    ink: "#4b3720",
    page: "linear-gradient(180deg, #fff8ea 0%, #fffdf7 100%)",
    border: "#f5e1bc",
  },
  {
    id: "dark-mode",
    name: "Dark Mode",
    description: "Midnight desk setup with glowing accents.",
    surface: "#1d2333",
    accent: "#8ec5ff",
    accentSoft: "#28344a",
    accentStrong: "#d3e9ff",
    shadow: "rgba(0, 0, 0, 0.35)",
    ink: "#f6f4ff",
    page: "linear-gradient(180deg, #151923 0%, #24283b 100%)",
    border: "#2d3550",
  },
];

export const DEFAULT_SETTINGS: Omit<UserSettings, "id" | "user_id" | "created_at"> = {
  theme: "light",
  color_scheme: "soft-blue",
  button_sounds_enabled: true,
  tab_sounds_enabled: true,
  timer_sound_enabled: true,
  volume: 0.5,
  floating_mode_enabled: false,
};

export const POPUP_DIMENSIONS = {
  width: 420,
  height: 600,
};

export const MINIMUM_CONFIRM_SAVE_SECONDS = 30;
