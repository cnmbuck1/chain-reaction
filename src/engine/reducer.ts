import { indexLevel } from './graph';
import { simulateRun } from './simulate';
import type { GameAction, GameState, LevelDef, StepResult, SwitchStates } from './types';

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
    phase: 'editing',
    lastRun: null,
  };
}

/** Budget used: how many switches differ from the level's starting position. */
export function changesUsed(level: LevelDef, switches: SwitchStates): number {
  let count = 0;
  for (const node of level.nodes) {
    if (node.type === 'switch' && switches[node.id] !== node.initialOn) count++;
  }
  return count;
}

/** Whether toggling this switch now is allowed by the budget. */
export function canToggle(level: LevelDef, state: GameState, switchId: string): boolean {
  if (state.phase === 'won') return false;
  const node = indexLevel(level).nodes.get(switchId);
  if (node?.type !== 'switch') return false;
  const isChanged = state.switches[switchId] !== node.initialOn;
  return isChanged || changesUsed(level, state.switches) < level.maxToggles;
}

/**
 * The single transition function for play. Rejected actions return the same state
 * object with `rejected` set. Only `run` produces events.
 */
export function step(level: LevelDef, state: GameState, action: GameAction): StepResult {
  switch (action.type) {
    case 'toggle': {
      const node = indexLevel(level).nodes.get(action.switchId);
      if (node?.type !== 'switch') return { state, events: [], rejected: 'notASwitch' };
      if (state.phase === 'won') return { state, events: [], rejected: 'levelWon' };
      if (!canToggle(level, state, action.switchId)) {
        return { state, events: [], rejected: 'budget' };
      }
      return {
        state: {
          ...state,
          switches: { ...state.switches, [action.switchId]: !state.switches[action.switchId] },
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
          switches: { ...state.switches, [last]: !state.switches[last] },
          undoStack: state.undoStack.slice(0, -1),
        },
        events: [],
      };
    }
    case 'run': {
      if (state.phase === 'won') return { state, events: [], rejected: 'levelWon' };
      const result = simulateRun(level, state.switches, state.attempt);
      return {
        state: {
          ...state,
          undoStack: [],
          attempt: result.won ? state.attempt : state.attempt + 1,
          phase: result.won ? 'won' : 'editing',
          lastRun: result,
        },
        events: result.events,
      };
    }
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
