// Stars for one solve. Pure, so the rules are tested without the UI.
//   1 star: the ball reached the goal.
//   2 stars: no hints were used on this solve.
//   3 stars: no hints, and solved on the first Run.

export type Stars = 1 | 2 | 3;

export interface Solve {
  /** Hint moves applied on this solve (free or bought). */
  hintsUsed: number;
  /** No Run failed before this win. */
  firstRun: boolean;
}

export function starsFor(solve: Solve): Stars {
  if (solve.hintsUsed > 0) return 1;
  return solve.firstRun ? 3 : 2;
}

/** What the next star needs, for the result card. Null at three stars. */
export function nextStarTip(solve: Solve): string | null {
  if (solve.hintsUsed > 0) return 'Solve it without a hint for a second star.';
  if (!solve.firstRun) return 'Solve it on the first Run for the third star.';
  return null;
}
