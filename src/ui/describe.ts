import { indexLevel } from '../engine/graph';
import type {
  LevelDef,
  NodeId,
  RejectReason,
  RunEvent,
  RunOutcome,
  SignalEdge,
} from '../engine/types';

// Plain-text descriptions for the M1 functional UI. The Pixi board replaces most of this in M2/M3.

export function nodeName(level: LevelDef, id: NodeId): string {
  const node = indexLevel(level).nodes.get(id);
  return node?.label ?? id;
}

export function describeWire(level: LevelDef, edge: SignalEdge): string {
  const to = indexLevel(level).nodes.get(edge.to)!;
  let target = nodeName(level, edge.to);
  if (to.type === 'gate') {
    const rule = to.requiredSignal ? 'opens on power' : 'opens with no power';
    target += to.combine === 'single' ? ` (${rule})` : ` (${to.combine.toUpperCase()}, ${rule})`;
  }
  return `${nodeName(level, edge.from)} → ${edge.invert ? 'NOT → ' : ''}${target}`;
}

export function describeEvent(level: LevelDef, event: RunEvent): string | null {
  const name = (id: NodeId) => nodeName(level, id);
  switch (event.type) {
    case 'signal':
      if (indexLevel(level).nodes.get(event.nodeId)?.type === 'source') {
        return `${name(event.nodeId)} is on`;
      }
      return `${name(event.nodeId)} is ${event.value ? 'powered' : 'unpowered'}`;
    case 'wire':
      return null;
    case 'gate':
      return `${name(event.gateId)} ${event.open ? 'opens' : 'stays closed'}`;
    case 'ballMove':
      return `Ball rolls to ${name(event.to)}`;
    case 'junction':
      return `${name(event.nodeId)} routes the ball to ${name(event.to)}`;
    case 'ballBlocked':
      return `Ball stopped at ${name(event.gateId)}`;
    case 'ballDeadEnd':
      return `Ball hit a dead end at ${name(event.nodeId)}`;
    case 'ballGoal':
      return 'Ball reached the goal!';
    case 'attemptEnd':
      return null;
  }
}

export function describeOutcome(level: LevelDef, outcome: RunOutcome): string {
  switch (outcome.kind) {
    case 'goal':
      return 'Solved! The ball reached the goal.';
    case 'blocked':
      return `The ball stopped at ${nodeName(level, outcome.gateId)}, which was closed.`;
    case 'deadEnd':
      return `The ball was routed into a dead end at ${nodeName(level, outcome.nodeId)}.`;
  }
}

export const rejectMessage: Record<RejectReason, string> = {
  budget: 'No changes left. Flip a changed switch back, or Reset.',
  notASwitch: 'That is not a switch.',
  nothingToUndo: 'Nothing to undo since the last run.',
  levelWon: 'Level already solved.',
};
