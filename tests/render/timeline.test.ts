import { describe, expect, it } from 'vitest';
import { simulateRun } from '../../src/engine/simulate';
import {
  buildTimeline,
  edgeKey,
  INSTANT_TIMING,
  NORMAL_TIMING,
  sampleTimeline,
} from '../../src/render/timeline';
import { tradeoff } from '../fixtures';

const win = simulateRun(tradeoff, { a: true, b: false }, 1);
const blocked = simulateRun(tradeoff, { a: true, b: true }, 1);

describe('animation timeline', () => {
  it('orders wires, then gates, then the ball, then the finish, then the win circuit', () => {
    const { cues } = buildTimeline(win.events, NORMAL_TIMING);
    const lastWire = Math.max(...cues.filter((c) => c.kind === 'wire').map((c) => c.at + c.dur));
    const gates = cues.filter((c) => c.kind === 'gate');
    const firstBall = cues.find((c) => c.kind === 'ball')!;
    expect(gates.every((g) => g.at >= lastWire)).toBe(true);
    expect(gates.every((g) => g.at + g.dur <= firstBall.at)).toBe(true);
    expect(cues.at(-2)).toMatchObject({ kind: 'finish', result: 'goal', nodeId: 'goal' });
    expect(cues.at(-1)).toMatchObject({ kind: 'circuit' });
  });

  it('lights the win circuit along the route the ball took', () => {
    const timeline = buildTimeline(win.events, NORMAL_TIMING);
    const moves = win.events.flatMap((e) => (e.type === 'ballMove' ? [[e.from, e.to]] : []));
    const circuit = timeline.cues.find((c) => c.kind === 'circuit')!;
    expect(circuit.kind === 'circuit' && circuit.links).toEqual(moves);
    expect(sampleTimeline(timeline, circuit.at - 1).circuit).toBeNull();
    expect(sampleTimeline(timeline, timeline.duration).circuit?.p).toBe(1);
  });

  it('adds no win circuit to a miss', () => {
    const { cues } = buildTimeline(blocked.events, NORMAL_TIMING);
    expect(cues.some((c) => c.kind === 'circuit')).toBe(false);
  });

  it('skipping to the end shows the same frame as playing it out, lit circuit included', () => {
    const normal = buildTimeline(win.events, NORMAL_TIMING);
    const instant = buildTimeline(win.events, INSTANT_TIMING);
    const a = sampleTimeline(normal, normal.duration);
    const b = sampleTimeline(instant, 0);
    expect(a.circuit?.p).toBe(1);
    expect(b.circuit?.p).toBe(1);
    expect(a.ball).toEqual(b.ball);
    expect(a.finish).toEqual(b.finish);
    expect([...a.gates]).toEqual([...b.gates]);
  });

  it('only energized wires glow', () => {
    const timeline = buildTimeline(win.events, NORMAL_TIMING);
    const end = sampleTimeline(timeline, timeline.duration);
    expect(end.wires.get(edgeKey('source', 'a'))).toBe(1);
    expect(end.wires.has(edgeKey('b', 'g2'))).toBe(false);
  });

  it('tracks how far power got along every wire, dark ones too, for NOT wires', () => {
    const timeline = buildTimeline(win.events, NORMAL_TIMING);
    const end = sampleTimeline(timeline, timeline.duration);
    expect(end.reached.get(edgeKey('b', 'g2'))).toBe(1);
    expect(sampleTimeline(timeline, 0).reached.get(edgeKey('source', 'a'))).toBe(0);
  });

  it('the final frame matches the engine outcome', () => {
    const timeline = buildTimeline(blocked.events, NORMAL_TIMING);
    const end = sampleTimeline(timeline, timeline.duration);
    expect(end.gates.get('g1')).toBe(1);
    expect(end.gates.get('g2')).toBe(0);
    expect(end.ball).toEqual({ at: 'g2' });
    expect(end.finish).toMatchObject({ result: 'blocked', nodeId: 'g2', p: 1 });
  });

  it('starts with the ball at the start and gates unresolved', () => {
    const start = sampleTimeline(buildTimeline(win.events, NORMAL_TIMING), 0);
    expect(start.ball).toEqual({ at: 'ball' });
    expect(start.gates.size).toBe(0);
    expect(start.finish).toBeNull();
  });

  it('moves the ball partway along a link mid-segment', () => {
    const timeline = buildTimeline(win.events, NORMAL_TIMING);
    const first = timeline.cues.find((c) => c.kind === 'ball')!;
    const mid = sampleTimeline(timeline, first.at + first.dur / 2);
    expect(mid.ball).toEqual({ from: 'ball', to: 'g1', p: 0.5 });
  });

  it('reduced motion lands on the same final frame with zero duration', () => {
    const instant = buildTimeline(blocked.events, INSTANT_TIMING);
    const normal = buildTimeline(blocked.events, NORMAL_TIMING);
    expect(instant.duration).toBe(0);
    expect(sampleTimeline(instant, 0)).toEqual(sampleTimeline(normal, normal.duration));
  });
});
