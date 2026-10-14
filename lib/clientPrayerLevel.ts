import { isPrayerLevel } from "@/lib/prayerPotions";

export const DEFAULT_PRAYER_LEVEL = "70";
const STORAGE_KEY = "merchvision-prayer-level";

export function loadPrayerLevel(): string {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved !== null && isPrayerLevel(Number(saved))) return String(Number(saved));
  } catch {
    // Storage can be disabled; the calculator still works for this visit.
  }
  return DEFAULT_PRAYER_LEVEL;
}

export function savePrayerLevel(value: string): void {
  if (!isPrayerLevel(Number(value))) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, String(Number(value)));
  } catch {
    // A storage failure must not interrupt editing the Prayer level.
  }
}
