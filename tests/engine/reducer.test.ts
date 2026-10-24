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

  it('counts changes as switches that differ from the start', () => {
    const { state } = replay(tradeoff, [toggle('a'), toggle('a'), toggle('b')]);
    expect(changesUsed(tradeoff, state.switches)).toBe(1);
  });

  it('has no change limit: every switch can be changed', () => {
    const { state, log } = replay(tradeoff, [toggle('a'), toggle('b')]);
    expect(log.every((r) => !r.rejected)).toBe(true);
    expect(changesUsed(tradeoff, state.switches)).toBe(2);
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

  it('changes carry across attempts because they count from the start', () => {
    const { state } = replay(tradeoff, [toggle('a'), { type: 'run' }]);
    expect(changesUsed(tradeoff, state.switches)).toBe(1);
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
