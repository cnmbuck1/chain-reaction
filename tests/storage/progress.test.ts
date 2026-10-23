import { describe, expect, it } from 'vitest';
import {
  emptyProgress,
  isUnlocked,
  loadProgress,
  migrate,
  recordWin,
  saveProgress,
  STORAGE_KEY,
} from '../../src/storage/progress';

const memoryStore = (initial: Record<string, string> = {}) => {
  const data = { ...initial };
  return {
    data,
    getItem: (k: string) => data[k] ?? null,
    setItem: (k: string, v: string) => void (data[k] = v),
  };
};

describe('progress storage', () => {
  it('round-trips through storage', () => {
    const store = memoryStore();
    const progress = recordWin(emptyProgress(), 'level-01', 2);
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
        version: 1,
        completed: { a: { bestAttempts: 3 }, b: { bestAttempts: -1 }, c: 'x' },
      }),
    ).toEqual({ version: 1, completed: { a: { bestAttempts: 3 } } });
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
    expect(migrate({ version: 1, completed: {}, seenIntro: true })).toEqual({
      version: 1,
      completed: {},
      seenIntro: true,
    });
    expect(migrate({ version: 1, completed: {}, seenIntro: 'yes' })).toEqual(emptyProgress());
  });

  it('keeps the best attempt count', () => {
    let p = recordWin(emptyProgress(), 'level-01', 3);
    p = recordWin(p, 'level-01', 5);
    expect(p.completed['level-01']).toEqual({ bestAttempts: 3 });
    p = recordWin(p, 'level-01', 1);
    expect(p.completed['level-01']).toEqual({ bestAttempts: 1 });
  });

  it('unlocks levels in order', () => {
    const ids = ['level-01', 'level-02', 'level-03'];
    const p = recordWin(emptyProgress(), 'level-01', 1);
    expect(isUnlocked(ids, p, 0)).toBe(true);
    expect(isUnlocked(ids, p, 1)).toBe(true);
    expect(isUnlocked(ids, p, 2)).toBe(false);
  });
});
