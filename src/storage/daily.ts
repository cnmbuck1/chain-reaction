// Daily puzzle results and the streak. Stored apart from progress, under its own key.
// Reads never throw: anything missing or malformed falls back to a fresh record.
//
// The streak counts days in a row with the daily solved. Missing one day costs nothing
// the first time in a week (the free freeze, used automatically); after that, a missed day
// can be repaired for coins or an ad before the next solve. Two missed days end it.

import { addDays, daysBetween, weekOf } from '../daily/dates';
import type { Stars } from '../game/scoring';
import { DAILY_COINS, STREAK_BONUS_COINS, STREAK_BONUS_DAYS } from '../monetize/prices';

export interface DailyResult {
  stars: Stars;
  runs: number;
  hintsUsed: number;
  changes: number;
  par: number;
}

export interface DailyRecord {
  version: 1;
  /** Results by UTC day, recent days only. */
  results: Record<string, DailyResult>;
  streak: number;
  best: number;
  /** The last day the streak counts, solved or repaired. */
  lastDay: string | null;
  /** Weeks (their Mondays) whose free freeze is used, recent weeks only. */
  freezes: string[];
}

export const DAILY_KEY = 'chain-reaction/daily';
/** Results and freezes older than this many days are dropped on save. */
const KEEP_DAYS = 60;

type KeyValueStore = Pick<Storage, 'getItem' | 'setItem'>;

export const freshDaily = (): DailyRecord => ({
  version: 1,
  results: {},
  streak: 0,
  best: 0,
  lastDay: null,
  freezes: [],
});

function defaultStore(): KeyValueStore | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadDaily(store: KeyValueStore | null = defaultStore()): DailyRecord {
  try {
    const raw = store?.getItem(DAILY_KEY);
    return raw ? migrateDaily(JSON.parse(raw)) : freshDaily();
  } catch {
    return freshDaily();
  }
}

export function saveDaily(record: DailyRecord, store: KeyValueStore | null = defaultStore()) {
  try {
    store?.setItem(DAILY_KEY, JSON.stringify(record));
  } catch {
    // Storage full or blocked: the record lasts for this session only.
  }
}

const isCount = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0;
const isDay = (d: unknown): d is string =>
  typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d));

function cleanResult(r: unknown): DailyResult | null {
  if (typeof r !== 'object' || r === null) return null;
  const { stars, runs, hintsUsed, changes, par } = r as Record<string, unknown>;
  if (stars !== 1 && stars !== 2 && stars !== 3) return null;
  if (!isCount(runs) || runs < 1 || !isCount(hintsUsed) || !isCount(changes) || !isCount(par))
    return null;
  return { stars, runs, hintsUsed, changes, par };
}

export function migrateDaily(data: unknown): DailyRecord {
  if (typeof data !== 'object' || data === null) return freshDaily();
  const d = data as Record<string, unknown>;
  if (d.version !== 1 || !isCount(d.streak) || !isCount(d.best)) return freshDaily();
  const results: Record<string, DailyResult> = {};
  if (typeof d.results === 'object' && d.results !== null) {
    for (const [day, r] of Object.entries(d.results)) {
      const clean = cleanResult(r);
      if (isDay(day) && clean) results[day] = clean;
    }
  }
  const lastDay = isDay(d.lastDay) ? d.lastDay : null;
  return {
    version: 1,
    results,
    streak: lastDay ? d.streak : 0,
    best: Math.max(d.best, lastDay ? d.streak : 0),
    lastDay,
    freezes: Array.isArray(d.freezes) ? d.freezes.filter(isDay) : [],
  };
}

export type StreakState =
  /** No streak yet, or it ended. */
  | 'none'
  /** Today's daily is solved. */
  | 'done'
  /** Yesterday counted: solve today to keep it going. */
  | 'alive'
  /** One day missed, and this week's free freeze will cover it. */
  | 'frozen'
  /** One day missed, the freeze is used: repair it or start over. */
  | 'repairable';

export interface Streak {
  state: StreakState;
  /** The streak as it stands today: 0 once it has ended. */
  days: number;
  /** The missed day, for 'frozen' and 'repairable'. */
  missed?: string;
}

export function streakOn(record: DailyRecord, today: string): Streak {
  if (!record.lastDay || record.streak === 0) return { state: 'none', days: 0 };
  const gap = daysBetween(record.lastDay, today);
  if (gap <= 0) return { state: 'done', days: record.streak };
  if (gap === 1) return { state: 'alive', days: record.streak };
  if (gap === 2) {
    const missed = addDays(record.lastDay, 1);
    const state = record.freezes.includes(weekOf(missed)) ? 'repairable' : 'frozen';
    return { state, days: record.streak, missed };
  }
  return { state: 'none', days: 0 };
}

function trimmed(record: DailyRecord, today: string): DailyRecord {
  const recent = (day: string) => daysBetween(day, today) <= KEEP_DAYS;
  return {
    ...record,
    results: Object.fromEntries(Object.entries(record.results).filter(([day]) => recent(day))),
    freezes: record.freezes.filter(recent),
  };
}

export interface DailyWin {
  record: DailyRecord;
  /** Coins the solve earned: the daily's, plus a streak bonus on every seventh day. */
  coins: number;
  /** False for a replay of a daily already solved: it can raise stars, nothing else. */
  first: boolean;
}

/** Saves a solve of `day`'s daily and moves the streak on. */
export function recordDailyWin(record: DailyRecord, day: string, result: DailyResult): DailyWin {
  const earlier = record.results[day];
  if (earlier) {
    const best = result.stars > earlier.stars ? result : earlier;
    return {
      record: { ...record, results: { ...record.results, [day]: best } },
      coins: 0,
      first: false,
    };
  }
  const streak = streakOn(record, day);
  let days = 1;
  let freezes = record.freezes;
  if (streak.state === 'alive') days = streak.days + 1;
  if (streak.state === 'frozen') {
    days = streak.days + 1;
    freezes = [...freezes, weekOf(streak.missed!)];
  }
  // A day the streak already counts without a result (it can't happen in play) keeps it.
  if (streak.state === 'done') days = streak.days;
  const bonus = days % STREAK_BONUS_DAYS === 0 ? STREAK_BONUS_COINS : 0;
  const next: DailyRecord = {
    ...record,
    results: { ...record.results, [day]: result },
    streak: days,
    best: Math.max(record.best, days),
    lastDay: streak.state === 'done' ? record.lastDay : day,
    freezes,
  };
  return { record: trimmed(next, day), coins: DAILY_COINS + bonus, first: true };
}

/** Covers the missed day of a 'repairable' streak, so today's solve carries it on. */
export function repairStreak(record: DailyRecord, today: string): DailyRecord | null {
  const streak = streakOn(record, today);
  if (streak.state !== 'repairable') return null;
  return { ...record, lastDay: streak.missed! };
}
