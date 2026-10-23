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
