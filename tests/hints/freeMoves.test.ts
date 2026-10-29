import { describe, expect, it } from 'vitest';
import { changesUsed, initialState, step } from '../../src/engine/reducer';
import { simulateRun } from '../../src/engine/simulate';
import { solve } from '../../src/engine/solver';
import { freeMovePlan, withFreeMoves } from '../../src/hints/freeMoves';
import { checkLevel } from '../../src/levels/check';
import { levels } from '../../src/levels';
import { demoShop } from '../../src/monetize/shop';
import { ball, gate, goal, makeLevel, source, sw } from '../fixtures';

describe.each(levels.map((l) => [l.id, l] as const))('%s free moves', (_id, level) => {
  const plan = freeMovePlan(level);
  const report = solve(level);

  it('starts with the key switch and only makes moves the par solution needs', () => {
    expect(plan[0]!.switchId).toBe(level.meta.keySwitch);
    for (const move of plan) {
      expect(report.parWins.every((w) => w[move.switchId] === move.on)).toBe(true);
    }
  });

  it('leaves the last change to the player unless the level needs only one', () => {
    expect(plan).toHaveLength(Math.max(1, report.minChanges! - 1));
  });

  it('does not count as a change, and locks the hinted switches', () => {
    const hinted = withFreeMoves(level, plan.length);
    const state = initialState(hinted);
    expect(changesUsed(hinted, state.switches)).toBe(0);
    for (const move of plan) {
      expect(state.switches[move.switchId]).toBe(move.on);
      const toggled = step(hinted, state, { type: 'toggle', switchId: move.switchId });
      expect(toggled.rejected).toBe('locked');
    }
    const after = solve(hinted);
    expect(after.solvable).toBe(true);
    expect(after.minChanges).toBe(report.minChanges! - plan.length);
  });

  it('never wins on its own when the level needs more than one change', () => {
    if (report.minChanges! <= 1) return;
    const hinted = withFreeMoves(level, plan.length);
    expect(simulateRun(hinted, initialState(hinted).switches, 1).won).toBe(false);
  });
});

describe('hint checks', () => {
  it('flag a key switch that solutions disagree on', () => {
    const level = makeLevel({
      nodes: [source(), sw('a'), sw('b'), gate('g1', true, 'or'), ball(), goal()],
      signalEdges: [
        { from: 'source', to: 'a' },
        { from: 'source', to: 'b' },
        { from: 'a', to: 'g1' },
        { from: 'b', to: 'g1' },
      ],
      track: [['ball', 'g1', 'goal']],
    });
    const bad = { ...level, meta: { ...level.meta, minChanges: 1, keySwitch: 'a' } };
    expect(checkLevel(bad).errors.map((e) => e.code)).toContain('BAD_HINT');
  });
});

describe('demo shop', () => {
  it('finishes every ad and grants the pack size per purchase', async () => {
    const shop = demoShop(0);
    expect(shop.demo).toBe(true);
    expect(await shop.watchAd()).toBe(true);
    expect(await shop.buy('coins_100')).toBe(100);
    expect(await shop.buy('nope')).toBe(0);
  });
});
