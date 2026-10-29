import { switchStage } from '../engine/graph';
import { solve } from '../engine/solver';
import { turnsFor } from '../engine/reducer';
import type { GateNode, LevelDef } from '../engine/types';

// Daily puzzles are campaign boards made new: switches start in other positions, and gates
// want the opposite signal or combine their wires the other way. The layout and letters
// stay, so every daily board is one the renderer already fits.
// Only variants the solver accepts make it into the pool (see scripts/daily-pool.ts).

/**
 * One variant of a base level: bit i of `flips` turns the i-th switch's start over, bit i
 * of `needs` flips the i-th gate's required signal and bit i of `combine` swaps the i-th
 * gate between AND and OR (gates with one wire ignore it).
 */
export interface DailySpec {
  base: string;
  flips: number;
  needs: number;
  combine: number;
}

const bit = (mask: number, i: number) => ((mask >> i) & 1) === 1;

/** The variant's board, without par: `finishDaily` adds the solver's numbers. */
export function applySpec(base: LevelDef, spec: DailySpec): LevelDef {
  let s = 0;
  let g = 0;
  const nodes = base.nodes.map((n) => {
    if (n.type === 'switch') {
      const i = s++;
      return !n.locked && bit(spec.flips, i) ? { ...n, initialOn: !n.initialOn } : n;
    }
    if (n.type === 'gate') {
      const i = g++;
      const out: GateNode = { ...n };
      if (bit(spec.needs, i)) out.requiredSignal = !n.requiredSignal;
      if (n.combine !== 'single' && bit(spec.combine, i))
        out.combine = n.combine === 'and' ? 'or' : 'and';
      return out;
    }
    return n;
  });
  return { ...base, nodes };
}

const dateName = new Intl.DateTimeFormat('en-GB', {
  weekday: 'long',
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});

/**
 * A playable daily level: par from the solver, and the key switch the first hint sets (the
 * first switch the one par solution changes). Null if the variant has no single par answer.
 */
/** `day` is the UTC date the daily belongs to, as YYYY-MM-DD. */
export function finishDaily(board: LevelDef, day: string): LevelDef | null {
  const report = solve(board);
  const win = report.parWins[0];
  if (report.parWins.length !== 1 || !win || report.minChanges === null) return null;
  // The first hint helps where the player starts: a changed switch in the earliest part.
  const changed = new Set(turnsFor(board, win));
  const key = board.nodes
    .filter((n) => n.type === 'switch' && changed.has(n.id))
    .sort((a, b) => switchStage(a) - switchStage(b))[0]?.id;
  return {
    ...board,
    id: `daily-${day}`,
    // "Thursday 29 Oct": the eyebrow carries the number.
    name: dateName.format(new Date(`${day}T00:00:00Z`)).replace(',', ''),
    difficulty: 'hard',
    meta: {
      teachingPoint: 'A new machine every day, the same for everyone. Come back tomorrow.',
      hint: 'Trace each gate back to the switches that feed it.',
      minChanges: report.minChanges,
      ...(key ? { keySwitch: key } : {}),
    },
  };
}
