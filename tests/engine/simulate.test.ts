import { describe, expect, it } from 'vitest';
import { simulateRun } from '../../src/engine/simulate';
import { fork, tradeoff } from '../fixtures';

describe('ball travel', () => {
  it('stops at the first closed gate', () => {
    const result = simulateRun(tradeoff, { a: true, b: true }, 1);
    expect(result.won).toBe(false);
    expect(result.outcome).toEqual({ kind: 'blocked', gateId: 'g2' });
    const tail = result.events.slice(-4);
    expect(tail).toEqual([
      { type: 'ballMove', from: 'ball', to: 'g1' },
      { type: 'ballMove', from: 'g1', to: 'g2' },
      { type: 'ballBlocked', gateId: 'g2' },
      { type: 'attemptEnd', won: false, attempt: 1 },
    ]);
  });

  it('reaches the goal when every gate on the route is open', () => {
    const result = simulateRun(tradeoff, { a: true, b: false }, 3);
    expect(result.won).toBe(true);
    expect(result.outcome).toEqual({ kind: 'goal', goalId: 'goal' });
    expect(result.events.at(-1)).toEqual({ type: 'attemptEnd', won: true, attempt: 3 });
  });

  it('plays all signal and gate events before the ball moves', () => {
    const { events } = simulateRun(tradeoff, { a: true, b: false }, 1);
    const firstBall = events.findIndex((e) => e.type === 'ballMove');
    const lastLogic = events.findLastIndex((e) => e.type === 'gate' || e.type === 'wire');
    expect(lastLogic).toBeLessThan(firstBall);
  });

  it('routes through a junction by its input', () => {
    const on = simulateRun(fork, { a: true }, 1);
    expect(on.outcome).toEqual({ kind: 'deadEnd', nodeId: 'dead' });
    expect(on.events).toContainEqual({ type: 'junction', nodeId: 'j', input: true, to: 'dead' });
    const off = simulateRun(fork, { a: false }, 1);
    expect(off.won).toBe(true);
  });
});
