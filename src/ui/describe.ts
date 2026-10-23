import { indexLevel } from '../engine/graph';
import type { LevelDef, NodeId, RejectReason, RunResult } from '../engine/types';

export function nodeName(level: LevelDef, id: NodeId): string {
  return indexLevel(level).nodes.get(id)?.label ?? id;
}

/** Short requirement label shown under a gate. */
export function gateRequirement(level: LevelDef, id: NodeId): string {
  const node = indexLevel(level).nodes.get(id);
  if (node?.type !== 'gate') return '';
  if (node.combine === 'single') return node.requiredSignal ? 'ON' : 'OFF';
  if (node.combine === 'and') return node.requiredSignal ? 'ALL ON' : 'NOT ALL ON';
  return node.requiredSignal ? 'ANY ON' : 'ALL OFF';
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
      const name = nodeName(level, outcome.gateId);
      const wires = run.events.filter((e) => e.type === 'wire' && e.to === outcome.gateId);
      const lit = wires.filter((e) => e.type === 'wire' && e.value).length;
      if (node?.type === 'gate' && node.combine === 'and' && node.requiredSignal)
        return lit === 0
          ? `Stopped at ${name}: it needs power on every wire, but none had it.`
          : `Stopped at ${name}: it needs power on every wire, but only ${lit} of ${wires.length} had it.`;
      if (node?.type === 'gate' && node.combine === 'or' && node.requiredSignal)
        return `Stopped at ${name}: it needs power on at least one wire, but none had it.`;
      if (node?.type === 'gate' && node.combine === 'or')
        return `Stopped at ${name}: it needs every wire dark, but ${lit} had power.`;
      const gate = run.events.find((e) => e.type === 'gate' && e.gateId === outcome.gateId);
      const got = gate?.type === 'gate' && gate.input ? 'got power' : 'got no power';
      const needs = node?.type === 'gate' && node.requiredSignal ? 'needs power' : 'needs no power';
      return `Stopped at ${name}: it ${needs} but ${got}.`;
    }
  }
}

export const rejectMessage: Record<RejectReason, string> = {
  budget: 'No changes left. Switch a changed switch back, or Reset.',
  notASwitch: 'That is not a switch.',
  nothingToUndo: 'Nothing to undo since the last run.',
  levelWon: 'Level already solved.',
};
