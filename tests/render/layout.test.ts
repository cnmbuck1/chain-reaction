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

const byName = (name: string) => levels.find((l) => l.name === name)!;
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
    expect(boardHeight(byName('Fork in the Road'))).toBeGreaterThan(BOARD_HEIGHT);
    expect(boardPoint(0.5, 1, 470).y).toBeGreaterThan(boardPoint(0.5, 1).y);
  });

  it('marks a NOT only on inverted wires, partway along them', () => {
    const level = byName('Flip Side');
    const routes = wireRoutes(level);
    expect(routes.get('a>g1')!.flip!.at).toBeGreaterThan(0);
    expect(routes.get('a>g1')!.flip!.at).toBeLessThan(1);
    expect(routes.get('b>g2')!.flip).toBeNull();
  });

  it('lands several wires into one gate side by side', () => {
    const routes = wireRoutes(byName('Double Negative'));
    const a = routes.get('a>g1')!.points.at(-1)!;
    const b = routes.get('b>g1')!.points.at(-1)!;
    expect(a.y).toBe(b.y);
    expect(Math.abs(a.x - b.x)).toBeGreaterThanOrEqual(8);
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
    const level = byName('Switchyard');
    expect(forkExits(level, signalsOf(level)).get('fork')).toBe('g2');
    expect(forkExits(level, signalsOf(level, { f: false })).get('fork')).toBe('g1');
  });
});
