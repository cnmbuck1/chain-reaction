import { beforeEach, describe, expect, it, vi } from 'vitest';

// A stand-in for the AdMob plugin: tests decide what each call does and fire its events.
const ads = vi.hoisted(() => {
  const listeners = new Map<string, Set<(data?: unknown) => void>>();
  return {
    listeners,
    emit(name: string, data?: unknown) {
      for (const fn of [...(listeners.get(name) ?? [])]) fn(data);
    },
    AdMob: {
      requestConsentInfo: vi.fn(),
      showConsentForm: vi.fn(),
      trackingAuthorizationStatus: vi.fn(),
      requestTrackingAuthorization: vi.fn(),
      initialize: vi.fn(),
      prepareInterstitial: vi.fn(),
      prepareRewardVideoAd: vi.fn(),
      showRewardVideoAd: vi.fn(),
      showInterstitial: vi.fn(),
      addListener: vi.fn(async (name: string, fn: (data?: unknown) => void) => {
        if (!listeners.has(name)) listeners.set(name, new Set());
        listeners.get(name)!.add(fn);
        return { remove: async () => void listeners.get(name)!.delete(fn) };
      }),
    },
  };
});

vi.mock('@capacitor/core', () => ({ Capacitor: { getPlatform: () => 'ios' } }));
vi.mock('@capacitor-community/admob', () => ({
  AdMob: ads.AdMob,
  AdmobConsentStatus: { REQUIRED: 'REQUIRED' },
  InterstitialAdPluginEvents: {
    Dismissed: 'interstitialAdDismissFullScreenContent',
    FailedToShow: 'interstitialAdFailedToShow',
  },
  RewardAdPluginEvents: {
    Dismissed: 'onRewardedVideoAdDismissed',
    FailedToShow: 'onRewardedVideoAdFailedToShow',
    Rewarded: 'onRewardedVideoAdReward',
  },
}));
vi.mock('@capgo/native-purchases', () => ({
  NativePurchases: { getProducts: vi.fn(async () => ({ products: [] })) },
  PURCHASE_TYPE: { INAPP: 'inapp' },
}));
// A TestFlight copy: test ads, and the reasons are reported.
vi.mock('../../src/platform/release', () => ({ isStoreRelease: async () => false }));

const { nativeShop } = await import('../../src/monetize/nativeShop');
const { AdMob } = ads;
const never = () => new Promise<never>(() => {});

beforeEach(() => {
  ads.listeners.clear();
  AdMob.requestConsentInfo.mockResolvedValue({
    status: 'NOT_REQUIRED',
    isConsentFormAvailable: false,
    canRequestAds: true,
    privacyOptionsRequirementStatus: 'NOT_REQUIRED',
  });
  AdMob.trackingAuthorizationStatus.mockResolvedValue({ status: 'authorized' });
  AdMob.initialize.mockResolvedValue(undefined);
  AdMob.prepareInterstitial.mockResolvedValue({});
  AdMob.prepareRewardVideoAd.mockResolvedValue({});
  AdMob.showRewardVideoAd.mockReset();
});

describe('nativeShop rewarded ads', () => {
  it('pays out when the ad is watched to the end', async () => {
    AdMob.showRewardVideoAd.mockImplementation(async () => {
      ads.emit('onRewardedVideoAdReward', { type: 'coins', amount: 3 });
      setTimeout(() => ads.emit('onRewardedVideoAdDismissed'), 0);
      return { type: 'coins', amount: 3 };
    });
    const shop = nativeShop({ startEarly: false });
    expect(await shop.watchAd()).toBe('earned');
    expect(AdMob.prepareRewardVideoAd).toHaveBeenCalledWith(
      expect.objectContaining({ isTesting: true }),
    );
  });

  it('still pays out when the reward arrives just after the close', async () => {
    AdMob.showRewardVideoAd.mockImplementation(() => {
      setTimeout(() => {
        ads.emit('onRewardedVideoAdDismissed');
        setTimeout(() => ads.emit('onRewardedVideoAdReward', { type: 'coins', amount: 3 }), 200);
      }, 0);
      return never();
    });
    const shop = nativeShop({ startEarly: false });
    expect(await shop.watchAd()).toBe('earned');
  });

  it('says closed when the player shuts the ad early', async () => {
    vi.useFakeTimers();
    try {
      AdMob.showRewardVideoAd.mockImplementation(() => {
        setTimeout(() => ads.emit('onRewardedVideoAdDismissed'), 0);
        return never();
      });
      const shop = nativeShop({ startEarly: false });
      const result = shop.watchAd();
      await vi.runAllTimersAsync();
      expect(await result).toBe('closed');
      expect(shop.adProblem()).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('says unavailable, with the reason, when no ad loads', async () => {
    AdMob.prepareRewardVideoAd.mockRejectedValue(new Error('No ad to show.'));
    const shop = nativeShop({ startEarly: false });
    expect(await shop.watchAd()).toBe('unavailable');
    expect(shop.adProblem()).toBe('no ad loaded: No ad to show.');
    expect(AdMob.showRewardVideoAd).not.toHaveBeenCalled();
  });

  it('tries loading again on the next tap', async () => {
    // Fails at start-up and again on the tap, then loads.
    AdMob.prepareRewardVideoAd
      .mockRejectedValueOnce(new Error('No ad to show.'))
      .mockRejectedValueOnce(new Error('No ad to show.'));
    AdMob.showRewardVideoAd.mockImplementation(async () => {
      ads.emit('onRewardedVideoAdReward');
      setTimeout(() => ads.emit('onRewardedVideoAdDismissed'), 0);
      return {};
    });
    const shop = nativeShop({ startEarly: false });
    expect(await shop.watchAd()).toBe('unavailable');
    expect(await shop.watchAd()).toBe('earned');
  });

  it('says unavailable when the ad refuses to show', async () => {
    AdMob.showRewardVideoAd.mockRejectedValue(new Error('Reward Video is Not Ready Yet'));
    const shop = nativeShop({ startEarly: false });
    expect(await shop.watchAd()).toBe('unavailable');
    expect(shop.adProblem()).toBe('the ad couldn’t show: Reward Video is Not Ready Yet');
  });

  it('says unavailable when the privacy choices rule out ads', async () => {
    AdMob.requestConsentInfo.mockResolvedValue({
      status: 'OBTAINED',
      isConsentFormAvailable: true,
      canRequestAds: false,
    });
    const shop = nativeShop({ startEarly: false });
    expect(await shop.watchAd()).toBe('unavailable');
    expect(shop.adProblem()).toBe('ads not allowed by the privacy choices');
    expect(AdMob.initialize).not.toHaveBeenCalled();
  });
});
