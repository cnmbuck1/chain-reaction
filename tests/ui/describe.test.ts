import { describe, expect, it } from 'vitest';
import { simulateRun } from '../../src/engine/simulate';
import { levels } from '../../src/levels';
import { explainRun, gateRequirement } from '../../src/ui/describe';

const byName = (name: string) => levels.find((l) => l.name === name)!;

describe('gate wording', () => {
  it('labels single, ALL and ANY gates', () => {
    const master = byName('Master Circuit');
    expect(gateRequirement(master, 'g1')).toBe('ANY ON');
    expect(gateRequirement(master, 'g2')).toBe('ALL ON');
    expect(gateRequirement(master, 'g3')).toBe('ALL OFF');
    expect(gateRequirement(byName('First Spark'), 'g1')).toBe('ON');
  });

  it('explains a stop at an ALL ON gate by counting powered wires', () => {
    const level = byName('Two Conditions');
    const run = simulateRun(level, { a: true, b: false, c: true }, 1);
    expect(explainRun(level, run)).toBe(
      'Stopped at Gate 1: it needs power on every wire, but only 1 of 2 had it.',
    );
  });

  it('explains stops at ANY ON and ALL OFF gates', () => {
    const level = byName('Master Circuit');
    const off = { a: false, b: true, c: false, d: false, e: false };
    expect(explainRun(level, simulateRun(level, off, 1))).toBe(
      'Stopped at Gate 1: it needs power on at least one wire, but none had it.',
    );
    const friend = { ...off, e: true };
    // E opens Gate 1 but Gate 2 still needs C and D.
    expect(explainRun(level, simulateRun(level, friend, 1))).toMatch(/^Stopped at Gate 2/);
    const nearly = { a: true, b: true, c: true, d: true, e: false };
    expect(explainRun(level, simulateRun(level, nearly, 1))).toBe(
      'Stopped at Gate 3: it needs every wire dark, but 1 had power.',
    );
  });
});
