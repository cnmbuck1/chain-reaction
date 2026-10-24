import { describe, expect, it } from 'vitest';
import { replay } from '../../src/engine/reducer';
import { solve, upstreamSwitches } from '../../src/engine/solver';
import { ball, gate, goal, makeLevel, source, sw, tradeoff, fork } from '../fixtures';

describe('solver', () => {
  it('finds the shortest solution for the tradeoff level', () => {
    const report = solve(tradeoff);
    expect(report.solvable).toBe(true);
    expect(report.minChanges).toBe(2);
    expect(report.solution).toEqual(['a', 'b']);
    expect(report.reachableConfigs).toBe(4);
    expect(report.winningConfigs).toBe(1);
    expect(report.allOnWins).toBe(false);
    expect(report.zeroChangeWin).toBe(false);
  });

  it('its solution replays to a win through the engine', () => {
    const { solution } = solve(tradeoff);
    const actions = [
      ...solution!.map((switchId) => ({ type: 'toggle' as const, switchId })),
      { type: 'run' as const },
    ];
    expect(replay(tradeoff, actions).state.phase).toBe('won');
  });

  it('reports unsolvable when no position wins', () => {
    // Gate 1 needs A on, gate 2 needs A off.
    const impossible = makeLevel({
      nodes: [source(), sw('a'), gate('g1'), gate('g2', false), ball(), goal()],
      signalEdges: [
        { from: 'source', to: 'a' },
        { from: 'a', to: 'g1' },
        { from: 'a', to: 'g2' },
      ],
      track: [['ball', 'g1', 'g2', 'goal']],
    });
    const report = solve(impossible);
    expect(report.solvable).toBe(false);
    expect(report.minChanges).toBeNull();
    expect(report.guessOdds).toBeNull();
  });

  it('reports par wins, first-Run guess odds and idle switches', () => {
    const report = solve(tradeoff);
    expect(report.parWins).toEqual([{ a: true, b: false }]);
    // Two switches, par 2: there is one way to pick two, and it wins.
    expect(report.guessOdds).toBe(1);
    expect(report.idleSwitches).toEqual([]);
    const spare = makeLevel({
      nodes: [source(), sw('a'), sw('b'), sw('c'), gate('g1'), ball(), goal()],
      signalEdges: [
        { from: 'source', to: 'a' },
        { from: 'source', to: 'c' },
        { from: 'a', to: 'g1' },
      ],
      track: [['ball', 'g1', 'goal']],
    });
    const spareReport = solve(spare);
    expect(spareReport.idleSwitches).toEqual(['b', 'c']);
    // Par 1 of 3 switches: a random single change wins 1 time in 3.
    expect(spareReport.guessOdds).toBe(3);
  });

  it('solves junction routing', () => {
    expect(solve(fork).solution).toEqual(['a']);
  });

  it('flags a level a greedy player can solve', () => {
    const easy = makeLevel({
      nodes: [source(), sw('a'), sw('b'), gate('g1'), gate('g2'), ball(), goal()],
      signalEdges: [
        { from: 'source', to: 'a' },
        { from: 'source', to: 'b' },
        { from: 'a', to: 'g1' },
        { from: 'b', to: 'g2' },
      ],
      track: [['ball', 'g1', 'g2', 'goal']],
    });
    expect(solve(easy).greedySolves).toBe(true);
    expect(solve(easy).allOnWins).toBe(true);
  });

  it('the tradeoff level is greedy-solvable, so it only suits early levels', () => {
    // Greedy flips A to open gate 1, then flips B to open gate 2.
    expect(solve(tradeoff).greedySolves).toBe(true);
  });

  it('a false-friend level defeats the greedy player', () => {
    // Gate 1 is A OR C. A is the obvious fix but also closes gate 2; C is the answer.
    const falseFriend = makeLevel({
      nodes: [
        source(),
        sw('a'),
        sw('c'),
        gate('g1', true, 'or'),
        gate('g2', false),
        ball(),
        goal(),
      ],
      signalEdges: [
        { from: 'source', to: 'a' },
        { from: 'source', to: 'c' },
        { from: 'a', to: 'g1' },
        { from: 'c', to: 'g1' },
        { from: 'a', to: 'g2' },
      ],
      track: [['ball', 'g1', 'g2', 'goal']],
    });
    const report = solve(falseFriend);
    expect(report.solution).toEqual(['c']);
    expect(report.greedySolves).toBe(false);
  });

  it('lists switches upstream of a node', () => {
    expect(upstreamSwitches(tradeoff, 'g2')).toEqual(['a', 'b']);
    expect(upstreamSwitches(tradeoff, 'g1')).toEqual(['a']);
  });
});
