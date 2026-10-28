import { solve, type SolveReport } from '../engine/solver';
import { initialState } from '../engine/reducer';
import type { LevelDef } from '../engine/types';
import { validateLevel, type ValidationError } from './schema';

export type CheckCode =
  ValidationError['code'] | 'UNSOLVABLE' | 'TRIVIAL' | 'MIN_MISMATCH' | 'BAD_HINT';

export interface LevelCheck {
  level: LevelDef;
  errors: { code: CheckCode; message: string }[];
  warnings: { code: CheckCode; message: string }[];
  report: SolveReport | null;
}

/** Levels from this difficulty upward must not be trivial or greedy-solvable. */
const NEEDS_DEDUCTION: ReadonlySet<LevelDef['difficulty']> = new Set(['medium', 'hard']);

/** Full check of an authored level: structure, then solver results. */
export function checkLevel(level: LevelDef): LevelCheck {
  const errors: LevelCheck['errors'] = validateLevel(level).map(({ code, message }) => ({
    code,
    message,
  }));
  const warnings: LevelCheck['warnings'] = [];
  if (errors.length > 0) return { level, errors, warnings, report: null };

  const report = solve(level);
  if (!report.solvable) {
    errors.push({ code: 'UNSOLVABLE', message: 'No switch positions win' });
    return { level, errors, warnings, report };
  }
  if (report.minChanges !== level.meta.minChanges) {
    errors.push({
      code: 'MIN_MISMATCH',
      message: `meta.minChanges is ${level.meta.minChanges}, solver found ${report.minChanges}`,
    });
  }
  errors.push(...checkHints(level, report));
  const strict = NEEDS_DEDUCTION.has(level.difficulty);
  const flag = (message: string) => (strict ? errors : warnings).push({ code: 'TRIVIAL', message });
  if (report.zeroChangeWin) errors.push({ code: 'TRIVIAL', message: 'Wins with zero changes' });
  if (report.allOnWins) flag('Turning every switch ON wins');
  if (report.greedySolves) flag('A greedy "fix the blocker" player wins at par');
  if (report.parWins.length > 1)
    flag(`${report.parWins.length} different positions win at par; aim for one`);
  return { level, errors, warnings, report };
}

/** The first hinted switch must be one every par solution changes the same way. */
function checkHints(level: LevelDef, report: SolveReport): LevelCheck['errors'] {
  const errors: LevelCheck['errors'] = [];
  const bad = (message: string) => errors.push({ code: 'BAD_HINT', message });
  const node = (id: string) => level.nodes.find((n) => n.id === id);
  const { keySwitch } = level.meta;
  if (keySwitch === undefined) return errors;
  if (node(keySwitch)?.type !== 'switch') {
    bad(`meta.keySwitch ${keySwitch} is not a switch`);
    return errors;
  }
  const start = initialState(level).switches[keySwitch];
  const finals = new Set(report.parWins.map((w) => w[keySwitch]));
  if (finals.size !== 1)
    bad(`meta.keySwitch ${keySwitch} ends ON in some solutions and OFF in others`);
  else if (finals.has(start)) bad(`meta.keySwitch ${keySwitch} never needs to change`);
  return errors;
}
