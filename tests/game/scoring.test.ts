import { describe, expect, it } from 'vitest';
import { nextStarTip, starsFor } from '../../src/game/scoring';

describe('stars', () => {
  it('gives 3 for a first-Run solve with no hints', () => {
    expect(starsFor({ hintsUsed: 0, firstRun: true })).toBe(3);
    expect(nextStarTip({ hintsUsed: 0, firstRun: true })).toBeNull();
  });

  it('gives 2 for a later Run with no hints', () => {
    expect(starsFor({ hintsUsed: 0, firstRun: false })).toBe(2);
    expect(nextStarTip({ hintsUsed: 0, firstRun: false })).toMatch(/first Run/);
  });

  it('gives 1 whenever a hint was used, even on the first Run', () => {
    expect(starsFor({ hintsUsed: 1, firstRun: true })).toBe(1);
    expect(starsFor({ hintsUsed: 2, firstRun: false })).toBe(1);
    expect(nextStarTip({ hintsUsed: 1, firstRun: true })).toMatch(/without a hint/);
  });
});
