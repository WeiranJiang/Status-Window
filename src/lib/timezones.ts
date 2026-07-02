import { getStorageItem, removeStorageItem, setStorageItem } from "./storage";

const TIME_ZONE_STORAGE_KEY_PREFIX = "status-window-time-zone:";

const TIME_ZONE_ALIAS_MAP: Record<string, string> = {
  UTC: "UTC",
  GMT: "UTC",
  EST: "America/New_York",
  EDT: "America/New_York",
  CST: "America/Chicago",
  CDT: "America/Chicago",
  MST: "America/Denver",
  MDT: "America/Denver",
  PST: "America/Los_Angeles",
  PDT: "America/Los_Angeles",
  AKST: "America/Anchorage",
  AKDT: "America/Anchorage",
  HST: "Pacific/Honolulu",
};

export const COMMON_TIME_ZONE_OPTIONS = [
  { label: "System default", value: "" },
  { label: "Eastern Time (EST/EDT)", value: "America/New_York" },
  { label: "Central Time (CST/CDT)", value: "America/Chicago" },
  { label: "Mountain Time (MST/MDT)", value: "America/Denver" },
  { label: "Pacific Time (PST/PDT)", value: "America/Los_Angeles" },
  { label: "Alaska Time (AKST/AKDT)", value: "America/Anchorage" },
  { label: "Hawaii Time (HST)", value: "Pacific/Honolulu" },
  { label: "UTC", value: "UTC" },
  { label: "London", value: "Europe/London" },
  { label: "Paris", value: "Europe/Paris" },
  { label: "Tokyo", value: "Asia/Tokyo" },
  { label: "Sydney", value: "Australia/Sydney" },
] as const;

const weekdayIndexByLabel: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function getTimeZoneStorageKey(userId: string) {
  return `${TIME_ZONE_STORAGE_KEY_PREFIX}${userId}`;
}

export function getSystemTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

export function isSupportedTimeZone(timeZone: string) {
  try {
    new Intl.DateTimeFormat(undefined, { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function normalizeTimeZoneInput(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  const aliasMatch = TIME_ZONE_ALIAS_MAP[trimmed.toUpperCase()];
  if (aliasMatch) {
    return aliasMatch;
  }

  return isSupportedTimeZone(trimmed) ? trimmed : null;
}

export function getTimeZoneLabel(timeZone: string | null | undefined) {
  const normalized = normalizeTimeZoneInput(timeZone);
  if (!normalized) {
    return `System default (${getSystemTimeZone()})`;
  }

  const match = COMMON_TIME_ZONE_OPTIONS.find((option) => option.value === normalized);
  return match ? `${match.label} - ${normalized}` : normalized;
}

export async function getStoredTimeZonePreference(userId: string) {
  const rawValue = await getStorageItem(getTimeZoneStorageKey(userId), "local");
  return normalizeTimeZoneInput(rawValue);
}

export async function setStoredTimeZonePreference(userId: string, timeZone: string | null) {
  const normalized = normalizeTimeZoneInput(timeZone);
  if (!normalized) {
    await removeStorageItem(getTimeZoneStorageKey(userId), "local");
    return null;
  }

  await setStorageItem(getTimeZoneStorageKey(userId), normalized, "local");
  return normalized;
}

function getResolvedTimeZone(timeZone: string | null | undefined) {
  return normalizeTimeZoneInput(timeZone) ?? undefined;
}

function getFormatter(
  options: Intl.DateTimeFormatOptions,
  timeZone: string | null | undefined,
  locale: string | string[] | undefined = undefined,
) {
  const resolvedTimeZone = getResolvedTimeZone(timeZone);
  return new Intl.DateTimeFormat(locale, resolvedTimeZone ? { ...options, timeZone: resolvedTimeZone } : options);
}

export function formatInTimeZone(
  value: string | number | Date,
  options: Intl.DateTimeFormatOptions,
  timeZone: string | null | undefined,
  locale: string | string[] | undefined = undefined,
) {
  const date = value instanceof Date ? value : new Date(value);
  return getFormatter(options, timeZone, locale).format(date);
}

export function toDateKeyInTimeZone(value: string | number | Date, timeZone: string | null | undefined = null) {
  const date = value instanceof Date ? value : new Date(value);
  const parts = getFormatter(
    {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    },
    timeZone,
    "en-CA",
  ).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return `${year}-${month}-${day}`;
}

export function shiftDateKey(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);

  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

export function compareDateKeys(left: string, right: string) {
  return left.localeCompare(right);
}

export function getWeekdayIndexInTimeZone(value: string | number | Date, timeZone: string | null | undefined = null) {
  const date = value instanceof Date ? value : new Date(value);
  const weekday = formatInTimeZone(date, { weekday: "short" }, timeZone, "en-US");
  return weekdayIndexByLabel[weekday] ?? 0;
}

export function getStartOfWeekDateKey(value: string | number | Date, timeZone: string | null | undefined = null) {
  const todayKey = toDateKeyInTimeZone(value, timeZone);
  return shiftDateKey(todayKey, -getWeekdayIndexInTimeZone(value, timeZone));
}
