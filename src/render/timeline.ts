import type { NodeId, RunEvent } from '../engine/types';

// Turns a RUN's event list into timed cues, and samples those cues into what the
// board should show at a moment in time. Pure, so it is tested without a renderer.
// The engine has already decided the outcome; this only paces its playback.

export interface Timing {
  /** Time for power to travel along one wire. */
  wire: number;
  /** Delay before the next wire starts; less than `wire` so pulses overlap. */
  wireStagger: number;
  gate: number;
  ballSegment: number;
  /** Bump at a closed gate, or flourish at the goal. */
  finish: number;
  /** After a win: light runs back along the ball's route and through every open gate. */
  circuit: number;
}

export const NORMAL_TIMING: Timing = {
  wire: 260,
  wireStagger: 160,
  gate: 340,
  ballSegment: 560,
  finish: 700,
  circuit: 800,
};

/** Reduced motion: everything lands at once. */
export const INSTANT_TIMING: Timing = {
  wire: 0,
  wireStagger: 0,
  gate: 0,
  ballSegment: 0,
  finish: 0,
  circuit: 0,
};

export const edgeKey = (from: NodeId, to: NodeId) => `${from}>${to}`;

export type Cue =
  | { kind: 'wire'; at: number; dur: number; from: NodeId; to: NodeId; value: boolean }
  | { kind: 'gate'; at: number; dur: number; gateId: NodeId; open: boolean; from: number }
  /** The switch and source signals from here on; a trip plate starts a new picture. */
  | { kind: 'power'; at: number; dur: number; signals: ReadonlyMap<NodeId, boolean> }
  | { kind: 'trip'; at: number; dur: number; nodeId: NodeId; switchId: NodeId }
  | { kind: 'ball'; at: number; dur: number; from: NodeId; to: NodeId }
  | {
      kind: 'finish';
      at: number;
      dur: number;
      result: FinishResult;
      nodeId: NodeId;
    }
  | { kind: 'circuit'; at: number; dur: number; links: readonly (readonly [NodeId, NodeId])[] };

/** How a run ended, as the board shows it. */
export type FinishResult = 'goal' | 'blocked' | 'deadEnd' | 'checkpoint' | 'locked';

const FINISH: Partial<Record<RunEvent['type'], FinishResult>> = {
  ballGoal: 'goal',
  ballBlocked: 'blocked',
  ballDeadEnd: 'deadEnd',
  ballCheckpoint: 'checkpoint',
  ballLocked: 'locked',
};

export interface Timeline {
  cues: Cue[];
  duration: number;
  /** Where the ball starts; known from the first move, or the blocked gate's approach. */
  ballStart: NodeId | null;
}

export function buildTimeline(events: readonly RunEvent[], timing: Timing): Timeline {
  const cues: Cue[] = [];
  let cursor = 0;
  const wireShown = new Map<string, boolean>();
  const gateShown = new Map<NodeId, boolean>();

  // One picture of power: wires pulse out, then gates swing. After a trip plate, only what
  // changed moves.
  const power = (batch: readonly RunEvent[]) => {
    const first = wireShown.size === 0 && gateShown.size === 0;
    const signals = new Map<NodeId, boolean>();
    for (const e of batch) if (e.type === 'signal') signals.set(e.nodeId, e.value);
    cues.push({ kind: 'power', at: cursor, dur: 0, signals });
    let at = cursor;
    let wiresEnd = cursor;
    for (const e of batch) {
      if (e.type !== 'wire') continue;
      const key = edgeKey(e.from, e.to);
      if (!first && wireShown.get(key) === e.value) continue;
      wireShown.set(key, e.value);
      cues.push({ kind: 'wire', at, dur: timing.wire, from: e.from, to: e.to, value: e.value });
      wiresEnd = Math.max(wiresEnd, at + timing.wire);
      if (e.value) at += timing.wireStagger;
    }
    cursor = wiresEnd;
    let swung = false;
    for (const e of batch) {
      if (e.type !== 'gate' || gateShown.get(e.gateId) === e.open) continue;
      const was = gateShown.get(e.gateId);
      const from = was === undefined ? GATE_NEUTRAL : was ? 1 : 0;
      gateShown.set(e.gateId, e.open);
      cues.push({
        kind: 'gate',
        at: cursor,
        dur: timing.gate,
        gateId: e.gateId,
        open: e.open,
        from,
      });
      swung = true;
    }
    if (swung) cursor += timing.gate;
  };

  let ballStart: NodeId | null = null;
  const links: [NodeId, NodeId][] = [];
  let batch: RunEvent[] = [];
  for (const e of events) {
    if (e.type === 'signal' || e.type === 'wire' || e.type === 'gate') {
      batch.push(e);
      continue;
    }
    if (batch.length > 0) power(batch);
    batch = [];
    if (e.type === 'ballMove') {
      links.push([e.from, e.to]);
      ballStart ??= e.from;
      cues.push({ kind: 'ball', at: cursor, dur: timing.ballSegment, from: e.from, to: e.to });
      cursor += timing.ballSegment;
    } else if (e.type === 'ballTrip') {
      cues.push({
        kind: 'trip',
        at: cursor,
        dur: timing.gate,
        nodeId: e.nodeId,
        switchId: e.switchId,
      });
      cursor += timing.gate;
    } else if (
      e.type === 'ballBlocked' ||
      e.type === 'ballGoal' ||
      e.type === 'ballDeadEnd' ||
      e.type === 'ballCheckpoint' ||
      e.type === 'ballLocked'
    ) {
      const result = FINISH[e.type]!;
      const nodeId =
        e.type === 'ballBlocked' ? e.gateId : e.type === 'ballGoal' ? e.goalId : e.nodeId;
      cues.push({ kind: 'finish', at: cursor, dur: timing.finish, result, nodeId });
      cursor += timing.finish;
      if (result === 'goal') {
        cues.push({ kind: 'circuit', at: cursor, dur: timing.circuit, links });
        cursor += timing.circuit;
      }
    }
  }
  if (batch.length > 0) power(batch);
  return { cues, duration: cursor, ballStart };
}

