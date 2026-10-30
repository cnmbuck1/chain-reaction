// The Shop in the phone apps: AdMob for ads, the App Store and Google Play for purchases.
// The web build keeps demoShop. Console setup is in docs/ADS_AND_PURCHASES.md.
//
// Consent comes first: Google's form where the law asks for it (EU/UK), then Apple's tracking
// question. A player who says no still sees ads, just less personalised ones. Ads start the
// first time one is needed, or a few seconds after launch for players past the tutorial.

import { Capacitor } from '@capacitor/core';
import {
  AdMob,
  AdmobConsentStatus,
  InterstitialAdPluginEvents,
  RewardAdPluginEvents,
} from '@capacitor-community/admob';
import { NativePurchases, PURCHASE_TYPE } from '@capgo/native-purchases';
import { AD_UNITS_ANDROID, AD_UNITS_IOS, ADS_TESTING, isSampleUnit } from './ads.config';
import { COIN_PACKS, REMOVE_ADS, type CoinPack } from './prices';
import type { Shop } from './shop';

export interface NativeShopOptions {
  /** Start ads shortly after launch instead of on first use (players past the tutorial). */
  startEarly: boolean;
}

export function nativeShop({ startEarly }: NativeShopOptions): Shop {
  const android = Capacitor.getPlatform() === 'android';
  const units = android ? AD_UNITS_ANDROID : AD_UNITS_IOS;
  const productIds = [...COIN_PACKS.map((p) => p.id), REMOVE_ADS.id];
  /** The stores' own, localized prices once they have loaded. */
  const prices = new Map<string, string>();

  void NativePurchases.getProducts({
    productIdentifiers: productIds,
    productType: PURCHASE_TYPE.INAPP,
  })
    .then(({ products }) => {
      for (const p of products) prices.set(p.identifier, p.priceString);
    })
    .catch(() => {
      // Not set up in the store yet, or offline: the stand-in prices stay.
    });

  // ---------- Ads ----------

  /**
   * Test ads while ADS_TESTING is on or the units are Google's samples, and in any iPhone copy
   * that didn't come from the App Store (TestFlight), so testers never tap a real ad. Android
   * can't tell, so only builds for Play's production track (VITE_REAL_ADS) get real ones.
   */
  let testAds = ADS_TESTING || isSampleUnit(units.rewarded);
  async function decideTestAds() {
    if (testAds) return;
    if (android) {
      testAds = import.meta.env.VITE_REAL_ADS !== '1';
      return;
    }
    try {
      const { appTransaction } = await NativePurchases.getAppTransaction();
      testAds = appTransaction.environment !== 'Production';
    } catch {
      // Can't tell (older iOS): an App Store copy.
    }
  }

  let ready: Promise<boolean> | null = null;
  let interstitialLoaded = false;
  let rewardedLoaded = false;

  /** Consent, the tracking question and the SDK start, once; true when ads may be requested. */
  function start() {
    ready ??= (async () => {
      try {
        let info = await AdMob.requestConsentInfo();
        if (info.isConsentFormAvailable && info.status === AdmobConsentStatus.REQUIRED) {
          info = await AdMob.showConsentForm();
        }
        if (!info.canRequestAds) return false;
        if (!android) {
          const tracking = await AdMob.trackingAuthorizationStatus();
          if (tracking.status === 'notDetermined') await AdMob.requestTrackingAuthorization();
        }
        await decideTestAds();
        await AdMob.initialize({ initializeForTesting: testAds });
        void loadRewarded();
        void loadInterstitial();
        return true;
      } catch {
        ready = null;
        return false;
      }
    })();
    return ready;
  }

  async function loadInterstitial() {
    try {
      await AdMob.prepareInterstitial({ adId: units.interstitial, isTesting: testAds });
      interstitialLoaded = true;
    } catch {
      interstitialLoaded = false;
    }
  }
  async function loadRewarded() {
    try {
      await AdMob.prepareRewardVideoAd({ adId: units.rewarded, isTesting: testAds });
      rewardedLoaded = true;
    } catch {
      rewardedLoaded = false;
    }
  }

  /**
   * Shows a loaded full-screen ad and waits for it to close. The plugin's own call settles
   * early (when the ad appears) or never (closed before the reward), so this goes by its
   * events. Resolves whether the reward was earned (always false for an interstitial).
   */
  async function present(kind: 'rewarded' | 'interstitial') {
    const ev =
      kind === 'rewarded'
        ? { dismissed: RewardAdPluginEvents.Dismissed, failed: RewardAdPluginEvents.FailedToShow }
        : {
            dismissed: InterstitialAdPluginEvents.Dismissed,
            failed: InterstitialAdPluginEvents.FailedToShow,
          };
    let earned = false;
    const handles: Promise<{ remove: () => Promise<void> }>[] = [];
    const closed = new Promise<void>((resolve) => {
      handles.push(AdMob.addListener(ev.dismissed as never, () => resolve()));
      handles.push(AdMob.addListener(ev.failed as never, () => resolve()));
    });
    if (kind === 'rewarded') {
      handles.push(
        AdMob.addListener(RewardAdPluginEvents.Rewarded, () => {
          earned = true;
        }),
      );
    }
    try {
      const shown =
        kind === 'rewarded'
          ? AdMob.showRewardVideoAd().then(() => {
              earned = true;
            })
          : AdMob.showInterstitial();
      // A refusal to show at all ends it at once; otherwise wait for the ad to close.
      await Promise.race([
        closed,
        shown.then(
          () => closed,
          () => undefined,
        ),
      ]);
    } catch {
      // Not shown.
    } finally {
      for (const h of handles) void (await h).remove();
    }
    return earned;
  }

  if (startEarly) setTimeout(() => void start(), 4000);

  // ---------- Purchases ----------

  async function owned(id: string) {
    const { purchases } = await NativePurchases.getPurchases({ onlyCurrentEntitlements: true });
    return purchases.some((p) => p.productIdentifier === id);
  }

  async function purchase(id: string, consumable: boolean) {
    try {
      const t = await NativePurchases.purchaseProduct({
        productIdentifier: id,
        productType: PURCHASE_TYPE.INAPP,
        isConsumable: consumable,
      });
      return Boolean(t?.transactionId || t?.productIdentifier === id);
    } catch {
      // Cancelled, or the store refused (not set up yet, or no Paid Apps agreement).
      return false;
    }
  }

  const withPrice = (pack: CoinPack): CoinPack => ({
    ...pack,
    price: prices.get(pack.id) ?? pack.price,
  });

  return {
    demo: false,
    async watchAd() {
      if (!(await start())) return false;
      if (!rewardedLoaded) await loadRewarded();
      if (!rewardedLoaded) return false;
      rewardedLoaded = false;
      const earned = await present('rewarded');
      void loadRewarded();
      return earned;
    },
    packs: () => COIN_PACKS.map(withPrice),
    async buy(packId) {
      const pack = COIN_PACKS.find((p) => p.id === packId);
      if (!pack) return 0;
      return (await purchase(pack.id, true)) ? pack.coins : 0;
    },
    async buyRemoveAds() {
      return purchase(REMOVE_ADS.id, false);
    },
    removeAdsPrice: () => prices.get(REMOVE_ADS.id) ?? REMOVE_ADS.price,
    async adFreeOwned() {
      try {
        return await owned(REMOVE_ADS.id);
      } catch {
        return false;
      }
    },
    async restore() {
      try {
        await NativePurchases.restorePurchases();
      } catch {
        // Fall through to the check.
      }
      try {
        return await owned(REMOVE_ADS.id);
      } catch {
        return false;
      }
    },
    async showInterstitial() {
      if (!(await start())) return;
      // Normally loaded ahead of time; if not, give it a moment rather than skip it.
      if (!interstitialLoaded) {
        await Promise.race([loadInterstitial(), new Promise((r) => setTimeout(r, 2500))]);
      }
      if (!interstitialLoaded) return;
      interstitialLoaded = false;
      await present('interstitial');
      void loadInterstitial();
    },
  };
}
