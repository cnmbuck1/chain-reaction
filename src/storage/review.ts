// The App Store rating prompt: when the game last asked, so it asks at a happy moment and
// rarely. Apple decides whether the prompt really shows (never in TestFlight, at most three
// times a year, never again once rated); this only picks the moments worth offering.
// Reads never throw: anything missing or malformed falls back to a fresh record.

import {
  REVIEW_FROM_LEVEL,
  REVIEW_GAP_MS,
  REVIEW_LEVEL_GAP,
  REVIEW_MAX_ASKS,
} from '../monetize/prices';

export interface ReviewState {
  version: 1;
  /** Times the prompt has been asked for. */
  asks: number;
  /** When it was last asked for, in ms since the epoch; 0 for never. */
  lastAt: number;
  /** The campaign level that last asked; 0 for never. */
  lastLevel: number;
}

export const REVIEW_KEY = 'chain-reaction/review';

type KeyValueStore = Pick<Storage, 'getItem' | 'setItem'>;

export const freshReview = (): ReviewState => ({ version: 1, asks: 0, lastAt: 0, lastLevel: 0 });

function defaultStore(): KeyValueStore | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadReview(store: KeyValueStore | null = defaultStore()): ReviewState {
  try {
    const raw = store?.getItem(REVIEW_KEY);
    return raw ? migrateReview(JSON.parse(raw)) : freshReview();
  } catch {
    return freshReview();
  }
}

export function saveReview(review: ReviewState, store: KeyValueStore | null = defaultStore()) {
  try {
    store?.setItem(REVIEW_KEY, JSON.stringify(review));
  } catch {
    // Storage full or blocked: the record lasts for this session only.
  }
}

const isCount = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0;

export function migrateReview(data: unknown): ReviewState {
  if (typeof data !== 'object' || data === null) return freshReview();
  const { version, asks, lastAt, lastLevel } = data as Record<string, unknown>;
  if (version !== 1) return freshReview();
  return {
    version: 1,
    asks: isCount(asks) ? asks : 0,
    lastAt: isCount(lastAt) ? lastAt : 0,
    lastLevel: isCount(lastLevel) ? lastLevel : 0,
  };
}

export interface ReviewMoment {
  /** The campaign level just solved, from 1. */
  level: number;
  /** Solved for the first time (not a replay). */
  firstSolve: boolean;
  /** Solved without a missed Run or a hint on this visit. */
  clean: boolean;
  /** An ad between levels is due once the player leaves the result card. */
  adDue: boolean;
  now: number;
}

/**
 * Whether to ask for a rating on this solve's result card: a clean first solve from
 * REVIEW_FROM_LEVEL on, never on a solve that has an ad coming, then again only after
 * REVIEW_LEVEL_GAP more levels and REVIEW_GAP_MS, and at most REVIEW_MAX_ASKS times.
 */
export function reviewAfterSolve(
  review: ReviewState,
  { level, firstSolve, clean, adDue, now }: ReviewMoment,
): { review: ReviewState; ask: boolean } {
  const ask =
    firstSolve &&
    clean &&
    !adDue &&
    level >= REVIEW_FROM_LEVEL &&
    review.asks < REVIEW_MAX_ASKS &&
    (review.asks === 0 ||
      (level - review.lastLevel >= REVIEW_LEVEL_GAP && now - review.lastAt >= REVIEW_GAP_MS));
  return ask
    ? { review: { version: 1, asks: review.asks + 1, lastAt: now, lastLevel: level }, ask }
    : { review, ask };
}
