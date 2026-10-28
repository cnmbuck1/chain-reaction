import { describe, expect, it } from 'vitest';
import { indexLevel, switchStage } from '../../src/engine/graph';
import { replay } from '../../src/engine/reducer';
import { simulateRun } from '../../src/engine/simulate';
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
      'Crossroads',
      'Detour',
      'Stay the Course',
      'Through Traffic',
      'Crossover',
      'Branch Line',
      'Signal Box',
      'Junction Box',
      'Double Junction',
      'Grand Central',
      'Inverter',
      'Opposite Day',
      'Contrary Fork',
      'Upside Down',
      'Double Negative',
      'Mirror Stage',
      'Dark Crossing',
      'Long Haul',
      'Backwire',
      'Grand Inversion',
      'Meshed',
      'Gear Train',
      'Chain Drive',
      'Clockwork',
      'Escapement',
      'Skeleton Key',
      'Key Ring',
      'Lockstep',
      'Turnkey',
      'Master Key',
      'Trip Plate',
      'Tripwire',
      'Pressure Point',
      'Switchback',
      'Double Trip',
      'Two Keys',
      'Gold and Silver',
      'Key Chain',
      'Locksmith',
      'Keymaster',
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

  it('introduces forks at level 11 and NOT wires at level 31', () => {
    const firstFork = levels.findIndex((l) => l.nodes.some((n) => n.type === 'junction')) + 1;
    expect(firstFork).toBe(11);
    expect(levels[10]!.meta.prompt).toMatch(/fork/);
    for (const level of levels.slice(0, 30)) {
      expect(
        level.signalEdges.some((e) => e.invert),
        level.id,
      ).toBe(false);
    }
    expect(levels[30]!.meta.prompt).toMatch(/NOT/);
    for (const level of levels.slice(30, 40)) {
      expect(
        level.signalEdges.some((e) => e.invert),
        level.id,
      ).toBe(true);
    }
  });

  it('mixes NOT wires with forks at 33 and 34, and with two parts from 36', () => {
    const forks = levels.slice(30, 40).map((l) => l.nodes.some((n) => n.type === 'junction'));
    expect(forks).toEqual([false, false, true, true, false, false, false, false, false, false]);
    const staged = levels.slice(30, 40).map((l) => indexLevel(l).checkpoints.length > 0);
    expect(staged).toEqual([false, false, false, false, false, true, true, true, true, true]);
  });

  it('keeps blind guessing at 1 in 10 or worse on NOT boards, except the fork boards', () => {
    for (const level of levels.slice(30, 40)) {
      const odds = checkLevel(level).report!.guessOdds!;
      const fork = level.nodes.some((n) => n.type === 'junction');
      expect(odds, level.id).toBeGreaterThanOrEqual(fork ? 6 : 10);
    }
  });

  it('bridges 20 to the NOT wires with forks on two-part boards, and no new parts', () => {
    const bridge = levels.slice(20, 30);
    // Which part each fork sits in: part B is the lower half of the board.
    const forkParts = (level: LevelDef) =>
      level.nodes
        .filter((n) => n.type === 'junction')
        .map((n) => (n.y > 0.5 ? 'B' : 'A'))
        .join('');
    expect(bridge.map(forkParts)).toEqual(['A', 'A', 'A', 'A', 'A', 'B', 'B', 'B', 'AB', 'AB']);
    for (const level of bridge) {
      expect(indexLevel(level).checkpoints, level.id).toHaveLength(1);
      const newPart = level.nodes.some(
        (n) => ['key', 'lock', 'trip'].includes(n.type) || (n.type === 'switch' && n.turns),
      );
      expect(newPart, level.id).toBe(false);
    }
    // A part A switch reaches into part B from 24; at 27 it sets part B's fork.
    const crosses = (level: LevelDef) =>
      level.signalEdges.some((e) => {
        const from = indexLevel(level).nodes.get(e.from)!;
        const to = indexLevel(level).nodes.get(e.to)!;
        return from.type === 'switch' && switchStage(from) === 0 && to.y > 0.5;
      });
    expect(bridge.map(crosses)).toEqual([
      false,
      false,
      false,
      true,
      true,
      false,
      true,
      true,
      false,
      true,
    ]);
    // Blind guessing gets harder than in 11 to 20, without reaching the NOT boards' 1 in 35.
    const odds = bridge.map((l) => checkLevel(l).report!.guessOdds!);
    expect(odds[0]).toBeGreaterThanOrEqual(6);
    for (const [i, o] of odds.slice(1).entries()) {
      expect(o, bridge[i + 1]!.id).toBeGreaterThanOrEqual(10);
      expect(o, bridge[i + 1]!.id).toBeLessThanOrEqual(20);
    }
  });

  it('splits levels 16 to 20 into two parts, with wires crossing between parts from 18', () => {
    const staged = levels.map((l) => indexLevel(l).checkpoints.length > 0);
    expect(staged.indexOf(true)).toBe(15);
    expect(staged.slice(15, 20)).toEqual([true, true, true, true, true]);
    expect(levels[15]!.meta.prompt).toMatch(/checkpoint/);
    const crosses = (level: LevelDef) =>
      level.signalEdges.some((e) => {
        const from = indexLevel(level).nodes.get(e.from)!;
        const to = indexLevel(level).nodes.get(e.to)!;
        return from.type === 'switch' && switchStage(from) === 0 && to.y > 0.6;
      });
    expect(levels.slice(15, 20).map(crosses)).toEqual([false, false, true, true, true]);
  });

  it('brings in gears at 41, and every gear level needs one turned', () => {
    const hasGears = (l: LevelDef) => l.nodes.some((n) => n.type === 'switch' && n.turns);
    expect(levels.findIndex(hasGears)).toBe(40);
    expect(levels[40]!.meta.prompt).toMatch(/gear/i);
    for (const level of levels.slice(40, 45)) {
      const report = checkLevel(level).report!;
      const turned = report.solution!.map((id) => indexLevel(level).nodes.get(id)!);
      expect(
        turned.some((n) => n.type === 'switch' && n.turns),
        level.id,
      ).toBe(true);
      expect(report.guessOdds!, level.id).toBeGreaterThanOrEqual(10);
    }
  });

  it('brings in keys at 46, where the lock costs extra changes, and carries them across parts from 47', () => {
    const hasLock = (l: LevelDef) => l.nodes.some((n) => n.type === 'lock');
    expect(levels.findIndex(hasLock)).toBe(45);
    expect(levels[45]!.meta.prompt).toMatch(/key/);
    for (const level of levels.slice(45, 50)) {
      // Without the lock, the lane that skips the key would win in fewer changes.
      const open: LevelDef = {
        ...level,
        nodes: level.nodes.filter((n) => n.type !== 'lock'),
        track: level.track
          .map((path) =>
            path.map((id) => (id === 'lock' ? indexLevel(level).trackNext.get(id)! : id)),
          )
          .map((path) => path.filter((id, i) => id !== path[i - 1]))
          .filter((path) => path.length > 1),
      };
      const lockless = checkLevel(open).report!.minChanges!;
      expect(lockless, level.id).toBeLessThan(level.meta.minChanges);
    }
    const staged = levels.slice(46, 50).map((l) => indexLevel(l).checkpoints.length > 0);
    expect(staged).toEqual([true, true, true, true]);
  });

  it('brings in trip plates at 51, and every plate level needs its plates counted', () => {
    const hasTrip = (l: LevelDef) => l.nodes.some((n) => n.type === 'trip');
    expect(levels.findIndex(hasTrip)).toBe(50);
    expect(levels[50]!.meta.prompt).toMatch(/trip plate/i);
    for (const level of levels.slice(50, 55)) {
      const report = checkLevel(level).report!;
      expect(report.parWins, level.id).toHaveLength(1);
      // With the plates taken out, the par position no longer wins.
      const trips = new Set(level.nodes.filter((n) => n.type === 'trip').map((n) => n.id));
      const plain: LevelDef = {
        ...level,
        nodes: level.nodes.filter((n) => !trips.has(n.id)),
        track: level.track.map((path) => path.filter((id) => !trips.has(id))),
      };
      expect(simulateRun(plain, report.parWins[0]!, 1, null).won, level.id).toBe(false);
      const fork = level.nodes.some((n) => n.type === 'junction');
      expect(report.guessOdds!, level.id).toBeGreaterThanOrEqual(fork ? 6 : 10);
    }
  });

  it('asks for two keys from 56: each lock needs its own, and gears join in from 57', () => {
    const keys = (l: LevelDef) => l.nodes.filter((n) => n.type === 'key').length;
    expect(levels.findIndex((l) => keys(l) > 1)).toBe(55);
    expect(levels[55]!.meta.prompt).toMatch(/two keys/i);
    for (const level of levels.slice(55, 60)) {
      const report = checkLevel(level).report!;
      expect(report.parWins, level.id).toHaveLength(1);
      expect(report.guessOdds!, level.id).toBeGreaterThanOrEqual(50);
      // Without either lock, a cheaper win appears: both keys cost changes.
      for (const lock of level.nodes.filter((n) => n.type === 'lock')) {
        const next = indexLevel(level).trackNext.get(lock.id)!;
        const open: LevelDef = {
          ...level,
          nodes: level.nodes.filter((n) => n.id !== lock.id),
          track: level.track
            .map((path) => path.map((id) => (id === lock.id ? next : id)))
            .map((path) => path.filter((id, i) => id !== path[i - 1]))
            .filter((path) => path.length > 1),
        };
        expect(checkLevel(open).report!.minChanges!, `${level.id} ${lock.id}`).toBeLessThan(
          level.meta.minChanges,
        );
      }
    }
    const geared = levels
      .slice(56, 60)
      .map((l) => l.nodes.some((n) => n.type === 'switch' && n.turns));
    expect(geared).toEqual([true, true, true, true]);
  });

  it('gets harder: par grows overall', () => {
    const mins = levels.map((l) => l.meta.minChanges);
    expect(mins.at(-1)).toBeGreaterThan(mins[0]!);
  });
});
