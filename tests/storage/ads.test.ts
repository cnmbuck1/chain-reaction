import { describe, expect, it } from 'vitest';
import {
  INTERSTITIAL_EVERY,
  INTERSTITIAL_FROM_LEVEL,
  INTERSTITIAL_GAP_MS,
} from '../../src/monetize/prices';
import {
  ADS_KEY,
  afterSolve,
  freshAds,
  goAdFree,
  loadAds,
  migrateAds,
  saveAds,
  type AdState,
} from '../../src/storage/ads';

const T0 = 1_800_000_000_000;

/** Solves levels from `from` on, one a minute; returns the times an ad showed. */
function play(ads: AdState, count: number, from = 12, clean = () => true, start = T0) {
  const shown: number[] = [];
  for (let i = 0; i < count; i++) {
    const now = start + i * 60_000;
    const r = afterSolve(ads, { level: from + i, clean: clean(), now });
    ads = r.ads;
    if (r.show) shown.push(i);
  }
  return { ads, shown };
}

describe('ads between levels', () => {
  it('shows one after every third solve, at most one per four minutes', () => {
    expect([INTERSTITIAL_EVERY, INTERSTITIAL_GAP_MS]).toEqual([3, 240_000]);
    // Solves a minute apart: the 3rd shows; the 6th waits for the gap and shows on the 7th.
    expect(play(freshAds(), 12).shown).toEqual([2, 6, 10]);
  });

  it('never before level 10', () => {
    expect(INTERSTITIAL_FROM_LEVEL).toBe(10);
    const early = play(freshAds(), 9, 1);
    expect(early.shown).toEqual([]);
    expect(early.ads.solves).toBe(0);
  });

  it('never right after a miss or a hint: the due ad waits for a clean solve', () => {
    const cleanness = [true, true, false, false, true];
    let i = 0;
    expect(play(freshAds(), 5, 12, () => cleanness[i++]!).shown).toEqual([4]);
  });

  it('never for players who bought Remove ads or coins', () => {
    const ads = goAdFree(freshAds());
    expect(play(ads, 12).shown).toEqual([]);
    expect(goAdFree(ads)).toBe(ads);
  });

  it('round-trips and cleans bad data', () => {
    const data = new Map<string, string>();
    const store = {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
    };
    const ads: AdState = { version: 1, adFree: true, solves: 2, lastAt: T0 };
    saveAds(ads, store);
    expect(loadAds(store)).toEqual(ads);
    expect(migrateAds({ version: 1, adFree: 'yes', solves: -1, lastAt: 1.5 })).toEqual(freshAds());
    expect(migrateAds({ version: 2, adFree: true })).toEqual(freshAds());
    data.set(ADS_KEY, '{broken');
    expect(loadAds(store)).toEqual(freshAds());
    expect(loadAds(null)).toEqual(freshAds());
  });
});
