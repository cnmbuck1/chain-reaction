// What makes a daily puzzle, and when it opens.

/** Campaign boards daily puzzles are made from: gates, forks and two-part boards only. */
export const DAILY_BASES: readonly string[] = Array.from(
  { length: 27 },
  (_, i) => `level-${String(i + 4).padStart(2, '0')}`,
);

/** A daily must not be guessable: a random pick of par switches wins at most 1 time in this many. */
export const MIN_DAILY_GUESS_ODDS = 10;

/** Campaign levels to solve before the daily puzzle opens. */
export const DAILY_UNLOCK_LEVELS = 10;

/** The first daily puzzle's UTC date: Daily #1. */
export const DAILY_EPOCH = '2026-10-29';
