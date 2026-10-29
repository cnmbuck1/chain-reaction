import { describe, expect, it } from 'vitest';
import {
  AD_COINS_PER_DAY,
  FREE_RETRIES,
  HINT_PRICE,
  RETRY_PRICE,
  STARTING_COINS,
} from '../../src/monetize/prices';
import {
  adsLeftToday,
  buyRetry,
  freeMovesUsed,
  freshWallet,
  FULL_RUNS,
  grantCoins,
  loadWallet,
  migrateWallet,
  refillRuns,
  rewardAd,
  runsLeft,
  saveWallet,
  spendFreeMove,
  spendRun,
  WALLET_KEY,
} from '../../src/storage/wallet';

function memoryStore() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
}

describe('wallet', () => {
  it('starts with the coins two hints used to be', () => {
    expect(STARTING_COINS).toBe(2 * HINT_PRICE);
    expect(loadWallet(memoryStore())).toEqual({
      version: 2,
      coins: STARTING_COINS,
      used: {},
      runs: {},
      ads: { day: '', count: 0 },
    });
  });

  it('upgrades an old hint wallet at 10 coins a hint, keeping its free moves', () => {
    expect(migrateWallet({ version: 1, balance: 3, used: { 'level-07': 1 } })).toEqual({
      ...freshWallet(),
      coins: 30,
      used: { 'level-07': 1 },
    });
    expect(migrateWallet({ version: 1, balance: 0, used: {} }).coins).toBe(0);
    expect(migrateWallet({ version: 1, balance: -2 })).toEqual(freshWallet());
  });

  it('pays for each free move and remembers moves per level', () => {
    let wallet = freshWallet();
    for (let i = 0; i < 2; i++) {
      const r = spendFreeMove(wallet, 'level-10', 3, HINT_PRICE);
      expect(r.ok).toBe(true);
      if (r.ok) wallet = r.wallet;
    }
    expect(wallet.coins).toBe(0);
    expect(freeMovesUsed(wallet, 'level-10')).toBe(2);
    expect(spendFreeMove(wallet, 'level-10', 3, HINT_PRICE)).toEqual({
      ok: false,
      reason: 'coins',
    });
    // After an ad, the move costs nothing.
    const ad = spendFreeMove(wallet, 'level-10', 3, 0);
    expect(ad.ok && freeMovesUsed(ad.wallet, 'level-10')).toBe(3);
    if (ad.ok)
      expect(spendFreeMove(ad.wallet, 'level-10', 3, 0)).toEqual({ ok: false, reason: 'done' });
  });

  it('passes over stale moves for one hint, never past the end of the plan', () => {
    const r = spendFreeMove(freshWallet(), 'level-19', 3, HINT_PRICE, 2);
    expect(r.ok && r.wallet.coins).toBe(STARTING_COINS - HINT_PRICE);
    expect(r.ok && freeMovesUsed(r.wallet, 'level-19')).toBe(2);
    const capped = spendFreeMove(freshWallet(), 'level-19', 3, 0, 9);
    expect(capped.ok && freeMovesUsed(capped.wallet, 'level-19')).toBe(3);
  });

  it('grants whole positive amounts only', () => {
    expect(grantCoins(freshWallet(), 5).coins).toBe(25);
    expect(grantCoins(freshWallet(), -3).coins).toBe(20);
    expect(grantCoins(freshWallet(), 1.7).coins).toBe(21);
  });

  it('gives each level a first Run and two free retries, then sells retries', () => {
    expect(FULL_RUNS).toBe(1 + FREE_RETRIES);
    let wallet = freshWallet();
    for (let i = 0; i < FULL_RUNS; i++) wallet = spendRun(wallet, 'level-12');
    expect(runsLeft(wallet, 'level-12')).toBe(0);
    expect(runsLeft(wallet, 'level-13')).toBe(FULL_RUNS);
    // A miss with none left stays at none.
    expect(runsLeft(spendRun(wallet, 'level-12'), 'level-12')).toBe(0);

    const bought = buyRetry(wallet, 'level-12', RETRY_PRICE)!;
    expect(bought.coins).toBe(STARTING_COINS - RETRY_PRICE);
    expect(runsLeft(bought, 'level-12')).toBe(1);
    const viaAd = buyRetry(wallet, 'level-12', 0)!;
    expect(viaAd.coins).toBe(STARTING_COINS);
    expect(buyRetry({ ...wallet, coins: RETRY_PRICE - 1 }, 'level-12', RETRY_PRICE)).toBeNull();
  });

  it('refills a level’s Runs when it is solved', () => {
    const wallet = spendRun(spendRun(freshWallet(), 'level-12'), 'level-14');
    const solved = refillRuns(wallet, 'level-12');
    expect(runsLeft(solved, 'level-12')).toBe(FULL_RUNS);
    expect(runsLeft(solved, 'level-14')).toBe(FULL_RUNS - 1);
    expect(refillRuns(solved, 'level-12')).toBe(solved);
  });

  it('pays for coin ads up to the daily limit, counted by UTC day', () => {
    const day1 = new Date('2026-10-28T23:00:00Z');
    let wallet = freshWallet();
    for (let i = 0; i < AD_COINS_PER_DAY; i++) wallet = rewardAd(wallet, day1)!;
    expect(wallet.coins).toBe(STARTING_COINS + 25);
    expect(adsLeftToday(wallet, day1)).toBe(0);
    expect(rewardAd(wallet, day1)).toBeNull();
    const day2 = new Date('2026-10-29T00:30:00Z');
    expect(adsLeftToday(wallet, day2)).toBe(AD_COINS_PER_DAY);
    expect(rewardAd(wallet, day2)!.ads).toEqual({ day: '2026-10-29', count: 1 });
  });

  it('round-trips and cleans bad data', () => {
    const store = memoryStore();
    const wallet = {
      ...freshWallet(),
      coins: 42,
      used: { 'level-07': 1 },
      runs: { 'level-12': 0 },
      ads: { day: '2026-10-28', count: 2 },
    };
    saveWallet(wallet, store);
    expect(loadWallet(store)).toEqual(wallet);
    expect(
      migrateWallet({
        version: 2,
        coins: 7,
        used: { a: 99, b: -1, c: 'x', d: 3, e: 0 },
        runs: { a: 9, b: 1, c: -1 },
        ads: { day: 5 },
      }),
    ).toEqual({ ...freshWallet(), coins: 7, used: { d: 3 }, runs: { b: 1 } });
    expect(migrateWallet({ version: 2, coins: -2 })).toEqual(freshWallet());
    expect(migrateWallet({ version: 3, coins: 9 })).toEqual(freshWallet());
    store.data.set(WALLET_KEY, '{broken');
    expect(loadWallet(store)).toEqual(freshWallet());
    expect(loadWallet(null)).toEqual(freshWallet());
  });
});
