// UTC calendar days as YYYY-MM-DD strings: daily puzzles, streaks and ad limits all count
// days this way, so everyone's day turns over at the same moment.

const DAY_MS = 86_400_000;

/** A UTC date as YYYY-MM-DD. */
export const utcDay = (now: Date) => now.toISOString().slice(0, 10);

/** Whole days from one YYYY-MM-DD date to another. */
export const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);

/** The YYYY-MM-DD date `n` days after `day`. */
export const addDays = (day: string, n: number) =>
  utcDay(new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS));

/** The Monday that starts `day`'s week, the week a streak freeze belongs to. */
export function weekOf(day: string): string {
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(day, -((weekday + 6) % 7));
}
