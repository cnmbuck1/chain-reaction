import { evaluate } from './evaluate';
import { indexLevel } from './graph';
import { initialState, step } from './reducer';
import { simulateRun } from './simulate';
import type { GameState, LevelDef, NodeId, SwitchStates } from './types';

export interface SolveReport {
  solvable: boolean;
  /** Fewest switch changes that win, or null if unsolvable. */
  minChanges: number | null;
  /** One shortest winning toggle sequence (then RUN). */
  solution: NodeId[] | null;
  /** Switch positions reachable within the budget. */
  reachableConfigs: number;
  /** Of those, how many win. */
  winningConfigs: number;
  /** Winning without touching anything. */
  zeroChangeWin: boolean;
  /** Turning every switch ON wins (ignoring the budget). */
  allOnWins: boolean;
  /** A "fix whatever blocked the ball" player wins. A sign the level is shallow. */
  greedySolves: boolean;
}

const key = (switchIds: readonly NodeId[], switches: SwitchStates) =>
  switchIds.map((id) => (switches[id] ? '1' : '0')).join('');

/**
 * Breadth-first search over switch positions using the engine's own `step` function,
 * so the solver can never disagree with play. Boards are small (<= ~10 switches).
 */
export function solve(level: LevelDef): SolveReport {
  const { switchIds } = indexLevel(level);
  const start = initialState(level);
  const seen = new Map<string, NodeId[]>([[key(switchIds, start.switches), []]]);
  const queue: GameState[] = [start];
  let solution: NodeId[] | null = null;
  let winningConfigs = 0;

  while (queue.length > 0) {
    const state = queue.shift()!;
    const path = seen.get(key(switchIds, state.switches))!;
    if (step(level, state, { type: 'run' }).state.phase === 'won') {
      winningConfigs++;
      solution ??= path;
    }
    for (const id of switchIds) {
      const next = step(level, state, { type: 'toggle', switchId: id });
      if (next.rejected) continue;
      const k = key(switchIds, next.state.switches);
      if (seen.has(k)) continue;
      seen.set(k, [...path, id]);
      queue.push(next.state);
    }
  }

  const allOn = Object.fromEntries(switchIds.map((id) => [id, true]));
  return {
    solvable: solution !== null,
    minChanges: solution?.length ?? null,
    solution,
    reachableConfigs: seen.size,
    winningConfigs,
    zeroChangeWin: solution?.length === 0,
    allOnWins: simulateRun(level, allOn, 1).won,
    greedySolves: greedySolves(level),
  };
}

/**
 * Heuristic shallow-level detector. The simulated player runs, looks at what stopped
 * the ball, and flips the first upstream switch (by id) that fixes that spot on its own.
 */
export function greedySolves(level: LevelDef): boolean {
  const index = indexLevel(level);
  let state = initialState(level);
  const tried = new Set<string>();

  for (let round = 0; round <= index.switchIds.length * 2 + 1; round++) {
    const ran = step(level, state, { type: 'run' });
    if (ran.state.phase === 'won') return true;
    state = ran.state;
    tried.add(key(index.switchIds, state.switches));

    const outcome = ran.state.lastRun!.outcome;
    let culprit: NodeId | undefined;
    if (outcome.kind === 'blocked') culprit = outcome.gateId;
    else {
      const junctions = ran.events.filter((e) => e.type === 'junction');
      culprit = junctions[junctions.length - 1]?.nodeId;
    }
    if (culprit === undefined) return false;

    const before = evaluate(index, state.switches);
    const fixes = (switches: SwitchStates) => {
      const after = evaluate(index, switches);
      return outcome.kind === 'blocked'
        ? after.gateOpen.get(culprit) === true
        : after.sinkInputs.get(culprit) !== before.sinkInputs.get(culprit);
    };

    let moved = false;
    for (const id of upstreamSwitches(level, culprit)) {
      const next = step(level, state, { type: 'toggle', switchId: id });
      if (next.rejected || tried.has(key(index.switchIds, next.state.switches))) continue;
      if (fixes(next.state.switches)) {
        state = next.state;
        moved = true;
        break;
      }
    }
    if (!moved) return false;
  }
  return false;
}

/** Switches whose signal can reach the node, sorted by id. */
export function upstreamSwitches(level: LevelDef, nodeId: NodeId): NodeId[] {
  const index = indexLevel(level);
  const found = new Set<NodeId>();
  const stack = [nodeId];
  while (stack.length > 0) {
    const id = stack.pop()!;
    for (const edge of index.incoming.get(id) ?? []) {
      if (found.has(edge.from)) continue;
      found.add(edge.from);
      stack.push(edge.from);
    }
  }
  return index.switchIds.filter((id) => found.has(id));
}
