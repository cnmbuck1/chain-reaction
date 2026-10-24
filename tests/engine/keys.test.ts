import { describe, expect, it } from 'vitest';
import { replay } from '../../src/engine/reducer';
import { simulateRun } from '../../src/engine/simulate';
import { solve } from '../../src/engine/solver';
import type { GameAction, LevelDef, LevelNode } from '../../src/engine/types';
import { validateLevel } from '../../src/levels/schema';
import { buildTimeline, INSTANT_TIMING } from '../../src/render/timeline';
import { explainRun } from '../../src/ui/describe';
import {
  ball,
  checkpoint,
  gate,
  goal,
  junction,
  makeLevel,
  partSwitch,
  source,
  sw,
} from '../fixtures';

const toggle = (switchId: string): GameAction => ({ type: 'toggle', switchId });
const run: GameAction = { type: 'run' };
const at = { x: 0.5, y: 0.5 };
const key = (id: string): LevelNode => ({ id, type: 'key', label: 'Key', ...at });
const lock = (id: string, keyId: string): LevelNode => ({
  id,
  type: 'lock',
  key: keyId,
  label: 'Lock',
  ...at,
});

/** F picks the lane: ON goes straight to the lock, OFF passes the key first. */
const forked: LevelDef = makeLevel({
  id: 'forked',
  nodes: [
    source(),
    sw('f', true),
    junction('fork', 'lock', 'k'),
    key('k'),
    lock('lock', 'k'),
    ball(),
    goal(),
  ],
  signalEdges: [
    { from: 'source', to: 'f' },
    { from: 'f', to: 'fork' },
  ],
  track: [
    ['ball', 'fork'],
    ['k', 'lock'],
    ['lock', 'goal'],
  ],
});

/** Part A's fork picks a lane to the checkpoint, one past the key; part B has the lock. */
const carried: LevelDef = makeLevel({
  id: 'carried',
  nodes: [
    source(),
    sw('f', true),
    partSwitch('b', 1),
    junction('fork', 'cp', 'k'),
    key('k'),
    checkpoint('cp', 0),
    gate('g'),
    lock('lock', 'k'),
    ball(),
    goal(),
  ],
  signalEdges: [
    { from: 'source', to: 'f' },
    { from: 'f', to: 'fork' },
    { from: 'source', to: 'b' },
    { from: 'b', to: 'g' },
  ],
  track: [
    ['ball', 'fork'],
    ['k', 'cp'],
    ['cp', 'g', 'lock', 'goal'],
  ],
});

describe('keys and locks', () => {
  it('stop the ball at a lock it has no key for, and say why', () => {
    const result = simulateRun(forked, { f: true }, 1);
    expect(result.outcome).toEqual({ kind: 'locked', nodeId: 'lock' });
    expect(result.keys).toEqual([]);
    expect(explainRun(forked, result)).toMatch(/Lock stopped the ball: it needs Key/);
    const cues = buildTimeline(result.events, INSTANT_TIMING).cues;
    expect(cues.at(-1)).toMatchObject({ kind: 'finish', result: 'locked', nodeId: 'lock' });
  });

  it('let the ball through once it has rolled past the key', () => {
    const result = simulateRun(forked, { f: false }, 1);
    expect(result.won).toBe(true);
    expect(result.keys).toEqual(['k']);
    expect(result.events).toContainEqual({ type: 'ballKey', nodeId: 'k' });
    expect(solve(forked).solution).toEqual(['f']);
  });

  it('carry a key into the next part, and the solver plans for it', () => {
    const { state } = replay(carried, [toggle('f'), run]);
    expect(state.stage).toBe(1);
    expect(state.keys).toEqual(['k']);
    expect(replay(carried, [toggle('f'), run, toggle('b'), run]).state.phase).toBe('won');
    // Clearing part A on the short lane leaves part B locked for good.
    const short = replay(carried, [run, toggle('b'), run]).state;
    expect(short.lastRun!.outcome).toEqual({ kind: 'locked', nodeId: 'lock' });
    expect(solve(carried).solution).toEqual(['f', 'b']);
  });

  it('are dropped by a miss and by Reset', () => {
    const missed = replay(forked, [run]).state;
    expect(missed.keys).toEqual([]);
    const reset = replay(carried, [toggle('f'), run, { type: 'reset' }]).state;
    expect(reset.keys).toEqual([]);
  });

  it('are checked: every lock names a key', () => {
    const codes = (level: LevelDef) => validateLevel(level).map((e) => e.code);
    expect(codes(forked)).toEqual([]);
    const wrong = {
      ...forked,
      nodes: forked.nodes.map((n) => (n.id === 'lock' ? lock('lock', 'fork') : n)),
    };
    expect(codes(wrong)).toContain('BAD_KEY');
  });
});
