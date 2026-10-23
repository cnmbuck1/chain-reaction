// Board geometry: where nodes sit in pixels, where wires attach, and how they route.
// Pure functions so routing is tested without a renderer.

export interface Point {
  x: number;
  y: number;
}

export type NodeKind = 'source' | 'switch' | 'gate' | 'junction' | 'ballStart' | 'goal' | 'deadEnd';

/** Half-height of the switch plate and the gate housing, in CSS pixels. */
export const SWITCH_HALF_HEIGHT = 28;
export const GATE_HALF_HEIGHT = 20;
export const SOURCE_RADIUS = 20;

/** Where a wire leaves or enters a node, on the side facing the other end. */
export function port(kind: NodeKind, at: Point, toward: Point): Point {
  const down = toward.y >= at.y;
  switch (kind) {
    case 'switch':
      return { x: at.x, y: at.y + (down ? SWITCH_HALF_HEIGHT : -SWITCH_HALF_HEIGHT) };
    case 'source':
      return { x: at.x, y: at.y + (down ? SOURCE_RADIUS : -SOURCE_RADIUS) };
    case 'gate':
      return { x: at.x, y: at.y - GATE_HALF_HEIGHT - 12 };
    default:
      return at;
  }
}

/**
 * Orthogonal route: down from the start, across at a "bus" height, down into the end.
 * `lane` (0..n) staggers the crossing height so wires from different switches never
 * share a horizontal run.
 */
export function routeWire(a: Point, b: Point, lane = 0): Point[] {
  if (Math.abs(a.x - b.x) < 2) return [a, b];
  const t = Math.min(0.8, 0.42 + 0.14 * (lane % 3));
  const mid = a.y + (b.y - a.y) * t;
  return [a, { x: a.x, y: mid }, { x: b.x, y: mid }, b];
}

export function pathLength(points: readonly Point[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(points[i]!.x - points[i - 1]!.x, points[i]!.y - points[i - 1]!.y);
  }
  return total;
}

/** The point a fraction `p` (0..1) of the way along a polyline. */
export function pointAlong(points: readonly Point[], p: number): Point {
  return partialPath(points, p).at(-1)!;
}

/** The polyline from its start to a fraction `p` (0..1) of its length. */
export function partialPath(points: readonly Point[], p: number): Point[] {
  const target = pathLength(points) * Math.min(1, Math.max(0, p));
  const out: Point[] = [points[0]!];
  let walked = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    if (walked + seg >= target) {
      const f = seg === 0 ? 0 : (target - walked) / seg;
      out.push({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f });
      return out;
    }
    walked += seg;
    out.push(b);
  }
  return out;
}
