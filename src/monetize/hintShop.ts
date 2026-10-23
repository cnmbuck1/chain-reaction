// Where extra hints come from. The game only talks to this interface, so the demo below
// can be swapped for AdMob and the stores' in-app purchases without touching the UI.

export interface HintPack {
  id: string;
  hints: number;
  /** Display price; the real one comes from the store at runtime. */
  price: string;
}

export interface HintShop {
  /** True while every button only simulates the ad or purchase. */
  readonly demo: boolean;
  /** Shows a rewarded ad; resolves to the hints earned (0 if the ad was skipped or failed). */
  watchAd(): Promise<number>;
  packs(): readonly HintPack[];
  /** Runs a purchase; resolves to the hints bought (0 if cancelled or failed). */
  buy(packId: string): Promise<number>;
}

const DEMO_PACKS: readonly HintPack[] = [
  { id: 'hints_5', hints: 5, price: '$0.99' },
  { id: 'hints_15', hints: 15, price: '$1.99' },
];

/** Grants hints after a short pause, standing in for the real flows. */
export function demoHintShop(delayMs = 700): HintShop {
  const wait = () => new Promise((resolve) => setTimeout(resolve, delayMs));
  return {
    demo: true,
    async watchAd() {
      await wait();
      return 1;
    },
    packs: () => DEMO_PACKS,
    async buy(packId) {
      await wait();
      return DEMO_PACKS.find((p) => p.id === packId)?.hints ?? 0;
    },
  };
}
