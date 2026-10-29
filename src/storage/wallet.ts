// The wallet: coins, the free moves each level has used, and the Runs each level has left.
// Stored apart from progress so resetting progress never refills coins or retries.
// Reads never throw: anything missing or malformed falls back to a fresh wallet.

import {
  AD_COINS,
  AD_COINS_PER_DAY,
  FREE_RETRIES,
  HINT_PRICE,
  STARTING_COINS,
} from '../monetize/prices';

/** Upper bound on free moves per level when reading stored data. */
const MAX_MOVES = 10;
/** Runs a level gives before any retry is bought: the first Run plus the free retries. */
export const FULL_RUNS = 1 + FREE_RETRIES;

export interface Wallet {
  version: 2;
  coins: number;
  /** Free moves used per level id. They stay applied until a solved level is replayed. */
  used: Record<string, number>;
  /** Runs left per level id, once a Run has missed there. Absent means FULL_RUNS. */
  runs: Record<string, number>;
  /** Rewarded ads watched for coins on one UTC day. */
  ads: { day: string; count: number };
}

/** The same storage key as the old hint wallet, which this one replaces. */
export const WALLET_KEY = 'chain-reaction/hints';

type KeyValueStore = Pick<Storage, 'getItem' | 'setItem'>;

export const freshWallet = (): Wallet => ({
  version: 2,
  coins: STARTING_COINS,
  used: {},
  runs: {},
  ads: { day: '', count: 0 },
});

function defaultStore(): KeyValueStore | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadWallet(store: KeyValueStore | null = defaultStore()): Wallet {
  try {
    const raw = store?.getItem(WALLET_KEY);
    return raw ? migrateWallet(JSON.parse(raw)) : freshWallet();
  } catch {
    return freshWallet();
  }
}

export function saveWallet(wallet: Wallet, store: KeyValueStore | null = defaultStore()) {
  try {
    store?.setItem(WALLET_KEY, JSON.stringify(wallet));
  } catch {
    // Storage full or blocked: the wallet lasts for this session only.
  }
}

const isCount = (n: unknown, max = Number.MAX_SAFE_INTEGER): n is number =>
  typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= max;

function counts(data: unknown, max: number, keep: (n: number) => boolean) {
  const clean: Record<string, number> = {};
  if (typeof data === 'object' && data !== null) {
    for (const [id, n] of Object.entries(data)) if (isCount(n, max) && keep(n)) clean[id] = n;
  }
  return clean;
}

/** Reads a stored wallet. A version 1 hint wallet converts each hint to HINT_PRICE coins. */
export function migrateWallet(data: unknown): Wallet {
  if (typeof data !== 'object' || data === null) return freshWallet();
  const d = data as Record<string, unknown>;
  const used = counts(d.used, MAX_MOVES, (n) => n > 0);
  if (d.version === 1) {
    return isCount(d.balance)
      ? { ...freshWallet(), coins: d.balance * HINT_PRICE, used }
      : freshWallet();
  }
  if (d.version !== 2 || !isCount(d.coins)) return freshWallet();
  const ads = d.ads as Record<string, unknown> | undefined;
  return {
    version: 2,
    coins: d.coins,
    used,
    runs: counts(d.runs, FULL_RUNS - 1, () => true),
    ads:
      typeof ads?.day === 'string' && isCount(ads.count)
        ? { day: ads.day, count: ads.count }
        : { day: '', count: 0 },
  };
}

export const freeMovesUsed = (wallet: Wallet, levelId: string) => wallet.used[levelId] ?? 0;

export type HintResult = { ok: true; wallet: Wallet } | { ok: false; reason: 'coins' | 'done' };

/**
 * Takes the next free move for a level, for `cost` coins (0 on free levels or after an ad).
 * `available` is how many free moves the level offers. `moves` above 1 also passes over
 * moves the player no longer needs, such as those in a part of the board already cleared.
 */
export function spendFreeMove(
  wallet: Wallet,
  levelId: string,
  available: number,
  cost: number,
  moves = 1,
): HintResult {
  const used = freeMovesUsed(wallet, levelId);
  if (used >= available) return { ok: false, reason: 'done' };
  if (wallet.coins < cost) return { ok: false, reason: 'coins' };
  return {
    ok: true,
    wallet: {
      ...wallet,
      coins: wallet.coins - cost,
      used: { ...wallet.used, [levelId]: Math.min(available, used + Math.max(1, moves)) },
    },
  };
}

export function grantCoins(wallet: Wallet, count: number): Wallet {
  return { ...wallet, coins: wallet.coins + Math.max(0, Math.floor(count)) };
}

/** Runs the player can still start on a level before buying a retry. */
export const runsLeft = (wallet: Wallet, levelId: string) => wallet.runs[levelId] ?? FULL_RUNS;

/** A Run missed: it used up one of the level's Runs. */
export function spendRun(wallet: Wallet, levelId: string): Wallet {
  return {
    ...wallet,
    runs: { ...wallet.runs, [levelId]: Math.max(0, runsLeft(wallet, levelId) - 1) },
  };
}

/** Buys one retry for `cost` coins (0 after an ad); null if the coins aren't there. */
export function buyRetry(wallet: Wallet, levelId: string, cost: number): Wallet | null {
  if (wallet.coins < cost) return null;
  const left = Math.min(FULL_RUNS, runsLeft(wallet, levelId) + 1);
  const runs = { ...wallet.runs };
  if (left >= FULL_RUNS) delete runs[levelId];
  else runs[levelId] = left;
  return { ...wallet, coins: wallet.coins - cost, runs };
}

/** Solving a level gives it back all its Runs. */
export function refillRuns(wallet: Wallet, levelId: string): Wallet {
  if (!(levelId in wallet.runs)) return wallet;
  const runs = { ...wallet.runs };
  delete runs[levelId];
  return { ...wallet, runs };
}

/** Today's date in UTC, the day rewarded-ad limits count by. */
export const utcDay = (now: Date) => now.toISOString().slice(0, 10);

/** Coin ads the player can still watch today. */
export function adsLeftToday(wallet: Wallet, now: Date): number {
  const count = wallet.ads.day === utcDay(now) ? wallet.ads.count : 0;
  return Math.max(0, AD_COINS_PER_DAY - count);
}

/** Pays AD_COINS for a watched ad; null once today's limit is reached. */
export function rewardAd(wallet: Wallet, now: Date): Wallet | null {
  if (adsLeftToday(wallet, now) === 0) return null;
  const day = utcDay(now);
  const count = (wallet.ads.day === day ? wallet.ads.count : 0) + 1;
  return { ...grantCoins(wallet, AD_COINS), ads: { day, count } };
}
