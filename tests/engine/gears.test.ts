import { describe, expect, it } from 'vitest';
import { changesUsed, initialState, replay, step, turnsFor } from '../../src/engine/reducer';
import { solve } from '../../src/engine/solver';
import type { GameAction, LevelDef, LevelNode } from '../../src/engine/types';
import { freeMovePlan, withFreeMoves } from '../../src/hints/freeMoves';
import { validateLevel } from '../../src/levels/schema';
import { ball, gate, goal, makeLevel, source, sw } from '../fixtures';

const toggle = (switchId: string): GameAction => ({ type: 'toggle', switchId });
const run: GameAction = { type: 'run' };
const geared = (id: string, turns: string[], initialOn = false): LevelNode => ({
  id,
  type: 'switch',
  initialOn,
  turns,
  x: 0.5,
  y: 0.5,
});

/**
 * A's gear turns B. Gate 1 needs A, gate 2 needs B OFF, gate 3 needs C. Turning A also
 * turns B on, so B has to be turned back by hand: par is 3 (A, B, C), not 2.
 */
const meshed: LevelDef = makeLevel({
  id: 'meshed',
  nodes: [
    source(),
    geared('a', ['b']),
    sw('b'),
    sw('c'),
    gate('g1'),
    gate('g2', false),
    gate('g3'),
    ball(),
    goal(),
  ],
  signalEdges: [
    { from: 'source', to: 'a' },
    { from: 'source', to: 'b' },
    { from: 'source', to: 'c' },
    { from: 'a', to: 'g1' },
    { from: 'b', to: 'g2' },
    { from: 'c', to: 'g3' },
  ],
  track: [['ball', 'g1', 'g2', 'g3', 'goal']],
});

describe('gears', () => {
  it('turn the meshed switch along with the one turned by hand, and undo turns both back', () => {
    const { state } = replay(meshed, [toggle('a')]);
    expect(state.switches).toMatchObject({ a: true, b: true, c: false });
    const undone = step(meshed, state, { type: 'undo' }).state;
    expect(undone.switches).toEqual(initialState(meshed).switches);
  });

  it('turn one step only: a switch turned by hand on its own turns nothing else', () => {
    const { state } = replay(meshed, [toggle('b')]);
    expect(state.switches).toMatchObject({ a: false, b: true });
  });

  it('count the switches turned by hand, not the switches that moved', () => {
    const { state } = replay(meshed, [toggle('a'), toggle('b')]);
    expect(state.switches).toMatchObject({ a: true, b: false });
    expect(turnsFor(meshed, state.switches)).toEqual(['a', 'b']);
    expect(changesUsed(meshed, replay(meshed, [toggle('a')]).state.switches)).toBe(1);
  });

  it('set par by turns, and the solver plays them through to a win', () => {
    const report = solve(meshed);
    expect(report.minChanges).toBe(3);
    expect(report.parWins).toHaveLength(1);
    const actions = report.solution!.map(toggle);
    expect(replay(meshed, [...actions, run]).state.phase).toBe('won');
  });

  it('give hints as turns, which carry the meshed switch along', () => {
    const plan = freeMovePlan(meshed);
    expect(plan[0]!.switchId).toBe('a');
    const hinted = withFreeMoves(meshed, 1);
    const start = initialState(hinted).switches;
    expect(start).toMatchObject({ a: true, b: true });
    expect(hinted.nodes.find((n) => n.id === 'b')).not.toHaveProperty('locked');
    expect(solve(hinted).minChanges).toBe(2);
  });

  it('are checked: another switch, the same part, and no loops', () => {
    const codes = (level: LevelDef) => validateLevel(level).map((e) => e.code);
    expect(codes(meshed)).toEqual([]);
    const loop = {
      ...meshed,
      nodes: meshed.nodes.map((n) => (n.id === 'b' ? geared('b', ['a']) : n)),
    };
    expect(codes(loop)).toContain('BAD_GEAR');
    const self = {
      ...meshed,
      nodes: meshed.nodes.map((n) => (n.id === 'a' ? geared('a', ['a']) : n)),
    };
    expect(codes(self)).toContain('BAD_GEAR');
  });
});
