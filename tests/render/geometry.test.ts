import { describe, expect, it } from 'vitest';
import { partialPath, pathLength, pointAlong, port, routeWire } from '../../src/render/geometry';

describe('wire geometry', () => {
  it('routes straight when the ends line up', () => {
    expect(routeWire({ x: 10, y: 0 }, { x: 10, y: 50 })).toEqual([
      { x: 10, y: 0 },
      { x: 10, y: 50 },
    ]);
  });

  it('routes down, across and down otherwise, staggering lanes', () => {
    const a = { x: 0, y: 0 };
    const b = { x: 100, y: 100 };
    const lane0 = routeWire(a, b, 0);
    const lane1 = routeWire(a, b, 1);
    expect(lane0).toHaveLength(4);
    expect(lane0[1]!.x).toBe(0);
    expect(lane0[2]!.x).toBe(100);
    expect(lane0[1]!.y).toBe(lane0[2]!.y);
    expect(lane1[1]!.y).toBeGreaterThan(lane0[1]!.y);
  });

  it('measures and walks a polyline', () => {
    const path = [
      { x: 0, y: 0 },
      { x: 0, y: 30 },
      { x: 40, y: 30 },
    ];
    expect(pathLength(path)).toBe(70);
    expect(pointAlong(path, 0.5)).toEqual({ x: 5, y: 30 });
    expect(partialPath(path, 0)).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: 0 },
    ]);
    expect(partialPath(path, 1).at(-1)).toEqual({ x: 40, y: 30 });
  });

  it('attaches wires to the side of a node facing the other end', () => {
    expect(port('switch', { x: 0, y: 100 }, { x: 0, y: 200 }).y).toBeGreaterThan(100);
    expect(port('switch', { x: 0, y: 100 }, { x: 0, y: 0 }).y).toBeLessThan(100);
    expect(port('gate', { x: 0, y: 100 }, { x: 0, y: 0 }).y).toBeLessThan(100);
  });
});
