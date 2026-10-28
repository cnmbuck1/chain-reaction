import { describe, expect, it } from 'vitest';
import type { LevelDef } from '../../src/engine/types';
import { validateLevel } from '../../src/levels/schema';
import { ball, gate, goal, junction, makeLevel, source, sw, tradeoff, fork } from '../fixtures';

const codes = (level: LevelDef) => validateLevel(level).map((e) => e.code);

describe('level validation', () => {
  it('accepts valid levels', () => {
    expect(validateLevel(tradeoff)).toEqual([]);
    expect(validateLevel(fork)).toEqual([]);
  });

  it('rejects duplicate ids', () => {
    expect(codes({ ...tradeoff, nodes: [...tradeoff.nodes, sw('a')] })).toContain('DUPLICATE_ID');
  });

  it('rejects edges to missing nodes', () => {
    expect(
      codes({ ...tradeoff, signalEdges: [...tradeoff.signalEdges, { from: 'a', to: 'zz' }] }),
    ).toContain('UNKNOWN_NODE');
  });

  it('rejects edges into a source or out of a gate', () => {
    expect(
      codes({ ...tradeoff, signalEdges: [...tradeoff.signalEdges, { from: 'a', to: 'source' }] }),
    ).toContain('BAD_EDGE');
    expect(
      codes({ ...tradeoff, signalEdges: [...tradeoff.signalEdges, { from: 'g1', to: 'g2' }] }),
    ).toContain('BAD_EDGE');
  });

  it('rejects signal cycles', () => {
    const level = makeLevel({
      nodes: [source(), sw('a'), sw('b'), gate('g'), ball(), goal()],
      signalEdges: [
        { from: 'source', to: 'a' },
        { from: 'a', to: 'b' },
        { from: 'b', to: 'a' },
        { from: 'b', to: 'g' },
      ],
      track: [['ball', 'g', 'goal']],
    });
    expect(codes(level)).toContain('SIGNAL_CYCLE');
  });

  it('rejects switches and gates without input', () => {
    const level = makeLevel({
      nodes: [source(), sw('a'), gate('g'), ball(), goal()],
      signalEdges: [],
      track: [['ball', 'g', 'goal']],
    });
    expect(codes(level)).toEqual(expect.arrayContaining(['SWITCH_NO_INPUT', 'GATE_NO_INPUT']));
  });

  it('checks gate arity', () => {
    const level = makeLevel({
      nodes: [source(), sw('a'), gate('g', true, 'and'), ball(), goal()],
      signalEdges: [
        { from: 'source', to: 'a' },
        { from: 'a', to: 'g' },
      ],
      track: [['ball', 'g', 'goal']],
    });
    expect(codes(level)).toContain('GATE_ARITY');
  });

  it('rejects a track that never ends', () => {
    expect(codes({ ...tradeoff, track: [['ball', 'g1', 'g2']] })).toContain('TRACK_SHAPE');
  });

  it('rejects branching outside junctions', () => {
    expect(
      codes({
        ...tradeoff,
        track: [
          ['ball', 'g1', 'goal'],
          ['g1', 'g2', 'goal'],
        ],
      }),
    ).toContain('TRACK_SHAPE');
  });

  it('rejects track loops', () => {
    const level = makeLevel({
      nodes: [source(), sw('a'), junction('j', 'g', 'goal'), gate('g'), ball(), goal()],
      signalEdges: [
        { from: 'source', to: 'a' },
        { from: 'a', to: 'j' },
        { from: 'a', to: 'g' },
      ],
      track: [['ball', 'g', 'j']],
    });
    expect(codes(level)).toContain('TRACK_CYCLE');
  });

  it('rejects gates the ball can never reach', () => {
    expect(codes({ ...tradeoff, track: [['ball', 'g1', 'goal']] })).toContain('NOT_ON_TRACK');
  });

  it('rejects out-of-range positions', () => {
    const moved = tradeoff.nodes.map((n) => (n.id === 'a' ? { ...n, x: 1.5 } : n));
    expect(codes({ ...tradeoff, nodes: moved })).toContain('BAD_POSITION');
  });
});
