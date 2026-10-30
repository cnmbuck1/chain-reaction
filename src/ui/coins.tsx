import { useId, useState } from 'react';

/** The coin mark: a minted gold coin with a raised rim and a lightning bolt struck in the face. */
export function CoinIcon({ size = 16 }: { size?: number }) {
  const id = useId();
  return (
    <svg className="coin-icon" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <defs>
        <radialGradient id={`${id}-face`} cx="38%" cy="32%" r="75%">
          <stop offset="0" stopColor="#fff1c4" />
          <stop offset="0.45" stopColor="#e9c46a" />
          <stop offset="1" stopColor="#a87b2c" />
        </radialGradient>
        <linearGradient id={`${id}-rim`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f6dc94" />
          <stop offset="1" stopColor="#7a5418" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="11.5" fill={`url(#${id}-rim)`} />
      <circle cx="12" cy="12" r="9.2" fill={`url(#${id}-face)`} />
      <circle
        cx="12"
        cy="12"
        r="9.2"
        fill="none"
        stroke="#8a6322"
        strokeOpacity="0.55"
        strokeWidth="0.8"
      />
      <path
        d="M13.4 5.6 8.3 13h3.3l-1.1 5.4 5.2-7.6h-3.3z"
        fill="#9a6d23"
        stroke="#fff3cf"
        strokeOpacity="0.5"
        strokeWidth="0.5"
        strokeLinejoin="round"
      />
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
      <CoinIcon size={20} />
      <span className="coin-count">{coins}</span>
    </button>
  );
}
