import { useState } from 'react';
import type { HintStep } from '../hints/steps';
import type { HintShop } from '../monetize/hintShop';

interface Props {
  steps: readonly HintStep[];
  unlocked: number;
  free: boolean;
  balance: number;
  shop: HintShop;
  onUnlock: () => void;
  onGrant: (hints: number) => void;
  onClose: () => void;
}

const STEP_TITLES: Record<HintStep['kind'], string> = {
  nudge: 'Nudge',
  focus: 'Focus',
  move: 'One move',
};

/** The hint sheet: unlocked steps, the next one, and a way to get more hints. */
export function HintPanel({
  steps,
  unlocked,
  free,
  balance,
  shop,
  onUnlock,
  onGrant,
  onClose,
}: Props) {
  const [view, setView] = useState<'hints' | 'shop'>('hints');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const shown = steps.slice(0, unlocked);
  const next = steps[unlocked];
  const canAfford = free || balance > 0;

  const get = async (action: () => Promise<number>) => {
    setBusy(true);
    setNotice(null);
    try {
      const earned = await action();
      if (earned > 0) {
        onGrant(earned);
        setNotice(`${earned} ${earned === 1 ? 'hint' : 'hints'} added.`);
        setView('hints');
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

        {view === 'hints' ? (
          <>
            <h2 id="hint-title">Hints</h2>
            {shown.length > 0 ? (
              <ol className="hint-steps">
                {shown.map((step) => (
                  <li key={step.kind}>
                    <span className="hint-step-title">{STEP_TITLES[step.kind]}</span>
                    {step.text}
                  </li>
                ))}
              </ol>
            ) : (
              <p>Each hint shows a little more: a nudge, then where to look, then one move.</p>
            )}
            {notice && (
              <p className="hint-notice" role="status">
                {notice}
              </p>
            )}
            <div className="card-actions single">
              {!next ? (
                <p className="fine">That's every hint for this level.</p>
              ) : canAfford ? (
                <button type="button" className="run" autoFocus onClick={onUnlock}>
                  {STEP_TITLES[next.kind]} · {free ? 'free' : 'use 1 hint'}
                </button>
              ) : (
                <button type="button" className="run" autoFocus onClick={() => setView('shop')}>
                  Get more hints
                </button>
              )}
            </div>
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
            {busy && (
              <p className="hint-notice" role="status">
                Working…
              </p>
            )}
            {notice && !busy && (
              <p className="hint-notice" role="status">
                {notice}
              </p>
            )}
            <div className="card-actions single">
              <button
                type="button"
                className="ghost"
                disabled={busy}
                onClick={() => setView('hints')}
              >
                Back to hints
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
