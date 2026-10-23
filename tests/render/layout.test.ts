import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/engine/evaluate';
import { indexLevel } from '../../src/engine/graph';
import { initialSwitches } from '../../src/engine/reducer';
import { flipFraction, pathLength, pointAlong, slicePath } from '../../src/render/geometry';
import {
  BOARD_HEIGHT,
  boardHeight,
  boardPoint,
  forkExits,
  trackRoute,
  wireRoutes,
} from '../../src/render/layout';
import { levels } from '../../src/levels';
import { makeLevel } from '../fixtures';

const byName = (name: string) => levels.find((l) => l.name === name)!;

/** NOT wires wait until after level 20, so the layout tests build their own board. */
const withNot = makeLevel({
  nodes: [
    { id: 'source', type: 'source', x: 0.5, y: 0.05 },
    { id: 'a', type: 'switch', x: 0.3, y: 0.35, initialOn: true },
    { id: 'b', type: 'switch', x: 0.7, y: 0.35, initialOn: false },
    { id: 'g1', type: 'gate', x: 0.3, y: 0.85, combine: 'single', requiredSignal: true },
    { id: 'g2', type: 'gate', x: 0.5, y: 0.85, combine: 'single', requiredSignal: true },
    { id: 'g3', type: 'gate', x: 0.7, y: 0.85, combine: 'and', requiredSignal: true },
    { id: 'ball', type: 'ballStart', x: 0.05, y: 0.85 },
    { id: 'goal', type: 'goal', x: 0.95, y: 0.85 },
  ],
  signalEdges: [
    { from: 'source', to: 'a' },
    { from: 'source', to: 'b' },
    { from: 'a', to: 'g1', invert: true },
    { from: 'b', to: 'g2' },
    { from: 'a', to: 'g3', invert: true },
    { from: 'b', to: 'g3', invert: true },
  ],
  track: [['ball', 'g1', 'g2', 'g3', 'goal']],
});
const signalsOf = (level: (typeof levels)[number], on: Record<string, boolean> = {}) =>
  evaluate(indexLevel(level), { ...initialSwitches(level), ...on }).signals;

describe('path slicing', () => {
  const path = [
    { x: 0, y: 0 },
    { x: 0, y: 40 },
    { x: 60, y: 40 },
  ];

  it('takes the part of a path between two fractions', () => {
    const middle = slicePath(path, 0.25, 0.75);
    expect(middle[0]).toEqual({ x: 0, y: 25 });
    expect(middle.at(-1)).toEqual({ x: 35, y: 40 });
    expect(pathLength(middle)).toBeCloseTo(50);
  });

  it('is empty when the range is', () => {
    expect(slicePath(path, 0.6, 0.6)).toEqual([]);
  });

  it('puts a NOT halfway along the last run', () => {
    expect(pointAlong(path, flipFraction(path))).toEqual({ x: 30, y: 40 });
  });
});

describe('board layout', () => {
  it('maps level coordinates inside the padding, with taller boards for forks', () => {
    expect(boardPoint(0, 0)).toEqual({ x: 28, y: 28 });
    expect(boardPoint(1, 1).x).toBe(332);
    expect(boardHeight(byName('First Spark'))).toBe(BOARD_HEIGHT);
    expect(boardHeight(withNot)).toBe(BOARD_HEIGHT);
    expect(boardHeight(byName('Fork in the Road'))).toBeGreaterThan(BOARD_HEIGHT);
    expect(boardPoint(0.5, 1, 470).y).toBeGreaterThan(boardPoint(0.5, 1).y);
  });

  it('marks a NOT only on inverted wires, partway along them', () => {
    const routes = wireRoutes(withNot);
    expect(routes.get('a>g1')!.flip!.at).toBeGreaterThan(0);
    expect(routes.get('a>g1')!.flip!.at).toBeLessThan(1);
    expect(routes.get('b>g2')!.flip).toBeNull();
  });

  it('lands several wires into one gate side by side, and keeps their NOTs apart', () => {
    const routes = wireRoutes(withNot);
    const a = routes.get('a>g3')!;
    const b = routes.get('b>g3')!;
    expect(a.points.at(-1)!.y).toBe(b.points.at(-1)!.y);
    expect(Math.abs(a.points.at(-1)!.x - b.points.at(-1)!.x)).toBeGreaterThanOrEqual(8);
    const [p, q] = [a.flip!.point, b.flip!.point];
    expect(Math.abs(p.x - q.x) >= 38 || Math.abs(p.y - q.y) >= 22).toBe(true);
  });

  it('brings a fork wire in level from the right', () => {
    const level = byName('Fork in the Road');
    const fork = level.nodes.find((n) => n.type === 'junction')!;
    const at = boardPoint(fork.x, fork.y, boardHeight(level));
    const points = wireRoutes(level).get('f>fork')!.points;
    const [beforeEnd, end] = points.slice(-2);
    expect(end!.y).toBe(at.y);
    expect(beforeEnd!.y).toBe(at.y);
    expect(end!.x).toBeGreaterThan(at.x);
  });

  it('bends fork lanes at a right angle, turning first out of the fork', () => {
    const level = byName('Fork in the Road');
    const [a, corner, b] = trackRoute(level, 'fork', 'g1');
    expect(corner!.x).toBe(a!.x);
    expect(corner!.y).toBe(b!.y);
    const [c, merge, d] = trackRoute(level, 'g1', 'goal');
    expect(merge!.y).toBe(c!.y);
    expect(merge!.x).toBe(d!.x);
    expect(trackRoute(level, 'ball', 'fork')).toHaveLength(2);
  });
});

describe('fork exits', () => {
  it('follow the fork wire: power picks the ON lane', () => {
    const level = byName('Fork in the Road');
    expect(forkExits(level, signalsOf(level)).get('fork')).toBe('g2');
    expect(forkExits(level, signalsOf(level, { f: true })).get('fork')).toBe('g1');
  });

  it('read a NOT on the fork wire', () => {
    const base = byName('Fork in the Road');
    const level = {
      ...base,
      signalEdges: base.signalEdges.map((e) => (e.to === 'fork' ? { ...e, invert: true } : e)),
    };
    expect(forkExits(level, signalsOf(level)).get('fork')).toBe('g1');
    expect(forkExits(level, signalsOf(level, { f: true })).get('fork')).toBe('g2');
  });
});
