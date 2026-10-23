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
  /** The winning switch positions themselves. */
  wins: SwitchStates[];
  /** Winning without touching anything. */
  zeroChangeWin: boolean;
  /** Turning every switch ON wins (ignoring the budget). */
  allOnWins: boolean;
  /** A "fix whatever blocked the ball" player wins. A sign the level is shallow. */
  greedySolves: boolean;
}

const key = (switchIds: readonly NodeId[], switches: SwitchStates) =>
  switchIds.map((id) => (switches[id] ? '1' : '0')).join('');

/** A search state: switch positions plus, on staged boards, the part being played. */
const stateKey = (switchIds: readonly NodeId[], state: GameState) =>
  `${state.stage}:${key(switchIds, state.switches)}`;

/**
 * Breadth-first search over switch positions using the engine's own `step` function,
 * so the solver can never disagree with play. Boards are small (<= ~10 switches).
 * On staged boards a run that clears a part is a move too, so the search plays every
 * part in order. `from` searches on from a game in progress.
 */
export function solve(level: LevelDef, from?: GameState): SolveReport {
  const { switchIds } = indexLevel(level);
  const start = from ?? initialState(level);
  const seen = new Map<string, NodeId[]>([[stateKey(switchIds, start), []]]);
  const queue: GameState[] = [start];
  let solution: NodeId[] | null = null;
  const wins: SwitchStates[] = [];

  while (queue.length > 0) {
    const state = queue.shift()!;
    const path = seen.get(stateKey(switchIds, state))!;
    // A run either wins, clears a part (a new state to search from), or changes nothing.
    const ran = step(level, state, { type: 'run' }).state;
    if (ran.phase === 'won') {
      wins.push(state.switches);
      solution ??= path;
    }
    const next = switchIds.map((id) => step(level, state, { type: 'toggle', switchId: id }));
    if (ran.stage > state.stage) next.push({ state: ran, events: [] });
    for (const { state: after, rejected } of next) {
      if (rejected) continue;
      const k = stateKey(switchIds, after);
      if (seen.has(k)) continue;
      seen.set(k, after.stage === state.stage ? [...path, after.undoStack.at(-1)!] : path);
      queue.push(after);
    }
  }

  const allOn = Object.fromEntries(switchIds.map((id) => [id, true]));
  return {
    solvable: solution !== null,
    minChanges: solution?.length ?? null,
    solution,
    reachableConfigs: seen.size,
    winningConfigs: wins.length,
    wins,
    zeroChangeWin: solution?.length === 0,
    allOnWins: simulateRun(level, allOn, 1, null).won,
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

  for (let round = 0; round <= index.switchIds.length * 2 + 1 + index.checkpoints.length; round++) {
    const ran = step(level, state, { type: 'run' });
    if (ran.state.phase === 'won') return true;
    state = ran.state;
    tried.add(stateKey(index.switchIds, state));

    const outcome = ran.state.lastRun!.outcome;
    if (outcome.kind === 'checkpoint') continue;
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
      if (next.rejected || tried.has(stateKey(index.switchIds, next.state))) continue;
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
