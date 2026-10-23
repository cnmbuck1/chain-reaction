import { solve, type SolveReport } from '../engine/solver';
import type { LevelDef } from '../engine/types';
import { validateLevel, type ValidationError } from './schema';

export type CheckCode = ValidationError['code'] | 'UNSOLVABLE' | 'TRIVIAL' | 'MIN_MISMATCH';

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
    errors.push({ code: 'UNSOLVABLE', message: 'No win within the toggle budget' });
    return { level, errors, warnings, report };
  }
  if (report.minChanges !== level.meta.minChanges) {
    errors.push({
      code: 'MIN_MISMATCH',
      message: `meta.minChanges is ${level.meta.minChanges}, solver found ${report.minChanges}`,
    });
  }
  const strict = NEEDS_DEDUCTION.has(level.difficulty);
  const flag = (message: string) => (strict ? errors : warnings).push({ code: 'TRIVIAL', message });
  if (report.zeroChangeWin) errors.push({ code: 'TRIVIAL', message: 'Wins with zero changes' });
  if (report.allOnWins) flag('Turning every switch ON wins');
  if (report.greedySolves) flag('A greedy "fix the blocker" player wins');
  return { level, errors, warnings, report };
}
