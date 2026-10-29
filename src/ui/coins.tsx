import { useState } from 'react';

/** The coin mark: a gold disc with a ridged rim. */
export function CoinIcon({ size = 16 }: { size?: number }) {
  return (
    <svg className="coin-icon" viewBox="0 0 16 16" width={size} height={size} aria-hidden="true">
      <circle cx="8" cy="8" r="7" fill="currentColor" />
      <circle cx="8" cy="8" r="4.6" fill="none" stroke="var(--gold-ink)" strokeWidth="1.3" />
    </svg>
  );
}

export const coinsText = (n: number) => `${n} ${n === 1 ? 'coin' : 'coins'}`;

/** Shown on every panel while ads and purchases only pretend. */
export function DemoNote() {
  return (
    <p className="demo-note">
      Demo: nothing is shown or charged. Real ads and purchases come with the app store release.
    </p>
  );
}

/**
 * Runs an ad or purchase from a panel: one at a time, with a status line for the wait and
 * for anything that goes wrong. `act` resolves to a notice to show, or null to show none.
 */
export function useShopAction() {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const run = async (act: () => Promise<string | null>) => {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    try {
      setNotice(await act());
    } catch {
      setNotice('That did not go through. Try again in a moment.');
    } finally {
      setBusy(false);
    }
  };
  const status = busy ? 'Working…' : notice;
  return { busy, status, run };
}

/** The coin balance, on every screen; tapping it opens the shop. */
export function CoinChip({ coins, onShop }: { coins: number; onShop: () => void }) {
  return (
    <button
      type="button"
      className="ghost small coin-button"
      onClick={onShop}
      aria-label={`Shop, ${coinsText(coins)}`}
    >
      <CoinIcon /> {coins}
    </button>
  );
}
