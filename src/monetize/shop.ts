import { COIN_PACKS, type CoinPack } from './prices';

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
  };
}
