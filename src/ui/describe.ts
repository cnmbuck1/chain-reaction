import { indexLevel } from '../engine/graph';
import type { LevelDef, NodeId, RejectReason, RunResult } from '../engine/types';

export function nodeName(level: LevelDef, id: NodeId): string {
  return indexLevel(level).nodes.get(id)?.label ?? id;
}

/** Short requirement label shown under a gate. */
export function gateRequirement(level: LevelDef, id: NodeId): string {
  const node = indexLevel(level).nodes.get(id);
  if (node?.type !== 'gate') return '';
  const need = node.requiredSignal ? 'ON' : 'OFF';
  return node.combine === 'single' ? need : `${need} · ${node.combine.toUpperCase()}`;
}

/** Says where and why the ball stopped, without giving away the solution. */
export function explainRun(level: LevelDef, run: RunResult): string {
  const { outcome } = run;
  switch (outcome.kind) {
    case 'goal':
      return 'The ball reached the goal.';
    case 'deadEnd':
      return `A junction sent the ball into a dead end.`;
    case 'blocked': {
      const node = indexLevel(level).nodes.get(outcome.gateId);
      const gate = run.events.find((e) => e.type === 'gate' && e.gateId === outcome.gateId);
      const got = gate?.type === 'gate' && gate.input ? 'got power' : 'got no power';
      const needs = node?.type === 'gate' && node.requiredSignal ? 'needs power' : 'needs no power';
      return `Stopped at ${nodeName(level, outcome.gateId)}: it ${needs} but ${got}.`;
    }
  }
}

export const rejectMessage: Record<RejectReason, string> = {
  budget: 'No changes left. Switch a changed switch back, or Reset.',
  notASwitch: 'That is not a switch.',
  nothingToUndo: 'Nothing to undo since the last run.',
  levelWon: 'Level already solved.',
};
