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
    name: "Frost Blue",
    bg: "#f3f7fc",
    paper: "#ffffff",
    ink: "#1f3147",
    inkSoft: "#55687f",
    muted: "#9baab9",
    accent: "#4d8fe6",
    accentSoft: "#e8f1fd",
    accentStrong: "#296dc8",
    success: "#2fb07f",
    danger: "#df625b",
    border: "#d7e4f2",
  },
  {
    id: "sakura-pink",
    name: "Soft Pink",
    bg: "#fcf5f8",
    paper: "#fffdfd",
    ink: "#442b39",
    inkSoft: "#6e5563",
    muted: "#b29aa7",
    accent: "#df7fb0",
    accentSoft: "#fbe5f1",
    accentStrong: "#be5e91",
    success: "#53ae88",
    danger: "#de6a6a",
    border: "#f0d9e5",
  },
  {
    id: "mint-green",
    name: "Mint Green",
    bg: "#f3faf7",
    paper: "#fdfffe",
    ink: "#233e34",
    inkSoft: "#557163",
    muted: "#97ab9f",
    accent: "#47a989",
    accentSoft: "#e0f4ed",
    accentStrong: "#2c876a",
    success: "#279c73",
    danger: "#d8615d",
    border: "#d5ebe2",
  },
  {
    id: "warm-cream",
    name: "Parchment",
    bg: "#f6f1e9",
    paper: "#ffffff",
    ink: "#3a2f26",
    inkSoft: "#6b5d4f",
    muted: "#9b8d7e",
    accent: "#5b9bd5",
    accentSoft: "#e6f1fb",
    accentStrong: "#3f7cb8",
    success: "#6fbf8b",
    danger: "#e0645f",
    border: "#ece4d6",
  },
  {
    id: "lavender",
    name: "Lavender",
    bg: "#f6f3fb",
    paper: "#fefcff",
    ink: "#352d46",
    inkSoft: "#655d79",
    muted: "#a69db7",
    accent: "#8e77d4",
    accentSoft: "#ece7fb",
    accentStrong: "#6f57bc",
    success: "#58a98a",
    danger: "#d66577",
    border: "#ddd7ef",
  },
];

export const DEFAULT_SETTINGS: Omit<UserSettings, "id" | "user_id" | "created_at"> = {
  theme: "light",
  color_scheme: "warm-cream",
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
