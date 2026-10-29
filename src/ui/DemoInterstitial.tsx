import { useEffect, useRef, useState } from 'react';
import { REMOVE_ADS } from '../monetize/prices';

/** Seconds before the stand-in ad can be closed, as real ones usually make you wait. */
const WAIT = 3;

/** Stands in for an ad between levels until AdMob is wired in. */
export function DemoInterstitial({ onClose }: { onClose: () => void }) {
  const [left, setLeft] = useState(WAIT);
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (left === 0) {
      close.current?.focus();
      return;
    }
    const t = window.setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => window.clearTimeout(t);
  }, [left]);

  return (
    <div className="overlay ad-overlay" role="dialog" aria-modal="true" aria-labelledby="ad-title">
      <div className="card ad-card">
        <p className="eyebrow">Advertisement</p>
        <h2 id="ad-title">Ad break</h2>
        <p className="demo-note">
          Demo: a short ad plays here in the app store version, after every few levels. Remove ads
          in the shop for {REMOVE_ADS.price}.
        </p>
        <div className="card-actions single">
          <button type="button" className="run" ref={close} disabled={left > 0} onClick={onClose}>
            {left > 0 ? `Close in ${left}` : 'Close ad'}
          </button>
        </div>
      </div>
    </div>
  );
}
