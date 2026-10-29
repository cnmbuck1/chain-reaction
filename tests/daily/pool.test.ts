import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, utcDay, weekOf } from '../../src/daily/dates';
import { DAILY_POOL } from '../../src/daily/pool';
import { DAILY_BASES, DAILY_EPOCH, MIN_DAILY_GUESS_ODDS } from '../../src/daily/rules';
import { dailyFor } from '../../src/daily/schedule';
import { shareText } from '../../src/daily/share';
import { applySpec, finishDaily } from '../../src/daily/transform';
import { checkLevel } from '../../src/levels/check';
import { levels } from '../../src/levels';

describe('daily dates', () => {
  it('counts UTC days and finds the Monday of a week', () => {
    expect(utcDay(new Date('2026-10-29T23:59:59Z'))).toBe('2026-10-29');
    expect(daysBetween('2026-10-29', '2026-11-01')).toBe(3);
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(weekOf('2026-10-29')).toBe('2026-10-26'); // a Thursday
    expect(weekOf('2026-11-01')).toBe('2026-10-26'); // a Sunday
    expect(weekOf('2026-11-02')).toBe('2026-11-02'); // a Monday
  });
});

describe('daily pool', () => {
  it('holds a year of distinct variants of the allowed campaign boards', () => {
    expect(DAILY_POOL.length).toBe(365);
    expect(new Set(DAILY_POOL.map((s) => JSON.stringify(s))).size).toBe(365);
    for (const spec of DAILY_POOL) expect(DAILY_BASES).toContain(spec.base);
  });

  it('every daily has one par answer, resists guessing and passes the level checks', () => {
    for (const [i, spec] of DAILY_POOL.entries()) {
      const base = levels.find((l) => l.id === spec.base)!;
      const level = finishDaily(applySpec(base, spec), '2026-10-29');
      expect(level, `pool row ${i}`).not.toBeNull();
      const { errors, report } = checkLevel(level!);
      expect(errors, `pool row ${i}`).toEqual([]);
      expect(report!.parWins).toHaveLength(1);
      expect(report!.guessOdds!, `pool row ${i}`).toBeGreaterThanOrEqual(MIN_DAILY_GUESS_ODDS);
    }
  });
});

describe('daily schedule', () => {
  it('numbers dailies from the first day and wraps around the pool', () => {
    expect(dailyFor(DAILY_EPOCH).number).toBe(1);
    expect(dailyFor(DAILY_EPOCH).level.id).toBe(`daily-${DAILY_EPOCH}`);
    expect(dailyFor(DAILY_EPOCH).level.name).toBe('Thursday 29 Oct');
    expect(dailyFor(addDays(DAILY_EPOCH, 9)).number).toBe(10);
    const later = dailyFor(addDays(DAILY_EPOCH, 365));
    expect(later.number).toBe(366);
    expect(later.level.nodes).toEqual(dailyFor(DAILY_EPOCH).level.nodes);
    // A clock set before the first daily still gets a puzzle.
    expect(dailyFor('2026-01-01').number).toBe(1);
  });

  it('is the same puzzle every time for a date', () => {
    expect(dailyFor('2026-11-05')).toBe(dailyFor('2026-11-05'));
  });
});

describe('daily variants', () => {
  const base = levels.find((l) => l.id === 'level-10')!;
  it('flips switch starts and gate needs, and swaps AND and OR, keeping the layout', () => {
    const switches = base.nodes.filter((n) => n.type === 'switch');
    const gates = base.nodes.filter((n) => n.type === 'gate');
    const multi = gates.findIndex((g) => g.type === 'gate' && g.combine !== 'single');
    const board = applySpec(base, { base: base.id, flips: 1, needs: 1, combine: 1 << multi });
    const first = board.nodes.find((n) => n.id === switches[0]!.id)!;
    expect(first.type === 'switch' && first.initialOn).toBe(!switches[0]!.initialOn);
    const second = board.nodes.find((n) => n.id === switches[1]!.id)!;
    expect(second).toEqual(switches[1]);
    const gate = board.nodes.find((n) => n.id === gates[0]!.id)!;
    expect(gate.type === 'gate' && gate.requiredSignal).toBe(!gates[0]!.requiredSignal);
    const swapped = board.nodes.find((n) => n.id === gates[multi]!.id)!;
    expect(swapped.type === 'gate' && swapped.combine).not.toBe(
      gates[multi]!.type === 'gate' && gates[multi]!.combine,
    );
    expect(board.nodes.map((n) => [n.id, n.x, n.y, n.label])).toEqual(
      base.nodes.map((n) => [n.id, n.x, n.y, n.label]),
    );
    expect(board.track).toBe(base.track);
  });
});

describe('share text', () => {
  it('shows stars, Runs, par, a block per Run and the streak, never the answer', () => {
    expect(shareText(12, { stars: 3, runs: 1, hintsUsed: 0, changes: 3, par: 3 }, 1)).toBe(
      'Chain Reaction Daily #12\n★★★ first Run, par\n🟩',
    );
    expect(shareText(4, { stars: 1, runs: 3, hintsUsed: 1, changes: 5, par: 3 }, 6)).toBe(
      'Chain Reaction Daily #4\n★☆☆ 3 Runs, par +2\n💡🟥🟥🟩\n🔥 6-day streak',
    );
  });
});
