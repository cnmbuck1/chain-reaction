import { evaluate } from './evaluate';
import { indexLevel } from './graph';
import { initialState, step, turnsFor } from './reducer';
import { simulateRun } from './simulate';
import type { GameState, LevelDef, NodeId, SwitchStates } from './types';

export interface SolveReport {
  solvable: boolean;
  /** Fewest switch changes that win, or null if unsolvable. */
  minChanges: number | null;
  /** One shortest winning toggle sequence (then RUN). */
  solution: NodeId[] | null;
  /** Switch positions reachable in play (every position; on staged boards, per part played). */
  reachableConfigs: number;
  /** Of those, how many win. */
  winningConfigs: number;
  /** The winning switch positions themselves, fewest changes first. */
  wins: SwitchStates[];
  /** The winning positions at par (`minChanges`): the ones that can earn three stars. */
  parWins: SwitchStates[];
  /**
   * Positions with exactly `minChanges` switches changed, per par win: a player who picks
   * that many switches at random wins on the first Run 1 time in this many.
   */
  guessOdds: number | null;
  /** Switches that never change any gate or fork, in any position. */
  idleSwitches: NodeId[];
  /** Winning without touching anything. */
  zeroChangeWin: boolean;
  /** Turning every switch ON wins. */
  allOnWins: boolean;
  /** A "fix whatever blocked the ball" player wins at par. A sign the level is shallow. */
  greedySolves: boolean;
}

const key = (switchIds: readonly NodeId[], switches: SwitchStates) =>
  switchIds.map((id) => (switches[id] ? '1' : '0')).join('');

/** A search state: switch positions plus, on staged boards, the part being played and keys held. */
const stateKey = (switchIds: readonly NodeId[], state: GameState) =>
  `${state.stage}:${state.keys.join(',')}:${key(switchIds, state.switches)}`;

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
  const minChanges = solution?.length ?? null;
  const fromStart = from ? { ...level, nodes: startNodes(level, from) } : level;
  const changes = (w: SwitchStates) => turnsFor(fromStart, w).length;
  const parWins = wins.filter((w) => changes(w) === minChanges);
  const greedy = greedyWin(level);
  return {
    solvable: solution !== null,
    minChanges,
    solution,
    reachableConfigs: seen.size,
    winningConfigs: wins.length,
    wins,
    parWins,
    guessOdds: minChanges === null ? null : binomial(switchIds.length, minChanges) / parWins.length,
    idleSwitches: idleSwitches(level),
    zeroChangeWin: solution?.length === 0,
    allOnWins: simulateRun(level, allOn, 1, null).won,
    greedySolves: greedy !== null && changes(greedy) === minChanges,
  };
}

/** The level's nodes with switches starting where `start` has them. */
function startNodes(level: LevelDef, start: GameState) {
  return level.nodes.map((n) =>
    n.type === 'switch' ? { ...n, initialOn: start.switches[n.id] ?? n.initialOn } : n,
  );
}

function binomial(n: number, k: number): number {
  let out = 1;
  for (let i = 1; i <= k; i++) out = (out * (n - k + i)) / i;
  return Math.round(out);
}

/** Switches whose flip changes no gate and no fork in any position of the others. */
export function idleSwitches(level: LevelDef): NodeId[] {
  const index = indexLevel(level);
  const ids = index.switchIds;
  const reads = (switches: SwitchStates) => {
    const { gateOpen, sinkInputs } = evaluate(index, switches);
    return JSON.stringify([[...gateOpen], [...sinkInputs]]);
  };
  return ids.filter((id) => {
    for (let mask = 0; mask < 1 << ids.length; mask++) {
      const switches = Object.fromEntries(ids.map((s, i) => [s, (mask & (1 << i)) !== 0]));
      if (switches[id]) continue;
      if (reads(switches) !== reads({ ...switches, [id]: true })) return false;
    }
    return true;
  });
}

/**
 * Heuristic shallow-level detector. The simulated player runs, looks at what stopped
 * the ball, and flips the first upstream switch (by id) that fixes that spot on its own.
 * Returns the position it wins with, or null.
 */
export function greedyWin(level: LevelDef): SwitchStates | null {
  const index = indexLevel(level);
  let state = initialState(level);
  const tried = new Set<string>();

  for (let round = 0; round <= index.switchIds.length * 2 + 1 + index.checkpoints.length; round++) {
    const ran = step(level, state, { type: 'run' });
    if (ran.state.phase === 'won') return state.switches;
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
    if (culprit === undefined) return null;

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
    if (!moved) return null;
  }
  return null;
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
