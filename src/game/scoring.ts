// Stars for one solve. Pure, so the rules are tested without the UI.
//   1 star: the ball reached the goal.
//   2 stars: no hints were used on this solve.
//   3 stars: no hints, on the first Run, at par (the fewest changes that win).

export type Stars = 1 | 2 | 3;

export interface Solve {
  /** Hint moves applied on this solve (free or bought). */
  hintsUsed: number;
  /** The level's first Run, and it won: no earlier Run on this level, ever. */
  firstRun: boolean;
  /** Switches that ended away from their starting position. */
  changes: number;
  /** The fewest changes that win (`meta.minChanges`). */
  par: number;
}

export function starsFor(solve: Solve): Stars {
  if (solve.hintsUsed > 0) return 1;
  return solve.firstRun && solve.changes <= solve.par ? 3 : 2;
}

/** What the next star needs, for the result card. Null at three stars. */
export function nextStarTip(solve: Solve): string | null {
  if (solve.hintsUsed > 0) return 'Solve it without a hint for a second star.';
  if (starsFor(solve) === 3) return null;
  if (solve.changes > solve.par)
    return `Par is ${solve.par} ${solve.par === 1 ? 'change' : 'changes'}. The third star needs a first-Run solve at par.`;
  return 'The third star needs a solve on your first Run.';
}
