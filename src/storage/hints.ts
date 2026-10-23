// The hint wallet: how many hints the player holds and which hint steps each level has
// unlocked. Stored apart from progress so resetting progress never refills free hints.
// Reads never throw: anything missing or malformed falls back to a fresh wallet.

export const FREE_HINTS = 2;
/** Nudge, focus, one move. */
export const HINT_STEPS = 3;

export interface HintWallet {
  version: 1;
  balance: number;
  /** Steps unlocked per level id, 0..HINT_STEPS. Unlocked steps stay unlocked. */
  unlocked: Record<string, number>;
}

export const HINTS_KEY = 'chain-reaction/hints';

type KeyValueStore = Pick<Storage, 'getItem' | 'setItem'>;

export const freshWallet = (): HintWallet => ({ version: 1, balance: FREE_HINTS, unlocked: {} });

function defaultStore(): KeyValueStore | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadHints(store: KeyValueStore | null = defaultStore()): HintWallet {
  try {
    const raw = store?.getItem(HINTS_KEY);
    return raw ? migrateHints(JSON.parse(raw)) : freshWallet();
  } catch {
    return freshWallet();
  }
}

export function saveHints(wallet: HintWallet, store: KeyValueStore | null = defaultStore()) {
  try {
    store?.setItem(HINTS_KEY, JSON.stringify(wallet));
  } catch {
    // Storage full or blocked: the wallet lasts for this session only.
  }
}

const isCount = (n: unknown, max = Number.MAX_SAFE_INTEGER): n is number =>
  typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= max;

export function migrateHints(data: unknown): HintWallet {
  if (typeof data !== 'object' || data === null) return freshWallet();
  const { version, balance, unlocked } = data as Record<string, unknown>;
  if (version !== 1 || !isCount(balance)) return freshWallet();
  const clean: Record<string, number> = {};
  if (typeof unlocked === 'object' && unlocked !== null) {
    for (const [id, steps] of Object.entries(unlocked)) {
      if (isCount(steps, HINT_STEPS) && steps > 0) clean[id] = steps;
    }
  }
  return { version: 1, balance, unlocked: clean };
}

export const stepsUnlocked = (wallet: HintWallet, levelId: string) => wallet.unlocked[levelId] ?? 0;

export type UnlockResult =
  { ok: true; wallet: HintWallet } | { ok: false; reason: 'empty' | 'done' };

/** Unlocks the next hint step for a level, spending one hint unless the level's hints are free. */
export function unlockNextStep(wallet: HintWallet, levelId: string, free: boolean): UnlockResult {
  const steps = stepsUnlocked(wallet, levelId);
  if (steps >= HINT_STEPS) return { ok: false, reason: 'done' };
  if (!free && wallet.balance < 1) return { ok: false, reason: 'empty' };
  return {
    ok: true,
    wallet: {
      ...wallet,
      balance: free ? wallet.balance : wallet.balance - 1,
      unlocked: { ...wallet.unlocked, [levelId]: steps + 1 },
    },
  };
}

export function grantHints(wallet: HintWallet, count: number): HintWallet {
  return { ...wallet, balance: wallet.balance + Math.max(0, Math.floor(count)) };
}
