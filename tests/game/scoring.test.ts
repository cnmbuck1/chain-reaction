import { describe, expect, it } from 'vitest';
import { nextStarTip, starsFor, type Solve } from '../../src/game/scoring';

const solve = (over: Partial<Solve> = {}): Solve => ({
  hintsUsed: 0,
  firstRun: true,
  changes: 2,
  par: 2,
  ...over,
});

describe('stars', () => {
  it('gives 3 for a first-Run solve at par with no hints', () => {
    expect(starsFor(solve())).toBe(3);
    expect(nextStarTip(solve())).toBeNull();
  });

  it('gives 2 for a later Run with no hints', () => {
    expect(starsFor(solve({ firstRun: false }))).toBe(2);
    expect(nextStarTip(solve({ firstRun: false }))).toMatch(/first Run/);
  });

  it('gives 2 for a first-Run solve over par', () => {
    expect(starsFor(solve({ changes: 3 }))).toBe(2);
    expect(nextStarTip(solve({ changes: 3 }))).toMatch(/Par is 2 changes/);
  });

  it('gives 1 whenever a hint was used, even on the first Run at par', () => {
    expect(starsFor(solve({ hintsUsed: 1 }))).toBe(1);
    expect(starsFor(solve({ hintsUsed: 2, firstRun: false, changes: 4 }))).toBe(1);
    expect(nextStarTip(solve({ hintsUsed: 1 }))).toMatch(/without a hint/);
  });
});
