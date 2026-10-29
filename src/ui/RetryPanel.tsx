import { FREE_RETRIES, RETRY_PRICE } from '../monetize/prices';
import type { Payment, Shop } from '../monetize/shop';
import { CoinIcon, coinsText, DemoNote, useShopAction } from './coins';

interface Props {
  coins: number;
  shop: Shop;
  /** Buys one retry; the Run starts right after. */
  onRetry: (paid: Payment) => void;
  onShop: () => void;
  onClose: () => void;
}

/** Out of free retries on this level: one more for coins or a short ad. */
export function RetryPanel({ coins, shop, onRetry, onShop, onClose }: Props) {
  const { busy, status, run } = useShopAction();
  const canAfford = coins >= RETRY_PRICE;

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="retry-title">
      <div className="card hint-card">
        <div className="hint-head">
          <p className="eyebrow coin-balance">
            <CoinIcon /> {coinsText(coins)}
          </p>
          <button type="button" className="ghost small" onClick={onClose} disabled={busy}>
            Close
          </button>
        </div>
        <h2 id="retry-title">One more try?</h2>
        <p>
          Your {FREE_RETRIES} free retries on this level are used. Solving it gives them back.
          Changing switches is always free; only Runs count.
        </p>
        {shop.demo && <DemoNote />}
        <div className="shop-list">
          <button
            type="button"
            className="shop-item"
            autoFocus={canAfford}
            disabled={busy || !canAfford}
            onClick={() => onRetry('coins')}
          >
            <span className="shop-name">Retry for coins</span>
            <span className="shop-price">
              <CoinIcon /> {RETRY_PRICE}
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
                onRetry('ad');
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
        {status && (
          <p className="hint-notice" role="status">
            {status}
          </p>
        )}
      </div>
    </div>
  );
}
