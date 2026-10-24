import { describe, expect, it } from 'vitest';
import { changesUsed, initialState, replay, step } from '../../src/engine/reducer';
import type { GameAction, GameState } from '../../src/engine/types';
import { levels } from '../../src/levels';
import { fork, tradeoff } from '../fixtures';

const recorded: GameAction[] = [
  { type: 'toggle', switchId: 'a' },
  { type: 'run' },
  { type: 'toggle', switchId: 'b' },
  { type: 'undo' },
  { type: 'toggle', switchId: 'b' },
  { type: 'run' },
];

/** Small seeded PRNG so random tests are reproducible. */
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('determinism', () => {
  it('replaying the same actions gives identical states and events', () => {
    const first = replay(tradeoff, recorded);
    const second = replay(tradeoff, recorded);
    expect(second).toEqual(first);
    expect(first.state.phase).toBe('won');
  });

  it('matches the recorded event log', () => {
    expect(replay(tradeoff, recorded).log.map((r) => r.events)).toMatchSnapshot();
  });
});

describe('random play properties', () => {
  const subjects = [tradeoff, fork, ...levels];

  it.each(subjects.map((l) => [l.id, l] as const))(
    '%s: budget is never exceeded and undo exactly reverses a toggle',
    (_id, level) => {
      const rand = mulberry32(42);
      const switchIds = level.nodes.filter((n) => n.type === 'switch').map((n) => n.id);
      for (let game = 0; game < 50; game++) {
        let state: GameState = initialState(level);
        for (let move = 0; move < 30; move++) {
          const r = rand();
          const action: GameAction =
            r < 0.6
              ? { type: 'toggle', switchId: switchIds[Math.floor(rand() * switchIds.length)]! }
              : r < 0.8
                ? { type: 'undo' }
                : r < 0.95
                  ? { type: 'run' }
                  : { type: 'reset' };
          const result = step(level, state, action);
          if (action.type === 'toggle' && !result.rejected) {
            const undone = step(level, result.state, { type: 'undo' }).state;
            expect(undone.switches).toEqual(state.switches);
            expect(undone.undoStack).toEqual(state.undoStack);
          }
          if (result.rejected) expect(result.state).toBe(state);
          state = result.state;
          expect(changesUsed(level, state.switches)).toBeLessThanOrEqual(
            Object.keys(state.switches).length,
          );
        }
      }
    },
  );
});
