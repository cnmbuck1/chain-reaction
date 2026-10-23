import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/engine/evaluate';
import { indexLevel } from '../../src/engine/graph';
import { ball, gate, goal, makeLevel, source, sw } from '../fixtures';

const run = (level: ReturnType<typeof makeLevel>, switches: Record<string, boolean>) =>
  evaluate(indexLevel(level), switches);

describe('signal evaluation', () => {
  const series = makeLevel({
    nodes: [source(), sw('a'), sw('b'), gate('g'), ball(), goal()],
    signalEdges: [
      { from: 'source', to: 'a' },
      { from: 'a', to: 'b' },
      { from: 'b', to: 'g' },
    ],
    track: [['ball', 'g', 'goal']],
  });

  it('powers a switch only when it is ON and fed', () => {
    expect(run(series, { a: true, b: true }).signals.get('b')).toBe(true);
    expect(run(series, { a: false, b: true }).signals.get('b')).toBe(false);
    expect(run(series, { a: true, b: false }).signals.get('b')).toBe(false);
  });

  it('opens a normally-closed gate only on TRUE', () => {
    expect(run(series, { a: true, b: true }).gateOpen.get('g')).toBe(true);
    expect(run(series, { a: true, b: false }).gateOpen.get('g')).toBe(false);
  });

  it('opens a normally-open gate on FALSE, including no power at all', () => {
    const level = makeLevel({
      nodes: [source(), sw('a'), gate('g', false), ball(), goal()],
      signalEdges: [
        { from: 'source', to: 'a' },
        { from: 'a', to: 'g' },
      ],
      track: [['ball', 'g', 'goal']],
    });
    expect(run(level, { a: false }).gateOpen.get('g')).toBe(true);
    expect(run(level, { a: true }).gateOpen.get('g')).toBe(false);
  });

  it('inverts an inverted wire at the receiving end', () => {
    const level = makeLevel({
      nodes: [source(), sw('a'), gate('g'), ball(), goal()],
      signalEdges: [
        { from: 'source', to: 'a' },
        { from: 'a', to: 'g', invert: true },
      ],
      track: [['ball', 'g', 'goal']],
    });
    expect(run(level, { a: false }).gateOpen.get('g')).toBe(true);
    expect(run(level, { a: true }).gateOpen.get('g')).toBe(false);
  });

  it.each([
    ['and', false, false, false],
    ['and', true, false, false],
    ['and', true, true, true],
    ['or', false, false, false],
    ['or', true, false, true],
    ['or', true, true, true],
  ] as const)('%s gate with inputs %s, %s gives %s', (combine, a, b, expected) => {
    const level = makeLevel({
      nodes: [source(), sw('a'), sw('b'), gate('g', true, combine), ball(), goal()],
      signalEdges: [
        { from: 'source', to: 'a' },
        { from: 'source', to: 'b' },
        { from: 'a', to: 'g' },
        { from: 'b', to: 'g' },
      ],
      track: [['ball', 'g', 'goal']],
    });
    expect(run(level, { a, b }).sinkInputs.get('g')).toBe(expected);
  });

  it('emits signal and wire events in topological order with id tiebreaks', () => {
    const events = run(series, { a: true, b: true }).events.map((e) =>
      e.type === 'signal'
        ? `signal:${e.nodeId}`
        : e.type === 'wire'
          ? `wire:${e.from}>${e.to}`
          : `gate:${'gateId' in e ? e.gateId : ''}`,
    );
    expect(events).toEqual([
      'signal:source',
      'wire:source>a',
      'signal:a',
      'wire:a>b',
      'signal:b',
      'wire:b>g',
      'gate:g',
    ]);
  });
});
