import { evaluate } from './evaluate';
import { indexLevel } from './graph';
import type { LevelDef, NodeId, RunEvent, RunOutcome, RunResult, SwitchStates } from './types';

/**
 * One RUN: power propagation, then gate states, then ball travel. The ball stops at
 * the first closed gate or dead end. Pure: same inputs always give the same events.
 */
export function simulateRun(level: LevelDef, switches: SwitchStates, attempt: number): RunResult {
  const index = indexLevel(level);
  const evaluation = evaluate(index, switches);
  const events: RunEvent[] = [...evaluation.events];

  let at: NodeId = index.ballStart;
  let outcome: RunOutcome | null = null;
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
  return { won, outcome, events };
}

function moveTo(events: RunEvent[], from: NodeId, to: NodeId | undefined): NodeId {
  if (to === undefined) throw new Error(`Track has no exit from ${from}`);
  events.push({ type: 'ballMove', from, to });
  return to;
}
