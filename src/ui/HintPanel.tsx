import { useState } from 'react';
import type { HintShop } from '../monetize/hintShop';

interface Props {
  /** Free moves this level still has to give. */
  remaining: number;
  free: boolean;
  balance: number;
  shop: HintShop;
  onUse: () => void;
  onGrant: (hints: number) => void;
  onClose: () => void;
}

/** Spend a hint on a free move, or get more hints. */
export function HintPanel({ remaining, free, balance, shop, onUse, onGrant, onClose }: Props) {
  const [view, setView] = useState<'hint' | 'shop'>('hint');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const canAfford = free || balance > 0;

  const get = async (action: () => Promise<number>) => {
    setBusy(true);
    setNotice(null);
    try {
      const earned = await action();
      if (earned > 0) {
        onGrant(earned);
        setNotice(`${earned} ${earned === 1 ? 'hint' : 'hints'} added.`);
        setView('hint');
      } else {
        setNotice('No hints were added. Try again in a moment.');
      }
    } catch {
      setNotice('That did not go through. Try again in a moment.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="hint-title">
      <div className="card hint-card">
        <div className="hint-head">
          <p className="eyebrow">
            {free
              ? 'Hints are free on this level'
              : `${balance} ${balance === 1 ? 'hint' : 'hints'} left`}
          </p>
          <button type="button" className="ghost small" onClick={onClose}>
            Close
          </button>
        </div>

        {view === 'hint' ? (
          <>
            <h2 id="hint-title">Free move</h2>
            <p>
              {remaining > 0
                ? 'A hint sets one switch to where the solution needs it and locks it there. It doesn’t use up any of your changes.'
                : 'That’s every free move for this level. The last step is yours.'}
            </p>
            {notice && (
              <p className="hint-notice" role="status">
                {notice}
              </p>
            )}
            {remaining > 0 && (
              <div className="card-actions single">
                {canAfford ? (
                  <button type="button" className="run" autoFocus onClick={onUse}>
                    {free ? 'Make a free move' : 'Use 1 hint'}
                  </button>
                ) : (
                  <button type="button" className="run" autoFocus onClick={() => setView('shop')}>
                    Get more hints
                  </button>
                )}
              </div>
            )}
          </>
        ) : (
          <>
            <h2 id="hint-title">Get more hints</h2>
            {shop.demo && (
              <p className="demo-note">
                Demo: nothing is shown or charged. Real ads and purchases come with the app store
                release.
              </p>
            )}
            <div className="shop-list">
              <button
                type="button"
                className="shop-item"
                disabled={busy}
                onClick={() => void get(() => shop.watchAd())}
              >
                <span className="shop-name">Watch a short ad</span>
                <span className="shop-price">+1 hint</span>
              </button>
              {shop.packs().map((pack) => (
                <button
                  key={pack.id}
                  type="button"
                  className="shop-item"
                  disabled={busy}
                  onClick={() => void get(() => shop.buy(pack.id))}
                >
                  <span className="shop-name">{pack.hints} hints</span>
                  <span className="shop-price">{pack.price}</span>
                </button>
              ))}
            </div>
            {(busy || notice) && (
              <p className="hint-notice" role="status">
                {busy ? 'Working…' : notice}
              </p>
            )}
            <div className="card-actions single">
              <button
                type="button"
                className="ghost"
                disabled={busy}
                onClick={() => setView('hint')}
              >
                Back
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
