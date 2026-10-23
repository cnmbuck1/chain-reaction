import { describe, expect, it } from 'vitest';
import { changesUsed, initialState, replay, step } from '../../src/engine/reducer';
import type { GameAction } from '../../src/engine/types';
import { tradeoff } from '../fixtures';

const toggle = (switchId: string): GameAction => ({ type: 'toggle', switchId });

describe('player actions', () => {
  it('toggles a switch and records it for undo', () => {
    const { state } = step(tradeoff, initialState(tradeoff), toggle('a'));
    expect(state.switches).toEqual({ a: true, b: true });
    expect(state.undoStack).toEqual(['a']);
  });

  it('counts the budget as switches changed from the start', () => {
    const { state } = replay(tradeoff, [toggle('a'), toggle('a'), toggle('b')]);
    expect(changesUsed(tradeoff, state.switches)).toBe(1);
  });

  it('rejects a toggle that would exceed the budget, without changing state', () => {
    const level = { ...tradeoff, maxToggles: 1 };
    const { state } = replay(level, [toggle('a')]);
    const result = step(level, state, toggle('b'));
    expect(result.rejected).toBe('budget');
    expect(result.state).toBe(state);
  });

  it('always allows flipping a changed switch back, refunding the budget', () => {
    const level = { ...tradeoff, maxToggles: 1 };
    const { state } = replay(level, [toggle('a'), toggle('a'), toggle('b')]);
    expect(state.switches).toEqual({ a: false, b: false });
  });

  it('undo reverses the last toggle', () => {
    const { state } = replay(tradeoff, [toggle('a'), toggle('b'), { type: 'undo' }]);
    expect(state.switches).toEqual({ a: true, b: true });
    expect(state.undoStack).toEqual(['a']);
  });

  it('undo with nothing to undo is rejected', () => {
    expect(step(tradeoff, initialState(tradeoff), { type: 'undo' }).rejected).toBe('nothingToUndo');
  });

  it('a failed run keeps switch positions, clears undo and starts the next attempt', () => {
    const { state, log } = replay(tradeoff, [toggle('a'), { type: 'run' }]);
    expect(log.at(-1)!.events.length).toBeGreaterThan(0);
    expect(state.switches).toEqual({ a: true, b: true });
    expect(state.undoStack).toEqual([]);
    expect(state.attempt).toBe(2);
    expect(state.phase).toBe('editing');
    expect(state.lastRun?.outcome).toEqual({ kind: 'blocked', gateId: 'g2' });
  });

  it('the budget carries across attempts because it counts from the start', () => {
    const level = { ...tradeoff, maxToggles: 1 };
    const { state } = replay(level, [toggle('a'), { type: 'run' }]);
    expect(step(level, state, toggle('b')).rejected).toBe('budget');
  });

  it('a winning run ends the level and locks further toggles', () => {
    const { state } = replay(tradeoff, [toggle('a'), toggle('b'), { type: 'run' }]);
    expect(state.phase).toBe('won');
    expect(state.attempt).toBe(1);
    expect(step(tradeoff, state, toggle('a')).rejected).toBe('levelWon');
    expect(step(tradeoff, state, { type: 'run' }).rejected).toBe('levelWon');
  });

  it('reset restores the authored positions and keeps the attempt count', () => {
    const { state } = replay(tradeoff, [
      toggle('a'),
      { type: 'run' },
      toggle('b'),
      { type: 'reset' },
    ]);
    expect(state.switches).toEqual(initialState(tradeoff).switches);
    expect(state.undoStack).toEqual([]);
    expect(state.attempt).toBe(2);
    expect(state.phase).toBe('editing');
  });

  it('rejects toggling something that is not a switch', () => {
    expect(step(tradeoff, initialState(tradeoff), toggle('g1')).rejected).toBe('notASwitch');
  });
});
