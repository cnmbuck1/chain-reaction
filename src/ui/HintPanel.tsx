import { HINT_PRICE } from '../monetize/prices';
import type { Payment, Shop } from '../monetize/shop';
import { CoinIcon, coinsText, DemoNote, useShopAction } from './coins';

interface Props {
  /** Free moves this level still has to give. */
  remaining: number;
  free: boolean;
  coins: number;
  shop: Shop;
  onUse: (paid: Payment | 'free') => void;
  onShop: () => void;
  onClose: () => void;
}

/** Take a free move: free on the tutorial, otherwise for coins or a short ad. */
export function HintPanel({ remaining, free, coins, shop, onUse, onShop, onClose }: Props) {
  const { busy, status, run } = useShopAction();
  const canAfford = coins >= HINT_PRICE;

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="hint-title">
      <div className="card hint-card">
        <div className="hint-head">
          <p className="eyebrow coin-balance">
            {free ? (
              'Hints are free on this level'
            ) : (
              <>
                <CoinIcon /> {coinsText(coins)}
              </>
            )}
          </p>
          <button type="button" className="ghost small" onClick={onClose} disabled={busy}>
            Close
          </button>
        </div>
        <h2 id="hint-title">Free move</h2>
        <p>
          {remaining > 0
            ? 'A hint sets one switch to where the solution needs it and locks it there. It doesn’t use up any of your changes.'
            : 'That’s every free move for this level. The last step is yours.'}
        </p>
        {remaining > 0 && !free && shop.demo && <DemoNote />}
        {remaining > 0 &&
          (free ? (
            <div className="card-actions single">
              <button type="button" className="run" autoFocus onClick={() => onUse('free')}>
                Make a free move
              </button>
            </div>
          ) : (
            <div className="shop-list">
              <button
                type="button"
                className="shop-item"
                autoFocus={canAfford}
                disabled={busy || !canAfford}
                onClick={() => onUse('coins')}
              >
                <span className="shop-name">Use coins</span>
                <span className="shop-price">
                  <CoinIcon /> {HINT_PRICE}
                </span>
              </button>
              <button
                type="button"
                className="shop-item"
                autoFocus={!canAfford}
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    if (!(await shop.watchAd())) return 'The ad didn’t finish. Try again.';
                    onUse('ad');
                    return null;
                  })
                }
              >
                <span className="shop-name">Watch a short ad</span>
                <span className="shop-price">Free</span>
              </button>
              {!canAfford && (
                <button type="button" className="shop-item" disabled={busy} onClick={onShop}>
                  <span className="shop-name">Get coins</span>
                  <span className="shop-price">Shop</span>
                </button>
              )}
            </div>
          ))}
        {status && (
          <p className="hint-notice" role="status">
            {status}
          </p>
        )}
      </div>
    </div>
  );
}
