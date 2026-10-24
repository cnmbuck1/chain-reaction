import { indexLevel, switchStage } from './graph';
import { simulateRun } from './simulate';
import type {
  GameAction,
  GameState,
  LevelDef,
  NodeId,
  RejectReason,
  StepResult,
  SwitchStates,
} from './types';

export function initialSwitches(level: LevelDef): SwitchStates {
  const switches: Record<string, boolean> = {};
  for (const node of level.nodes) {
    if (node.type === 'switch') switches[node.id] = node.initialOn;
  }
  return switches;
}

export function initialState(level: LevelDef): GameState {
  return {
    switches: initialSwitches(level),
    undoStack: [],
    attempt: 1,
    stage: 0,
    phase: 'editing',
    lastRun: null,
  };
}

/** Turns a switch by hand: it flips, and so does every switch its gears turn. */
function turn(level: LevelDef, switches: SwitchStates, switchId: string): SwitchStates {
  const next = { ...switches };
  for (const id of indexLevel(level).turnSets.get(switchId) ?? [switchId]) next[id] = !next[id];
  return next;
}

/**
 * The switches to turn by hand to get from the level's starting position to `switches`.
 * Without gears that is every switch that differs. With gears there is still exactly one
 * answer: going drivers first, a switch needs turning when it differs from where the
 * gears already left it.
 */
export function turnsFor(level: LevelDef, switches: SwitchStates): NodeId[] {
  const index = indexLevel(level);
  const flipped = new Set<NodeId>();
  const turned: NodeId[] = [];
  for (const id of index.gearOrder) {
    const node = index.nodes.get(id);
    if (node?.type !== 'switch') continue;
    if ((switches[id] !== node.initialOn) === flipped.has(id)) continue;
    turned.push(id);
    for (const other of index.turnSets.get(id)!) {
      if (flipped.has(other)) flipped.delete(other);
      else flipped.add(other);
    }
  }
  return turned;
}

/**
 * How many switches must be turned by hand to reach this position: on the whole board, or
 * in one part of a staged board. There is no limit; a solve at `meta.minChanges` is par.
 */
export function changesUsed(level: LevelDef, switches: SwitchStates, stage?: number): number {
  const index = indexLevel(level);
  return turnsFor(level, switches).filter(
    (id) => stage === undefined || switchStage(index.nodes.get(id)!) === stage,
  ).length;
}

/** Why a switch can't be toggled right now, if it can't. */
function blockedReason(level: LevelDef, state: GameState, switchId: string): RejectReason | null {
  const node = indexLevel(level).nodes.get(switchId);
  if (node?.type !== 'switch') return 'notASwitch';
  if (state.phase === 'won') return 'levelWon';
  if (node.locked) return 'locked';
  const stage = switchStage(node);
  if (stage < state.stage) return 'stageDone';
  if (stage > state.stage) return 'stageAhead';
  return null;
}

/** Whether this switch can be toggled now. */
export function canToggle(level: LevelDef, state: GameState, switchId: string): boolean {
  return blockedReason(level, state, switchId) === null;
}

/**
 * The single transition function for play. Rejected actions return the same state
 * object with `rejected` set. Only `run` produces events.
 */
export function step(level: LevelDef, state: GameState, action: GameAction): StepResult {
  switch (action.type) {
    case 'toggle': {
      const blocked = blockedReason(level, state, action.switchId);
      if (blocked) return { state, events: [], rejected: blocked };
      return {
        state: {
          ...state,
          switches: turn(level, state.switches, action.switchId),
          undoStack: [...state.undoStack, action.switchId],
        },
        events: [],
      };
    }
    case 'undo': {
      if (state.phase === 'won') return { state, events: [], rejected: 'levelWon' };
      const last = state.undoStack[state.undoStack.length - 1];
      if (last === undefined) return { state, events: [], rejected: 'nothingToUndo' };
      return {
        state: {
          ...state,
          switches: turn(level, state.switches, last),
          undoStack: state.undoStack.slice(0, -1),
        },
        events: [],
      };
    }
    case 'run': {
      if (state.phase === 'won') return { state, events: [], rejected: 'levelWon' };
      const result = simulateRun(level, state.switches, state.attempt, state.stage);
      // Reaching a checkpoint is progress, not a miss: the next part opens, same attempt.
      const cleared = result.outcome.kind === 'checkpoint';
      return {
        state: {
          ...state,
          undoStack: [],
          attempt: result.won || cleared ? state.attempt : state.attempt + 1,
          stage: cleared ? state.stage + 1 : state.stage,
          phase: result.won ? 'won' : 'editing',
          lastRun: result,
        },
        events: result.events,
      };
    }
    // Reset starts the whole machine over, since earlier parts can decide later ones.
    case 'reset':
      return {
        state: { ...initialState(level), attempt: state.attempt },
        events: [],
      };
  }
}

/** Applies actions in order and returns the final state and every RUN's events. */
export function replay(level: LevelDef, actions: readonly GameAction[]) {
  let state = initialState(level);
  const log: StepResult[] = [];
  for (const action of actions) {
    const result = step(level, state, action);
    log.push(result);
    state = result.state;
  }
  return { state, log };
}
