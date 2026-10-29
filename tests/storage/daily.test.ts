import { describe, expect, it } from 'vitest';
import { DAILY_COINS, STREAK_BONUS_COINS } from '../../src/monetize/prices';
import {
  DAILY_KEY,
  freshDaily,
  loadDaily,
  migrateDaily,
  recordDailyWin,
  repairStreak,
  saveDaily,
  streakOn,
  type DailyRecord,
  type DailyResult,
} from '../../src/storage/daily';

const win: DailyResult = { stars: 3, runs: 1, hintsUsed: 0, changes: 3, par: 3 };

function solveDays(days: string[], record = freshDaily()) {
  let coins = 0;
  for (const day of days) {
    const r = recordDailyWin(record, day, win);
    record = r.record;
    coins += r.coins;
  }
  return { record, coins };
}

function memoryStore() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
}

describe('daily streak', () => {
  it('counts days in a row and pays the daily coins once a day', () => {
    const { record, coins } = solveDays(['2026-10-28', '2026-10-29', '2026-10-30']);
    expect(record.streak).toBe(3);
    expect(record.best).toBe(3);
    expect(coins).toBe(3 * DAILY_COINS);
    expect(streakOn(record, '2026-10-30')).toEqual({ state: 'done', days: 3 });
    expect(streakOn(record, '2026-10-31')).toEqual({ state: 'alive', days: 3 });
    // A replay can raise stars but pays nothing and leaves the streak alone.
    const again = recordDailyWin(record, '2026-10-30', win);
    expect(again).toMatchObject({ coins: 0, first: false });
    expect(again.record.streak).toBe(3);
  });

  it('pays a bonus every seventh day', () => {
    const days = Array.from({ length: 7 }, (_, i) => `2026-11-0${i + 2}`);
    expect(solveDays(days).coins).toBe(7 * DAILY_COINS + STREAK_BONUS_COINS);
  });

  it('a missed day uses the week’s free freeze, then needs a repair', () => {
    // Mon 26 Oct and Tue 27 solved, Wed 28 missed, Thu 29 solved: the freeze covers it.
    let { record } = solveDays(['2026-10-26', '2026-10-27']);
    expect(streakOn(record, '2026-10-29')).toEqual({
      state: 'frozen',
      days: 2,
      missed: '2026-10-28',
    });
    record = recordDailyWin(record, '2026-10-29', win).record;
    expect(record.streak).toBe(3);
    expect(record.freezes).toEqual(['2026-10-26']);

    // Fri 30 missed too, in the same week: no freeze left, so it can be repaired.
    expect(streakOn(record, '2026-10-31')).toMatchObject({ state: 'repairable', days: 3 });
    expect(repairStreak(record, '2026-10-30')).toBeNull();
    const repaired = repairStreak(record, '2026-10-31')!;
    expect(streakOn(repaired, '2026-10-31')).toEqual({ state: 'alive', days: 3 });
    expect(recordDailyWin(repaired, '2026-10-31', win).record.streak).toBe(4);
    // Without the repair, solving starts a new streak; the best stays.
    const fresh = recordDailyWin(record, '2026-10-31', win).record;
    expect(fresh.streak).toBe(1);
    expect(fresh.best).toBe(3);
  });

  it('a new week brings a new freeze', () => {
    let { record } = solveDays(['2026-10-26', '2026-10-27', '2026-10-29']);
    record = solveDays(['2026-10-30', '2026-11-01', '2026-11-02'], record).record;
    // Sat 31 Oct was missed in the week whose freeze is spent: the streak restarted.
    expect(record.streak).toBe(2);
    record = solveDays(['2026-11-04'], record).record; // Tue 3 Nov missed, a new week
    expect(record.streak).toBe(3);
  });

  it('two missed days end the streak', () => {
    const { record } = solveDays(['2026-10-26', '2026-10-27']);
    expect(streakOn(record, '2026-10-30')).toEqual({ state: 'none', days: 0 });
    expect(repairStreak(record, '2026-10-30')).toBeNull();
  });
});

describe('daily record storage', () => {
  it('round-trips, drops old results and cleans bad data', () => {
    const store = memoryStore();
    const { record } = solveDays(['2026-10-28', '2026-10-29']);
    saveDaily(record, store);
    expect(loadDaily(store)).toEqual(record);

    const later = recordDailyWin(record, '2027-01-15', win).record;
    expect(Object.keys(later.results)).toEqual(['2027-01-15']);

    const bad: unknown = {
      version: 1,
      streak: 4,
      best: 2,
      lastDay: '2026-10-29',
      results: { '2026-10-29': win, nope: win, '2026-10-28': { stars: 5 } },
      freezes: ['2026-10-26', 7],
    };
    expect(migrateDaily(bad)).toEqual<DailyRecord>({
      version: 1,
      results: { '2026-10-29': win },
      streak: 4,
      best: 4,
      lastDay: '2026-10-29',
      freezes: ['2026-10-26'],
    });
    expect(migrateDaily({ version: 2 })).toEqual(freshDaily());
    store.data.set(DAILY_KEY, '{broken');
    expect(loadDaily(store)).toEqual(freshDaily());
    expect(loadDaily(null)).toEqual(freshDaily());
  });
});
