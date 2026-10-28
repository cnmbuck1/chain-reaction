import { indexLevel } from '../engine/graph';
import type { LevelDef, NodeId, SignalEdge } from '../engine/types';
import { flipFraction, pathLength, pointAlong, port, routeWire, type Point } from './geometry';
import { edgeKey } from './timeline';

// Where everything sits on the board, in layout pixels. Pure, so the Pixi renderer and
// the DOM overlays share one source of positions, and it is tested without a renderer.

/** The board's default layout size in CSS pixels. The UI scales it to fit the screen. */
export const BOARD_WIDTH = 360;
export const BOARD_HEIGHT = 400;
const PAD_X = 28;
const PAD_TOP = 28;
/** Room under the lowest row for gate labels. */
const PAD_BOTTOM = 92;

export const boardHeight = (level: LevelDef) => level.boardHeight ?? BOARD_HEIGHT;

/** Where a level's 0..1 coordinates land on the board, in layout pixels. */
export function boardPoint(x: number, y: number, height = BOARD_HEIGHT): Point {
  return {
    x: PAD_X + x * (BOARD_WIDTH - 2 * PAD_X),
    y: PAD_TOP + y * (height - PAD_TOP - PAD_BOTTOM),
  };
}

export interface WireRoute {
  points: Point[];
  edge: SignalEdge;
  /** For NOT wires: where the NOT sits, as a fraction of the route and as a point. */
  flip: { at: number; point: Point } | null;
}

/**
 * Every wire's route on the board, keyed by edge. Laned by the switch it comes from so
 * horizontal runs never overlap. Pure, so overlays can be placed on the same lines.
 */
export function wireRoutes(level: LevelDef): Map<string, WireRoute> {
  const index = indexLevel(level);
  const height = boardHeight(level);
  const at = (id: NodeId) => {
    const n = index.nodes.get(id)!;
    return boardPoint(n.x, n.y, height);
  };
  const routes = new Map<string, WireRoute>();
  // On fork boards the lanes stack, so wires turn just under their switch and drop
  // straight into their gate, keeping horizontal runs clear of the top lane.
  const hasFork = level.nodes.some((n) => n.type === 'junction');
  const flips: Point[] = [];
  for (const edge of level.signalEdges) {
    const from = index.nodes.get(edge.from)!;
    const to = index.nodes.get(edge.to)!;
    const a = at(edge.from);
    const b = at(edge.to);
    const lane = from.type === 'switch' ? index.switchIds.indexOf(from.id) + 1 : 0;
    const start = port(from.type, a, b);
    let end = port(to.type, b, a);
    if (to.type === 'gate') {
      // Several wires into one gate land side by side, so each can be followed.
      const inputs = index.incoming.get(to.id) ?? [];
      const i = inputs.findIndex((e) => e.from === edge.from);
      end = { x: end.x + (i - (inputs.length - 1) / 2) * GATE_INPUT_SPACING, y: end.y };
    }
    let points: Point[];
    if (to.type === 'junction') {
      // Into a fork the wire comes level from the right, clear of the lanes leaving it.
      points = [start, { x: start.x, y: b.y }, { x: b.x + FORK_RADIUS, y: b.y }];
    } else if (hasFork && from.type === 'switch') {
      const bus = start.y + 12 + 8 * lane;
      points =
        Math.abs(start.x - end.x) < 2
          ? [start, end]
          : [start, { x: start.x, y: bus }, { x: end.x, y: bus }, end];
    } else if (Math.abs(start.x - end.x) < GATE_INPUT_SPACING * 1.5 && end.y > start.y) {
      // Nearly straight down: keep the long drop straight and step aside just above the gate.
      points = [start, { x: start.x, y: end.y - 12 }, { x: end.x, y: end.y - 12 }, end];
    } else {
      points = routeWire(start, end, lane);
    }
    let flip: WireRoute['flip'] = null;
    if (edge.invert) {
      // Prefer the wire's last run; if another NOT already sits there, walk back up it.
      const preferred = flipFraction(points);
      const length = pathLength(points);
      const tries = [0, 1, 2, 3].map((k) =>
        Math.max(0.05, preferred - (k * NOT_CLEARANCE) / length),
      );
      const at = tries.find((f) => !flips.some((p) => notsOverlap(p, pointAlong(points, f))));
      const f = at ?? preferred;
      flip = { at: f, point: pointAlong(points, f) };
      flips.push(flip.point);
    }
    routes.set(edgeKey(edge.from, edge.to), { points, edge, flip });
  }
  return routes;
}

