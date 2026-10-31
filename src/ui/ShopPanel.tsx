import { useEffect } from 'react';
import { AD_COINS, HINT_PRICE, REMOVE_ADS, RETRY_PRICE } from '../monetize/prices';
import type { Shop } from '../monetize/shop';
import { CoinIcon, coinsText, DemoNote, useShopAction } from './coins';

interface Props {
  coins: number;
  /** Coin ads still allowed today. */
  adsLeft: number;
  shop: Shop;
  /** A coin ad was watched to the end. */
  onAdWatched: () => void;
  onBought: (coins: number) => void;
  /** Remove ads or a coin pack was bought before: no ads between levels. */
  adFree: boolean;
  onAdFree: () => void;
  onClose: () => void;
}

/** The coin shop: earn coins with an ad, buy packs, and see what coins buy. */
export function ShopPanel({
  coins,
  adsLeft,
  shop,
  onAdWatched,
  onBought,
  adFree,
  onAdFree,
  onClose,
}: Props) {
  const { busy, status, run } = useShopAction();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  return (
    <div
      className="overlay shop-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shop-title"
    >
      <div className="card hint-card">
        <div className="hint-head">
          <p className="eyebrow coin-balance" aria-live="polite">
            <CoinIcon /> {coinsText(coins)}
          </p>
          <button type="button" className="ghost small" onClick={onClose} disabled={busy}>
            Close
          </button>
        </div>
        <h2 id="shop-title">Coins</h2>
        <p>
          Coins buy hints ({HINT_PRICE}) and extra retries ({RETRY_PRICE}). Every new star earns
          one. Stars themselves can’t be bought.
        </p>
        {shop.demo && <DemoNote />}
        <div className="shop-list">
          <button
            type="button"
            className="shop-item"
            disabled={busy || adsLeft === 0}
            onClick={() =>
              void run(async () => {
                if (!(await shop.watchAd())) return 'The ad didn’t finish, so no coins this time.';
                onAdWatched();
                return `${coinsText(AD_COINS)} added.`;
              })
            }
          >
            <span className="shop-name">
              Watch a short ad
              <span className="shop-sub">
                {adsLeft > 0 ? `${adsLeft} left today` : 'Back tomorrow'}
              </span>
            </span>
            <span className="shop-price">+{AD_COINS}</span>
          </button>
          {shop.packs().map((pack) => (
            <button
              key={pack.id}
              type="button"
              className="shop-item"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const got = await shop.buy(pack.id);
                  if (got <= 0) return 'No coins were added.';
                  onBought(got);
                  return `${coinsText(got)} added.`;
                })
              }
            >
              <span className="shop-name">
                <CoinIcon /> {pack.coins} coins
              </span>
              <span className="shop-price">{pack.price}</span>
            </button>
          ))}
          <button
            type="button"
            className="shop-item"
            disabled={busy || adFree}
            onClick={() =>
              void run(async () => {
                if (!(await shop.buyRemoveAds())) return 'Nothing was bought.';
                onAdFree();
                return 'Ads between levels are off for good, and the Cnmbuck Orb is your ball.';
              })
            }
          >
            <span className="shop-name">
              Remove ads
              <span className="shop-sub">
                {adFree
                  ? 'Ads between levels are off, and the Cnmbuck Orb is yours'
                  : 'No ads between levels, plus the Cnmbuck Orb ball. Optional ads stay.'}
              </span>
            </span>
            <span className="shop-price">{adFree ? 'Owned' : REMOVE_ADS.price}</span>
          </button>
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
