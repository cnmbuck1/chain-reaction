// Ads between levels: whether the player has turned them off, and the pacing that decides
// when the next one is due. Stored apart from the wallet, under its own key, because the
// stores restore the purchase on their own once the native app exists.
// Reads never throw: anything missing or malformed falls back to a fresh record.

import {
  INTERSTITIAL_EVERY,
  INTERSTITIAL_FROM_LEVEL,
  INTERSTITIAL_GAP_MS,
} from '../monetize/prices';

export interface AdState {
  version: 1;
  /** Remove ads, or any coin pack, was bought: no ads between levels, ever. */
  adFree: boolean;
  /** Levels solved since the last ad, counted from INTERSTITIAL_FROM_LEVEL on. */
  solves: number;
  /** When the last ad between levels showed, in ms since the epoch; 0 for never. */
  lastAt: number;
}

export const ADS_KEY = 'chain-reaction/ads';

type KeyValueStore = Pick<Storage, 'getItem' | 'setItem'>;

export const freshAds = (): AdState => ({ version: 1, adFree: false, solves: 0, lastAt: 0 });

function defaultStore(): KeyValueStore | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadAds(store: KeyValueStore | null = defaultStore()): AdState {
  try {
    const raw = store?.getItem(ADS_KEY);
    return raw ? migrateAds(JSON.parse(raw)) : freshAds();
  } catch {
    return freshAds();
  }
}

export function saveAds(ads: AdState, store: KeyValueStore | null = defaultStore()) {
  try {
    store?.setItem(ADS_KEY, JSON.stringify(ads));
  } catch {
    // Storage full or blocked: the record lasts for this session only.
  }
}

const isCount = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0;

export function migrateAds(data: unknown): AdState {
  if (typeof data !== 'object' || data === null) return freshAds();
  const { version, adFree, solves, lastAt } = data as Record<string, unknown>;
  if (version !== 1) return freshAds();
  return {
    version: 1,
    adFree: adFree === true,
    solves: isCount(solves) ? solves : 0,
    lastAt: isCount(lastAt) ? lastAt : 0,
  };
}

export interface Solved {
  /** The level's number in the campaign, from 1. */
  level: number;
  /** Solved without a missed Run or a hint on this visit. */
  clean: boolean;
  now: number;
}

/**
 * Counts a solved campaign level and says whether an ad is due once the player leaves the
 * result card. Never before INTERSTITIAL_FROM_LEVEL, never right after a miss or a hint,
 * never within INTERSTITIAL_GAP_MS of the last one, and never for ad-free players. A due
 * ad that one of those rules holds back waits for the next clean solve.
 */
export function afterSolve(
  ads: AdState,
  { level, clean, now }: Solved,
): {
  ads: AdState;
  show: boolean;
} {
  if (ads.adFree || level < INTERSTITIAL_FROM_LEVEL) return { ads, show: false };
  const solves = ads.solves + 1;
  const show = clean && solves >= INTERSTITIAL_EVERY && now - ads.lastAt >= INTERSTITIAL_GAP_MS;
  return show
    ? { ads: { ...ads, solves: 0, lastAt: now }, show }
    : { ads: { ...ads, solves }, show };
}

/** Remove ads or a coin pack was bought. */
export const goAdFree = (ads: AdState): AdState => (ads.adFree ? ads : { ...ads, adFree: true });
