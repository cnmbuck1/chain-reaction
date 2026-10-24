import { describe, expect, it } from 'vitest';
import {
  emptyProgress,
  isUnlocked,
  loadProgress,
  migrate,
  recordWin,
  saveProgress,
  spendFirstRun,
  STORAGE_KEY,
  totalStars,
  type WinResult,
} from '../../src/storage/progress';

const memoryStore = (initial: Record<string, string> = {}) => {
  const data = { ...initial };
  return {
    data,
    getItem: (k: string) => data[k] ?? null,
    setItem: (k: string, v: string) => void (data[k] = v),
  };
};

const win = (over: Partial<WinResult> = {}): WinResult => ({
  stars: 2,
  attempts: 2,
  changes: 2,
  at: '2026-10-24T00:00:00.000Z',
  ...over,
});

describe('progress storage', () => {
  it('round-trips through storage', () => {
    const store = memoryStore();
    const progress = spendFirstRun(recordWin(emptyProgress(), 'level-01', win()), 'level-02');
    saveProgress(progress, store);
    expect(loadProgress(store)).toEqual(progress);
  });

  it('starts fresh when nothing is stored, storage is missing, or data is corrupt', () => {
    expect(loadProgress(memoryStore())).toEqual(emptyProgress());
    expect(loadProgress(null)).toEqual(emptyProgress());
    expect(loadProgress(memoryStore({ [STORAGE_KEY]: '{not json' }))).toEqual(emptyProgress());
  });

  it('drops unknown versions and invalid records', () => {
    expect(migrate({ version: 99, completed: {} })).toEqual(emptyProgress());
    expect(
      migrate({
        version: 2,
        completed: {
          a: { stars: 2, bestAttempts: 3 },
          b: { stars: 4, bestAttempts: 1 },
          c: { stars: 1, bestAttempts: 0 },
          d: 'x',
        },
        firstRunUsed: { a: true, e: 'yes' },
      }),
    ).toEqual({
      version: 2,
      completed: { a: { stars: 2, bestAttempts: 3 } },
      firstRunUsed: { a: true },
    });
  });

  it('upgrades a version 1 save without losing progress', () => {
    const v1 = {
      version: 1,
      completed: {
        'level-01': { bestAttempts: 1 },
        'level-02': { bestAttempts: 3 },
        'level-03': { bestAttempts: 1 },
      },
      seenIntro: true,
    };
    // Level 3 was solved with a hint move, so it earns one star.
    expect(migrate(v1, { 'level-03': 1 })).toEqual({
      version: 2,
      completed: {
        'level-01': { stars: 3, bestAttempts: 1 },
        'level-02': { stars: 2, bestAttempts: 3 },
        'level-03': { stars: 1, bestAttempts: 1 },
      },
      firstRunUsed: { 'level-01': true, 'level-02': true, 'level-03': true },
      seenIntro: true,
    });
  });

  it('reads the hint wallet when upgrading through loadProgress', () => {
    const store = memoryStore({
      [STORAGE_KEY]: JSON.stringify({ version: 1, completed: { 'level-05': { bestAttempts: 1 } } }),
    });
    expect(loadProgress(store, { 'level-05': 2 }).completed['level-05']!.stars).toBe(1);
  });

  it('survives a store that throws', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(loadProgress(broken)).toEqual(emptyProgress());
    expect(() => saveProgress(emptyProgress(), broken)).not.toThrow();
  });

  it('keeps the intro flag', () => {
    expect(migrate({ version: 2, completed: {}, seenIntro: true }).seenIntro).toBe(true);
    expect(migrate({ version: 2, completed: {}, seenIntro: 'yes' })).toEqual(emptyProgress());
  });

  it('never lowers a result: best stars, fewest Runs and changes, first time solved', () => {
    let p = recordWin(emptyProgress(), 'level-01', win({ stars: 2, attempts: 3, changes: 3 }));
    p = recordWin(
      p,
      'level-01',
      win({ stars: 1, attempts: 5, changes: 4, at: '2026-10-25T00:00:00.000Z' }),
    );
    expect(p.completed['level-01']).toEqual({
      stars: 2,
      bestAttempts: 3,
      fewestChanges: 3,
      firstCompletedAt: '2026-10-24T00:00:00.000Z',
    });
    p = recordWin(p, 'level-01', win({ stars: 3, attempts: 1, changes: 2 }));
    expect(p.completed['level-01']).toMatchObject({ stars: 3, bestAttempts: 1, fewestChanges: 2 });
  });

  it('recording the same win twice changes nothing more', () => {
    const once = recordWin(emptyProgress(), 'level-01', win());
    expect(recordWin(once, 'level-01', win())).toEqual(once);
  });

  it('a win or a spent first Run marks the first Run used, once', () => {
    const p = spendFirstRun(emptyProgress(), 'level-04');
    expect(p.firstRunUsed).toEqual({ 'level-04': true });
    expect(spendFirstRun(p, 'level-04')).toBe(p);
    expect(recordWin(emptyProgress(), 'level-01', win()).firstRunUsed).toEqual({
      'level-01': true,
    });
  });

  it('unlocks levels in order and totals stars', () => {
    const ids = ['level-01', 'level-02', 'level-03'];
    const p = recordWin(emptyProgress(), 'level-01', win({ stars: 3 }));
    expect(isUnlocked(ids, p, 0)).toBe(true);
    expect(isUnlocked(ids, p, 1)).toBe(true);
    expect(isUnlocked(ids, p, 2)).toBe(false);
    expect(totalStars(ids, p)).toBe(3);
  });
});
