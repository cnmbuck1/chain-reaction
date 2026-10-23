import { describe, expect, it } from 'vitest';
import { simulateRun } from '../../src/engine/simulate';
import { hintSteps } from '../../src/hints/steps';
import { checkLevel } from '../../src/levels/check';
import { levels } from '../../src/levels';
import { demoHintShop } from '../../src/monetize/hintShop';
import { makeLevel, ball, gate, goal, source, sw } from '../fixtures';

describe.each(levels.map((l) => [l.id, l] as const))('%s hints', (_id, level) => {
  const steps = hintSteps(level);

  it('has a nudge, a focus gate and one move', () => {
    expect(steps.map((s) => s.kind)).toEqual(['nudge', 'focus', 'move']);
  });

  it('never gives the whole solution away', () => {
    const report = checkLevel(level).report!;
    const move = steps[2]!;
    if (move.kind !== 'move') throw new Error('expected a move');
    // The move matches the solution, and the solution needs more than that one move
    // except on single-switch levels.
    expect(report.wins.every((w) => w[move.switchId] === move.on)).toBe(true);
    if (report.minChanges! > 1) {
      const onlyMove = Object.fromEntries(
        level.nodes.filter((n) => n.type === 'switch').map((n) => [n.id, n.initialOn]),
      );
      onlyMove[move.switchId] = move.on;
      expect(simulateRun(level, onlyMove, 1).won).toBe(false);
    }
  });
});

describe('hint checks', () => {
  const base = makeLevel({
    maxToggles: 1,
    nodes: [source(), sw('a'), sw('b'), gate('g1'), ball(), goal()],
    signalEdges: [
      { from: 'source', to: 'a' },
      { from: 'source', to: 'b' },
      { from: 'a', to: 'g1' },
      { from: 'b', to: 'g1' },
    ],
    track: [['ball', 'g1', 'goal']],
  });

  it('flag a focus that is not a gate, and a key switch the solutions disagree on', () => {
    const level = { ...base, meta: { ...base.meta, minChanges: 1, focus: 'a', keySwitch: 'a' } };
    // g1 is single-input with two feeders, so use an OR gate to get two solutions.
    const or = {
      ...level,
      nodes: level.nodes.map((n) => (n.id === 'g1' ? { ...n, combine: 'or' as const } : n)),
    };
    const codes = checkLevel(or).errors.map((e) => e.code);
    expect(codes.filter((c) => c === 'BAD_HINT')).toHaveLength(2);
  });
});

describe('demo hint shop', () => {
  it('grants one hint per ad and the pack size per purchase', async () => {
    const shop = demoHintShop(0);
    expect(shop.demo).toBe(true);
    expect(await shop.watchAd()).toBe(1);
    expect(await shop.buy('hints_5')).toBe(5);
    expect(await shop.buy('nope')).toBe(0);
  });
});
