import { describe, expect, it } from 'vitest';
import { changesUsed, initialState, replay, step } from '../../src/engine/reducer';
import { simulateRun } from '../../src/engine/simulate';
import { greedyWin, solve } from '../../src/engine/solver';
import type { GameAction } from '../../src/engine/types';
import { validateLevel } from '../../src/levels/schema';
import { buildTimeline, INSTANT_TIMING } from '../../src/render/timeline';
import { explainRun } from '../../src/ui/describe';
import { checkpoint, makeLevel, staged } from '../fixtures';

const toggle = (switchId: string): GameAction => ({ type: 'toggle', switchId });
const run: GameAction = { type: 'run' };

describe('staged boards', () => {
  it('stops the ball at the checkpoint and opens the next part, on the same attempt', () => {
    const { state, log } = replay(staged, [toggle('b'), run]);
    expect(state.stage).toBe(1);
    expect(state.phase).toBe('editing');
    expect(state.attempt).toBe(1);
    expect(state.lastRun!.outcome).toEqual({ kind: 'checkpoint', nodeId: 'cp' });
    expect(log.at(-1)!.events.at(-2)).toEqual({ type: 'ballCheckpoint', nodeId: 'cp' });
  });

  it('starts the next run from the checkpoint and wins from there', () => {
    const { state, log } = replay(staged, [toggle('b'), run, toggle('d'), run]);
    expect(state.phase).toBe('won');
    expect(state.attempt).toBe(1);
    const moves = log.at(-1)!.events.filter((e) => e.type === 'ballMove');
    expect(moves[0]).toEqual({ type: 'ballMove', from: 'cp', to: 'g2' });
  });

  it('locks a cleared part, and keeps the next part shut until the checkpoint', () => {
    expect(step(staged, initialState(staged), toggle('d')).rejected).toBe('stageAhead');
    const { state } = replay(staged, [toggle('b'), run]);
    expect(step(staged, state, toggle('a')).rejected).toBe('stageDone');
    expect(step(staged, state, toggle('d')).rejected).toBeUndefined();
  });

  it('counts changes per part, or over the whole board', () => {
    const { state } = replay(staged, [toggle('b'), run, toggle('d')]);
    expect(changesUsed(staged, state.switches, 0)).toBe(1);
    expect(changesUsed(staged, state.switches, 1)).toBe(1);
    expect(changesUsed(staged, state.switches)).toBe(2);
  });

  it('counts a miss after a checkpoint as a new attempt, and Reset starts over', () => {
    const { state } = replay(staged, [toggle('a'), run, toggle('d'), run]);
    expect(state.stage).toBe(1);
    expect(state.attempt).toBe(2);
    const reset = step(staged, state, { type: 'reset' }).state;
    expect(reset.stage).toBe(0);
    expect(reset.switches).toEqual(initialState(staged).switches);
  });

  it('runs the whole track, past every checkpoint, when asked', () => {
    const all = { a: true, b: true, d: true };
    expect(simulateRun(staged, all, 1, null).won).toBe(true);
    expect(simulateRun(staged, all, 1).outcome.kind).toBe('checkpoint');
  });

  it('solves across parts, and a greedy player who clears part A the easy way gets stuck', () => {
    const report = solve(staged);
    expect(report.solution).toEqual(['b', 'd']);
    expect(report.parWins).toEqual([{ a: false, b: true, d: true }]);
    expect(greedyWin(staged)).toBeNull();
  });

  it('finds no way through once part A was cleared the wrong way', () => {
    const { state } = replay(staged, [toggle('a'), run]);
    expect(solve(staged, state).solvable).toBe(false);
  });

  it('rejects checkpoints that skip a part, and switches in parts that do not exist', () => {
    const broken = makeLevel({
      ...staged,
      nodes: staged.nodes.map((n) =>
        n.id === 'cp' ? checkpoint('cp', 1) : n.id === 'd' ? { ...n, stage: 3 } : n,
      ),
    });
    const codes = validateLevel(broken).map((e) => e.code);
    expect(codes.filter((c) => c === 'BAD_STAGE')).toHaveLength(2);
    expect(validateLevel(staged)).toEqual([]);
  });

  it('plays the checkpoint as a finish, and says which part opened', () => {
    const { log, state } = replay(staged, [toggle('b'), run]);
    const timeline = buildTimeline(log.at(-1)!.events, INSTANT_TIMING);
    expect(timeline.cues.at(-1)).toMatchObject({
      kind: 'finish',
      result: 'checkpoint',
      nodeId: 'cp',
    });
    expect(explainRun(staged, state.lastRun!)).toBe(
      "Part A cleared. Part B's switches are open: set them, then Run.",
    );
  });
});
