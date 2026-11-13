import { describe, expect, it } from 'vitest';
import {
  REVIEW_FROM_LEVEL,
  REVIEW_GAP_MS,
  REVIEW_LEVEL_GAP,
  REVIEW_MAX_ASKS,
} from '../../src/monetize/prices';
import {
  REVIEW_KEY,
  freshReview,
  loadReview,
  migrateReview,
  reviewAfterSolve,
  saveReview,
  type ReviewMoment,
} from '../../src/storage/review';

const T0 = 1_800_000_000_000;
const happy = (level: number, now = T0): ReviewMoment => ({
  level,
  firstSolve: true,
  clean: true,
  adDue: false,
  now,
});

describe('reviewAfterSolve', () => {
  it('never asks before the starting level', () => {
    for (let level = 1; level < REVIEW_FROM_LEVEL; level++) {
      expect(reviewAfterSolve(freshReview(), happy(level)).ask).toBe(false);
    }
  });

  it('asks on the first clean first solve from the starting level', () => {
    const r = reviewAfterSolve(freshReview(), happy(REVIEW_FROM_LEVEL));
    expect(r.ask).toBe(true);
    expect(r.review).toEqual({ version: 1, asks: 1, lastAt: T0, lastLevel: REVIEW_FROM_LEVEL });
  });

  it('holds back for a replay, a miss or hint, or an ad that is due', () => {
    const level = REVIEW_FROM_LEVEL + 1;
    for (const edit of [{ firstSolve: false }, { clean: false }, { adDue: true }]) {
      const r = reviewAfterSolve(freshReview(), { ...happy(level), ...edit });
      expect(r.ask).toBe(false);
      expect(r.review).toEqual(freshReview());
    }
  });

  it('asks again only after enough levels and enough time', () => {
    const first = reviewAfterSolve(freshReview(), happy(REVIEW_FROM_LEVEL)).review;
    const later = REVIEW_FROM_LEVEL + REVIEW_LEVEL_GAP;
    expect(reviewAfterSolve(first, happy(later - 1, T0 + REVIEW_GAP_MS)).ask).toBe(false);
    expect(reviewAfterSolve(first, happy(later, T0 + REVIEW_GAP_MS - 1)).ask).toBe(false);
    expect(reviewAfterSolve(first, happy(later, T0 + REVIEW_GAP_MS)).ask).toBe(true);
  });

  it('stops after the most asks', () => {
    const spent = { version: 1 as const, asks: REVIEW_MAX_ASKS, lastAt: 0, lastLevel: 0 };
    expect(reviewAfterSolve(spent, happy(999, T0 * 2)).ask).toBe(false);
  });
});

describe('review storage', () => {
  it('round-trips and falls back on bad data', () => {
    const data = new Map<string, string>();
    const store = {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
    };
    expect(loadReview(store)).toEqual(freshReview());
    const saved = { version: 1 as const, asks: 2, lastAt: T0, lastLevel: 30 };
    saveReview(saved, store);
    expect(loadReview(store)).toEqual(saved);
    data.set(REVIEW_KEY, '{oops');
    expect(loadReview(store)).toEqual(freshReview());
    expect(migrateReview({ version: 1, asks: -1, lastAt: 'x' })).toEqual(freshReview());
    expect(migrateReview(null)).toEqual(freshReview());
  });
});
