import { describe, expect, it } from 'vitest';
import { replay } from '../../src/engine/reducer';
import { simulateRun } from '../../src/engine/simulate';
import { solve } from '../../src/engine/solver';
import type { GameAction, LevelDef, LevelNode } from '../../src/engine/types';
import { validateLevel } from '../../src/levels/schema';
import { buildTimeline, INSTANT_TIMING, sampleTimeline } from '../../src/render/timeline';
import { explainRun } from '../../src/ui/describe';
import { ball, gate, goal, junction, makeLevel, source, sw, deadEnd } from '../fixtures';

const toggle = (switchId: string): GameAction => ({ type: 'toggle', switchId });
const run: GameAction = { type: 'run' };
const trip = (id: string, flips: string): LevelNode => ({
  id,
  type: 'trip',
  flips,
  label: 'Plate',
  x: 0.5,
  y: 0.5,
});

/** Gate 1 needs A ON; then the plate flips A, and gate 2 needs A OFF. */
const flipped = (g2Required: boolean): LevelDef =>
  makeLevel({
    id: 'flipped',
    nodes: [source(), sw('a'), gate('g1'), trip('t', 'a'), gate('g2', g2Required), ball(), goal()],
    signalEdges: [
      { from: 'source', to: 'a' },
      { from: 'a', to: 'g1' },
      { from: 'a', to: 'g2' },
    ],
    track: [['ball', 'g1', 't', 'g2', 'goal']],
  });

/** The plate flips F before the fork: F ON sends the ball OFF's way, to the goal. */
const turned: LevelDef = makeLevel({
  id: 'turned',
  nodes: [
    source(),
    sw('f'),
    trip('t', 'f'),
    junction('fork', 'end', 'goal'),
    deadEnd('end'),
    ball(),
    goal(),
  ],
  signalEdges: [
    { from: 'source', to: 'f' },
    { from: 'f', to: 'fork' },
  ],
  track: [['ball', 't', 'fork']],
});

describe('trip plates', () => {
  it('flip a switch as the ball rolls over, and the gates after it change', () => {
    const level = flipped(false);
    const result = simulateRun(level, { a: true }, 1);
    expect(result.won).toBe(true);
    expect(result.events).toContainEqual({ type: 'ballTrip', nodeId: 't', switchId: 'a' });
    expect(simulateRun(level, { a: false }, 1).outcome).toEqual({ kind: 'blocked', gateId: 'g1' });
    expect(solve(level).solution).toEqual(['a']);
  });

  it('turn a fork the ball has not reached yet', () => {
    expect(simulateRun(turned, { f: true }, 1).won).toBe(true);
    expect(simulateRun(turned, { f: false }, 1).outcome).toEqual({
      kind: 'deadEnd',
      nodeId: 'end',
    });
  });

  it('spring back when the run ends: the switch stays where the player set it', () => {
    const level = flipped(false);
    const { state } = replay(level, [toggle('a'), run]);
    expect(state.phase).toBe('won');
    expect(state.switches.a).toBe(true);
  });

  it('are explained from the picture after the flip', () => {
    const level = flipped(true);
    const result = simulateRun(level, { a: true }, 1);
    expect(result.outcome).toEqual({ kind: 'blocked', gateId: 'g2' });
    expect(explainRun(level, result)).toBe(
      'Stopped at g2: it needs power but got no power. On the way, a trip plate flipped a.',
    );
  });

  it('replay as a second picture: only what changed moves, and the switch shows flipped', () => {
    const level = flipped(false);
    const timeline = buildTimeline(simulateRun(level, { a: true }, 1).events, INSTANT_TIMING);
    const g2 = timeline.cues.filter((c) => c.kind === 'gate' && c.gateId === 'g2');
    expect(g2).toEqual([
      expect.objectContaining({ open: false, from: 0 }),
      expect.objectContaining({ open: true, from: 0 }),
    ]);
    // Gate 1 swings shut behind the ball once A goes off.
    expect(timeline.cues.filter((c) => c.kind === 'gate' && c.gateId === 'g1')).toEqual([
      expect.objectContaining({ open: true, from: 0 }),
      expect.objectContaining({ open: false, from: 1 }),
    ]);
    const end = sampleTimeline(timeline, timeline.duration);
    expect([...end.flipped]).toEqual(['a']);
    expect(end.trips.get('t')).toBe(1);
    expect(end.signals?.get('a')).toBe(false);
    expect(end.wires.has('a>g1')).toBe(false);
  });

  it('are checked: a plate flips a switch', () => {
    const codes = (level: LevelDef) => validateLevel(level).map((e) => e.code);
    expect(codes(flipped(false))).toEqual([]);
    const wrong = {
      ...turned,
      nodes: turned.nodes.map((n) => (n.id === 't' ? trip('t', 'fork') : n)),
    };
    expect(codes(wrong)).toContain('BAD_TRIP');
  });
});