/**
 * The track between two linked nodes. Links at different heights bend at a right angle:
 * out of a fork they turn first, so lanes split cleanly, and out of a checkpoint they
 * drop first, down to the next part; elsewhere they run level first.
 */
export function trackRoute(level: LevelDef, from: NodeId, to: NodeId): Point[] {
  const index = indexLevel(level);
  const height = boardHeight(level);
  const a = boardPoint(index.nodes.get(from)!.x, index.nodes.get(from)!.y, height);
  const b = boardPoint(index.nodes.get(to)!.x, index.nodes.get(to)!.y, height);
  if (Math.abs(a.y - b.y) < 1 || Math.abs(a.x - b.x) < 1) return [a, b];
  const turnFirst = ['junction', 'checkpoint'].includes(index.nodes.get(from)!.type);
  const corner = turnFirst ? { x: a.x, y: b.y } : { x: b.x, y: a.y };
  return [a, corner, b];
}

/**
 * Where each part of a staged board ends, as a height on the board: just above the
 * highest switch or power source of the next part. One per checkpoint, in order.
 */
export function partDividers(level: LevelDef): number[] {
  const index = indexLevel(level);
  const height = boardHeight(level);
  return index.checkpoints.map((_, stage) => {
    const next = level.nodes.filter(
      (n) =>
        (n.type === 'switch' && (n.stage ?? 0) === stage + 1) ||
        (n.type === 'source' &&
          (index.outgoing.get(n.id) ?? []).some((e) => {
            const to = index.nodes.get(e.to);
            return to?.type === 'switch' && (to.stage ?? 0) === stage + 1;
          })),
    );
    const top = Math.min(
      ...next.map(
        (n) =>
          boardPoint(n.x, n.y, height).y -
          (n.type === 'source' ? SOURCE_CLEARANCE : SWITCH_CLEARANCE),
      ),
    );
    return Math.round(top);
  });
}
/** The slice of the board each part fills the screen with: from its seam to the next one. */
export interface PartView {
  top: number;
  height: number;
}

/** One view per part; a board without parts has one view, the whole board. */
export function partViews(level: LevelDef): PartView[] {
  const edges = [0, ...partDividers(level), boardHeight(level)];
  return edges.slice(1).map((bottom, i) => ({ top: edges[i]!, height: bottom - edges[i]! }));
}

/** Room kept above a part's highest power source or switch, for its divider. */
const SOURCE_CLEARANCE = 44;
const SWITCH_CLEARANCE = 42;

/** Which exit each fork sends the ball to, for the given switch signals. */
export function forkExits(
  level: LevelDef,
  signals: ReadonlyMap<NodeId, boolean>,
): Map<NodeId, NodeId> {
  const exits = new Map<NodeId, NodeId>();
  for (const node of level.nodes) {
    if (node.type !== 'junction') continue;
    const edge = level.signalEdges.find((e) => e.to === node.id);
    const live = edge ? (signals.get(edge.from) ?? false) !== (edge.invert ?? false) : false;
    exits.set(node.id, live ? node.whenTrue : node.whenFalse);
  }
  return exits;
}
/** Radius of a fork's turntable. */
export const FORK_RADIUS = 17;
const GATE_INPUT_SPACING = 10;

/** A NOT part's footprint, with a little air around it. */
const NOT_SIZE = { w: 38, h: 22 };
const NOT_CLEARANCE = 26;
const notsOverlap = (a: Point, b: Point) =>
  Math.abs(a.x - b.x) < NOT_SIZE.w && Math.abs(a.y - b.y) < NOT_SIZE.h;
