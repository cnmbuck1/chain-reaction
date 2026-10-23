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
}

export const NORMAL_TIMING: Timing = {
  wire: 260,
  wireStagger: 160,
  gate: 340,
  ballSegment: 560,
  finish: 700,
};

/** Reduced motion: everything lands at once. */
export const INSTANT_TIMING: Timing = {
  wire: 0,
  wireStagger: 0,
  gate: 0,
  ballSegment: 0,
  finish: 0,
};

export const edgeKey = (from: NodeId, to: NodeId) => `${from}>${to}`;

export type Cue =
  | { kind: 'wire'; at: number; dur: number; from: NodeId; to: NodeId; value: boolean }
  | { kind: 'gate'; at: number; dur: number; gateId: NodeId; open: boolean }
  | { kind: 'ball'; at: number; dur: number; from: NodeId; to: NodeId }
  | {
      kind: 'finish';
      at: number;
      dur: number;
      result: 'goal' | 'blocked' | 'deadEnd';
      nodeId: NodeId;
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
  let wiresEnd = 0;
  for (const e of events) {
    if (e.type !== 'wire') continue;
    cues.push({
      kind: 'wire',
      at: cursor,
      dur: timing.wire,
      from: e.from,
      to: e.to,
      value: e.value,
    });
    wiresEnd = Math.max(wiresEnd, cursor + timing.wire);
    if (e.value) cursor += timing.wireStagger;
  }
  cursor = wiresEnd;

  const gates = events.filter((e) => e.type === 'gate');
  for (const e of gates) {
    cues.push({ kind: 'gate', at: cursor, dur: timing.gate, gateId: e.gateId, open: e.open });
  }
  if (gates.length > 0) cursor += timing.gate;

  let ballStart: NodeId | null = null;
  for (const e of events) {
    if (e.type === 'ballMove') {
      ballStart ??= e.from;
      cues.push({ kind: 'ball', at: cursor, dur: timing.ballSegment, from: e.from, to: e.to });
      cursor += timing.ballSegment;
    } else if (e.type === 'ballBlocked' || e.type === 'ballGoal' || e.type === 'ballDeadEnd') {
      const result =
        e.type === 'ballBlocked' ? 'blocked' : e.type === 'ballGoal' ? 'goal' : 'deadEnd';
      const nodeId =
        e.type === 'ballBlocked' ? e.gateId : e.type === 'ballGoal' ? e.goalId : e.nodeId;
      cues.push({ kind: 'finish', at: cursor, dur: timing.finish, result, nodeId });
      cursor += timing.finish;
    }
  }
  return { cues, duration: cursor, ballStart };
}

export interface VisualState {
  /** Glow progress 0..1 along each energized wire (only wires carrying TRUE appear). */
  wires: Map<string, number>;
  /** Gate openness 0 (closed) .. 1 (open). Gates not yet resolved are absent. */
  gates: Map<NodeId, number>;
  /** Ball position: on a node, or partway along a track link. */
  ball: { from: NodeId; to: NodeId; p: number } | { at: NodeId } | null;
  finish: { result: 'goal' | 'blocked' | 'deadEnd'; nodeId: NodeId; p: number } | null;
}

/** Gate openness before a run resolves it. */
export const GATE_NEUTRAL = 0;

const progress = (cue: Cue, t: number) =>
  cue.dur <= 0 ? (t >= cue.at ? 1 : 0) : Math.min(1, Math.max(0, (t - cue.at) / cue.dur));

const easeInOut = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);

export function sampleTimeline(timeline: Timeline, t: number): VisualState {
  const state: VisualState = {
    wires: new Map(),
    gates: new Map(),
    ball: timeline.ballStart ? { at: timeline.ballStart } : null,
    finish: null,
  };
  for (const cue of timeline.cues) {
    if (t < cue.at) continue;
    const p = progress(cue, t);
    switch (cue.kind) {
      case 'wire':
        if (cue.value) state.wires.set(edgeKey(cue.from, cue.to), p);
        break;
      case 'gate': {
        const target = cue.open ? 1 : 0;
        state.gates.set(cue.gateId, GATE_NEUTRAL + (target - GATE_NEUTRAL) * easeInOut(p));
        break;
      }
      case 'ball':
        state.ball = p >= 1 ? { at: cue.to } : { from: cue.from, to: cue.to, p };
        break;
      case 'finish':
        state.finish = { result: cue.result, nodeId: cue.nodeId, p };
        break;
    }
  }
  return state;
}
