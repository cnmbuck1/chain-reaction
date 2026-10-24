import { describe, expect, it } from 'vitest';
import { indexLevel, switchStage } from '../../src/engine/graph';
import { replay } from '../../src/engine/reducer';
import type { GameAction, LevelDef } from '../../src/engine/types';
import { checkLevel } from '../../src/levels/check';
import { levels } from '../../src/levels';

describe.each(levels.map((l) => [l.id, l] as const))('%s', (_id, level) => {
  const check = checkLevel(level);

  it('passes validation and solver checks', () => {
    expect(check.errors).toEqual([]);
  });

  it('has exactly one par solution, and it replays to a win', () => {
    const solution = check.report!.solution!;
    expect(check.report!.parWins).toHaveLength(1);
    // A run between the parts of a staged board.
    const stageOf = (id: string) => switchStage(indexLevel(level).nodes.get(id)!);
    const parts = indexLevel(level).checkpoints.length + 1;
    const actions: GameAction[] = [];
    for (let stage = 0; stage < parts; stage++) {
      const moves = solution.filter((id) => stageOf(id) === stage);
      actions.push(...moves.map((switchId) => ({ type: 'toggle' as const, switchId })));
      actions.push({ type: 'run' });
    }
    expect(replay(level, actions).state.phase).toBe('won');
  });

  it('has a unique id', () => {
    expect(levels.filter((l) => l.id === level.id)).toHaveLength(1);
  });
});

describe('the curated set', () => {
  it('has the planned levels in order', () => {
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
      'Fork in the Road',
      'Dead Lane',
      'Long Way Round',
      'Switchyard',
      'Grand Junction',
      'Two Parts',
      'Second Wind',
      'Carry Over',
      'Relay Race',
      'Grand Finale',
    ]);
  });

  it('asks for real deduction from level 4 on', () => {
    for (const level of levels.slice(3)) {
      const report = checkLevel(level).report!;
      expect(report.allOnWins, level.id).toBe(false);
      expect(report.zeroChangeWin, level.id).toBe(false);
    }
    // Easy levels that introduce a new part may be solved by fixing blockers one by one.
    for (const level of levels.slice(4).filter((l) => l.difficulty !== 'easy')) {
      expect(checkLevel(level).report!.greedySolves, level.id).toBe(false);
    }
  });

  it('introduces forks at level 11 and saves NOT wires for after level 20', () => {
    const firstFork = levels.findIndex((l) => l.nodes.some((n) => n.type === 'junction')) + 1;
    expect(firstFork).toBe(11);
    expect(levels[10]!.meta.prompt).toMatch(/fork/);
    for (const level of levels.slice(0, 20)) {
      expect(
        level.signalEdges.some((e) => e.invert),
        level.id,
      ).toBe(false);
    }
  });

  it('splits levels 16 to 20 into two parts, with wires crossing between parts from 18', () => {
    const staged = levels.map((l) => indexLevel(l).checkpoints.length > 0);
    expect(staged.indexOf(true)).toBe(15);
    expect(staged.slice(15)).toEqual([true, true, true, true, true]);
    expect(levels[15]!.meta.prompt).toMatch(/checkpoint/);
    const crosses = (level: LevelDef) =>
      level.signalEdges.some((e) => {
        const from = indexLevel(level).nodes.get(e.from)!;
        const to = indexLevel(level).nodes.get(e.to)!;
        return from.type === 'switch' && switchStage(from) === 0 && to.y > 0.6;
      });
    expect(levels.slice(15).map(crosses)).toEqual([false, false, true, true, true]);
  });

  it('gets harder: par grows overall', () => {
    const mins = levels.map((l) => l.meta.minChanges);
    expect(mins.at(-1)).toBeGreaterThan(mins[0]!);
  });
});
