import { describe, expect, it } from 'vitest';
import { replay } from '../../src/engine/reducer';
import { checkLevel } from '../../src/levels/check';
import { levels } from '../../src/levels';

describe.each(levels.map((l) => [l.id, l] as const))('%s', (_id, level) => {
  const check = checkLevel(level);

  it('passes validation and solver checks', () => {
    expect(check.errors).toEqual([]);
  });

  it('has a solution within budget that replays to a win', () => {
    const solution = check.report!.solution!;
    expect(solution.length).toBeLessThanOrEqual(level.maxToggles);
    const actions = [
      ...solution.map((switchId) => ({ type: 'toggle' as const, switchId })),
      { type: 'run' as const },
    ];
    expect(replay(level, actions).state.phase).toBe('won');
  });

  it('has a unique id', () => {
    expect(levels.filter((l) => l.id === level.id)).toHaveLength(1);
  });
});

describe('the curated set', () => {
  it('has the ten planned levels in order', () => {
    expect(levels.map((l) => l.name)).toEqual([
      'First Spark',
      'Reverse Logic',
      'Double Duty',
      'The Tradeoff',
      'Two Conditions',
      'False Friend',
      'Minimal Moves',
      'Split Signal',
      'Interlock',
      'Master Circuit',
    ]);
  });

  it('asks for real deduction from level 4 on', () => {
    for (const level of levels.slice(3)) {
      const report = checkLevel(level).report!;
      expect(report.allOnWins, level.id).toBe(false);
      expect(report.zeroChangeWin, level.id).toBe(false);
    }
    for (const level of levels.slice(4)) {
      expect(checkLevel(level).report!.greedySolves, level.id).toBe(false);
    }
  });

  it('gets harder: budgets never shrink below the solution and grow overall', () => {
    const mins = levels.map((l) => l.meta.minChanges);
    expect(mins.at(-1)).toBeGreaterThan(mins[0]!);
    expect(levels.every((l) => l.meta.minChanges <= l.maxToggles)).toBe(true);
  });
});