export interface VisualState {
  /** Glow progress 0..1 along each energized wire (only wires carrying TRUE appear). */
  wires: Map<string, number>;
  /** How far power has travelled along every wire, live or not. NOT wires light by this. */
  reached: Map<string, number>;
  /** Gate openness 0 (closed) .. 1 (open). Gates not yet resolved are absent. */
  gates: Map<NodeId, number>;
  /** Ball position: on a node, or partway along a track link. */
  ball: { from: NodeId; to: NodeId; p: number } | { at: NodeId } | null;
  finish: { result: FinishResult; nodeId: NodeId; p: number } | null;
  /** After a win, how far the light has run along the ball's route (0..1). */
  circuit: { links: readonly (readonly [NodeId, NodeId])[]; p: number } | null;
  /** Switch and source signals for the picture on show; null before power starts. */
  signals: ReadonlyMap<NodeId, boolean> | null;
  /** Switches a trip plate has flipped so far this run. */
  flipped: ReadonlySet<NodeId>;
  /** How far each trip plate the ball has rolled over is pressed in (0..1). */
  trips: Map<NodeId, number>;
}

/** Gate openness before a run resolves it. */
export const GATE_NEUTRAL = 0;

const progress = (cue: Cue, t: number) =>
  cue.dur <= 0 ? (t >= cue.at ? 1 : 0) : Math.min(1, Math.max(0, (t - cue.at) / cue.dur));

const easeInOut = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);

export function sampleTimeline(timeline: Timeline, t: number): VisualState {
  const state: VisualState = {
    wires: new Map(),
    reached: new Map(),
    gates: new Map(),
    ball: timeline.ballStart ? { at: timeline.ballStart } : null,
    finish: null,
    circuit: null,
    signals: null,
    flipped: new Set(),
    trips: new Map(),
  };
  const flipped = new Set<NodeId>();
  for (const cue of timeline.cues) {
    if (t < cue.at) continue;
    const p = progress(cue, t);
    switch (cue.kind) {
      case 'wire': {
        const key = edgeKey(cue.from, cue.to);
        state.reached.set(key, Math.max(state.reached.get(key) ?? 0, p));
        if (cue.value) state.wires.set(key, p);
        else state.wires.delete(key);
        break;
      }
      case 'gate': {
        const target = cue.open ? 1 : 0;
        state.gates.set(cue.gateId, cue.from + (target - cue.from) * easeInOut(p));
        break;
      }
      case 'power':
        state.signals = cue.signals;
        break;
      case 'trip':
        if (flipped.has(cue.switchId)) flipped.delete(cue.switchId);
        else flipped.add(cue.switchId);
        state.trips.set(cue.nodeId, p);
        break;
      case 'ball':
        state.ball = p >= 1 ? { at: cue.to } : { from: cue.from, to: cue.to, p };
        break;
      case 'finish':
        state.finish = { result: cue.result, nodeId: cue.nodeId, p };
        break;
      case 'circuit':
        state.circuit = { links: cue.links, p };
        break;
    }
  }
  state.flipped = flipped;
  return state;
}
