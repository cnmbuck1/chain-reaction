// The hint wallet: how many hints the player holds and how many free moves each level
// has used. Stored apart from progress so resetting progress never refills free hints.
// Reads never throw: anything missing or malformed falls back to a fresh wallet.

export const FREE_HINTS = 2;
/** Upper bound on free moves per level when reading stored data. */
const MAX_MOVES = 10;

export interface HintWallet {
  version: 1;
  balance: number;
  /** Free moves used per level id. They stay applied, including on replays. */
  used: Record<string, number>;
}

export const HINTS_KEY = 'chain-reaction/hints';

type KeyValueStore = Pick<Storage, 'getItem' | 'setItem'>;

export const freshWallet = (): HintWallet => ({ version: 1, balance: FREE_HINTS, used: {} });

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
  const { version, balance, used } = data as Record<string, unknown>;
  if (version !== 1 || !isCount(balance)) return freshWallet();
  const clean: Record<string, number> = {};
  if (typeof used === 'object' && used !== null) {
    for (const [id, moves] of Object.entries(used)) {
      if (isCount(moves, MAX_MOVES) && moves > 0) clean[id] = moves;
    }
  }
  return { version: 1, balance, used: clean };
}

export const freeMovesUsed = (wallet: HintWallet, levelId: string) => wallet.used[levelId] ?? 0;

export type HintResult = { ok: true; wallet: HintWallet } | { ok: false; reason: 'empty' | 'done' };

/**
 * Spends a hint on the next free move for a level. `available` is how many free moves the
 * level offers; `free` levels cost nothing. `moves` above 1 also passes over moves the
 * player no longer needs, such as those in a part of the board they already cleared.
 */
export function spendFreeMove(
  wallet: HintWallet,
  levelId: string,
  available: number,
  free: boolean,
  moves = 1,
): HintResult {
  const used = freeMovesUsed(wallet, levelId);
  if (used >= available) return { ok: false, reason: 'done' };
  if (!free && wallet.balance < 1) return { ok: false, reason: 'empty' };
  return {
    ok: true,
    wallet: {
      ...wallet,
      balance: free ? wallet.balance : wallet.balance - 1,
      used: { ...wallet.used, [levelId]: Math.min(available, used + Math.max(1, moves)) },
    },
  };
}

export function grantHints(wallet: HintWallet, count: number): HintWallet {
  return { ...wallet, balance: wallet.balance + Math.max(0, Math.floor(count)) };
}
