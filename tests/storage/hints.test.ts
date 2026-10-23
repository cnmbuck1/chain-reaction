import { describe, expect, it } from 'vitest';
import {
  FREE_HINTS,
  freshWallet,
  grantHints,
  HINT_STEPS,
  HINTS_KEY,
  loadHints,
  migrateHints,
  saveHints,
  stepsUnlocked,
  unlockNextStep,
} from '../../src/storage/hints';

function memoryStore() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
}

describe('hint wallet', () => {
  it('starts with two free hints', () => {
    expect(FREE_HINTS).toBe(2);
    expect(loadHints(memoryStore())).toEqual({ version: 1, balance: 2, unlocked: {} });
  });

  it('spends one hint per step and keeps steps unlocked', () => {
    let wallet = freshWallet();
    for (let i = 0; i < 2; i++) {
      const r = unlockNextStep(wallet, 'level-05', false);
      expect(r.ok).toBe(true);
      if (r.ok) wallet = r.wallet;
    }
    expect(wallet.balance).toBe(0);
    expect(stepsUnlocked(wallet, 'level-05')).toBe(2);
    expect(unlockNextStep(wallet, 'level-05', false)).toEqual({ ok: false, reason: 'empty' });
  });

  it('charges nothing on free levels and stops after the last step', () => {
    let wallet = freshWallet();
    for (let i = 0; i < HINT_STEPS; i++) {
      const r = unlockNextStep(wallet, 'level-01', true);
      if (r.ok) wallet = r.wallet;
    }
    expect(wallet.balance).toBe(2);
    expect(unlockNextStep(wallet, 'level-01', true)).toEqual({ ok: false, reason: 'done' });
  });

  it('grants whole positive amounts only', () => {
    expect(grantHints(freshWallet(), 5).balance).toBe(7);
    expect(grantHints(freshWallet(), -3).balance).toBe(2);
    expect(grantHints(freshWallet(), 1.7).balance).toBe(3);
  });

  it('round-trips and cleans bad data', () => {
    const store = memoryStore();
    const wallet = { version: 1 as const, balance: 4, unlocked: { 'level-07': 2 } };
    saveHints(wallet, store);
    expect(loadHints(store)).toEqual(wallet);
    expect(
      migrateHints({ version: 1, balance: 1, unlocked: { a: 9, b: -1, c: 'x', d: 3, e: 0 } }),
    ).toEqual({ version: 1, balance: 1, unlocked: { d: 3 } });
    expect(migrateHints({ version: 1, balance: -2 })).toEqual(freshWallet());
    store.data.set(HINTS_KEY, '{broken');
    expect(loadHints(store)).toEqual(freshWallet());
    expect(loadHints(null)).toEqual(freshWallet());
  });
});
