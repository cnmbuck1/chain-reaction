import { COIN_PACKS, REMOVE_ADS, type CoinPack } from './prices';

// Where ads and purchases happen. The game only talks to this interface, so the demo below
// can be swapped for AdMob and the stores' in-app purchases without touching the UI. The
// shop only reports what happened; the game decides the reward.

/** How the player paid for a hint or a retry. */
export type Payment = 'coins' | 'ad';

export interface Shop {
  /** True while every button only simulates the ad or purchase. */
  readonly demo: boolean;
  /** Shows a rewarded ad; resolves true only if it was watched to the end. */
  watchAd(): Promise<boolean>;
  packs(): readonly CoinPack[];
  /** Runs a purchase; resolves to the coins bought (0 if cancelled or failed). */
  buy(packId: string): Promise<number>;
  /** Runs the Remove ads purchase; resolves true once it is bought. */
  buyRemoveAds(): Promise<boolean>;
  /** Remove ads' price, in the store's own currency once it has loaded. */
  removeAdsPrice(): string;
  /** Asks the store, without prompting, whether Remove ads was bought (a reinstall or a new phone). */
  adFreeOwned(): Promise<boolean>;
  /** The Restore purchases button: resolves true if Remove ads came back. */
  restore(): Promise<boolean>;
  /**
   * Shows an ad between levels and resolves when it closes. The demo resolves at once:
   * the game draws its own stand-in instead.
   */
  showInterstitial(): Promise<void>;
}

/** Succeeds after a short pause, standing in for the real flows. */
export function demoShop(delayMs = 700): Shop {
  const wait = () => new Promise((resolve) => setTimeout(resolve, delayMs));
  return {
    demo: true,
    async watchAd() {
      await wait();
      return true;
    },
    packs: () => COIN_PACKS,
    async buy(packId) {
      await wait();
      return COIN_PACKS.find((p) => p.id === packId)?.coins ?? 0;
    },
    async buyRemoveAds() {
      await wait();
      return true;
    },
    removeAdsPrice: () => REMOVE_ADS.price,
    async adFreeOwned() {
      return false;
    },
    async restore() {
      await wait();
      return false;
    },
    async showInterstitial() {},
  };
}
