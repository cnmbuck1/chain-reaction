import { evaluate } from './evaluate';
import { indexLevel, stageStart } from './graph';
import type { LevelDef, NodeId, RunEvent, RunOutcome, RunResult, SwitchStates } from './types';

/**
 * One RUN: power propagation, then gate states, then ball travel. The ball stops at
 * the first closed gate, dead end or lock it has no key for, or at the checkpoint that
 * ends the part being played. A trip plate flips a switch as the ball passes, and power and
 * gates are worked out again from there. Pure: same inputs always give the same events.
 *
 * `stage` is the part being played; null runs the whole track, passing every checkpoint.
 * `keys` are the keys the ball sets off with, carried from earlier parts.
 */
export function simulateRun(
  level: LevelDef,
  switches: SwitchStates,
  attempt: number,
  stage: number | null = 0,
  keys: readonly NodeId[] = [],
): RunResult {
  const index = indexLevel(level);
  const live: Record<NodeId, boolean> = { ...switches };
  let evaluation = evaluate(index, live);
  const events: RunEvent[] = [...evaluation.events];

  let at: NodeId = stageStart(index, stage ?? 0);
  let outcome: RunOutcome | null = null;
  const held = new Set(keys);
  // Validated tracks are acyclic, so the ball visits each node at most once.
  for (let steps = 0; steps <= level.nodes.length && outcome === null; steps++) {
    const node = index.nodes.get(at)!;
    switch (node.type) {
      case 'goal':
        outcome = { kind: 'goal', goalId: at };
        events.push({ type: 'ballGoal', goalId: at });
        break;
      case 'deadEnd':
        outcome = { kind: 'deadEnd', nodeId: at };
        events.push({ type: 'ballDeadEnd', nodeId: at });
        break;
      case 'gate':
        if (!evaluation.gateOpen.get(at)) {
          outcome = { kind: 'blocked', gateId: at };
          events.push({ type: 'ballBlocked', gateId: at });
          break;
        }
        at = moveTo(events, at, index.trackNext.get(at));
        break;
      case 'checkpoint':
        if (node.stage === stage) {
          outcome = { kind: 'checkpoint', nodeId: at };
          events.push({ type: 'ballCheckpoint', nodeId: at });
          break;
        }
        at = moveTo(events, at, index.trackNext.get(at));
        break;
      case 'key':
        held.add(at);
        events.push({ type: 'ballKey', nodeId: at });
        at = moveTo(events, at, index.trackNext.get(at));
        break;
      case 'lock':
        if (!held.has(node.key)) {
          outcome = { kind: 'locked', nodeId: at };
          events.push({ type: 'ballLocked', nodeId: at });
          break;
        }
        at = moveTo(events, at, index.trackNext.get(at));
        break;
      case 'trip':
        live[node.flips] = !live[node.flips];
        events.push({ type: 'ballTrip', nodeId: at, switchId: node.flips });
        evaluation = evaluate(index, live);
        events.push(...evaluation.events);
        at = moveTo(events, at, index.trackNext.get(at));
        break;
      case 'junction': {
        const input = evaluation.sinkInputs.get(at) ?? false;
        const to = input ? node.whenTrue : node.whenFalse;
        events.push({ type: 'junction', nodeId: at, input, to });
        at = moveTo(events, at, to);
        break;
      }
      default:
        at = moveTo(events, at, index.trackNext.get(at));
    }
  }
  if (outcome === null) throw new Error(`Track did not terminate in level ${level.id}`);

  const won = outcome.kind === 'goal';
  events.push({ type: 'attemptEnd', won, attempt });
  return { won, outcome, events, keys: [...held].sort() };
}

function moveTo(events: RunEvent[], from: NodeId, to: NodeId | undefined): NodeId {
  if (to === undefined) throw new Error(`Track has no exit from ${from}`);
  events.push({ type: 'ballMove', from, to });
  return to;
}
