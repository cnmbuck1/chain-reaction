import { beforeEach, describe, expect, it, vi } from 'vitest';

const purchases = vi.hoisted(() => ({
  getProducts: vi.fn(),
  purchaseProduct: vi.fn(),
  getPurchases: vi.fn(),
  restorePurchases: vi.fn(),
  getAppTransaction: vi.fn(),
}));

vi.mock('@capacitor/core', () => ({ Capacitor: { getPlatform: () => 'ios' } }));
vi.mock('@capacitor-community/admob', () => ({
  AdMob: {},
  AdmobConsentStatus: { REQUIRED: 'REQUIRED' },
  InterstitialAdPluginEvents: {},
  RewardAdPluginEvents: {},
}));
vi.mock('@capgo/native-purchases', () => ({
  NativePurchases: purchases,
  PURCHASE_TYPE: { INAPP: 'inapp' },
}));

const { nativeShop } = await import('../../src/monetize/nativeShop');

beforeEach(() => {
  vi.resetAllMocks();
  purchases.getProducts.mockResolvedValue({ products: [] });
});

describe('nativeShop purchases', () => {
  it('shows the store prices once they load', async () => {
    purchases.getProducts.mockResolvedValue({
      products: [
        { identifier: 'coins_100', priceString: '0,99 €' },
        { identifier: 'remove_ads', priceString: '2,99 €' },
      ],
    });
    const shop = nativeShop({ startEarly: false });
    await vi.waitFor(() => expect(shop.removeAdsPrice()).toBe('2,99 €'));
    expect(shop.packs().map((p) => p.price)).toEqual(['0,99 €', '$3.99']);
  });

  it('buys a coin pack as a consumable and returns its coins', async () => {
    purchases.purchaseProduct.mockResolvedValue({ transactionId: 't1' });
    const shop = nativeShop({ startEarly: false });
    expect(await shop.buy('coins_600')).toBe(600);
    expect(purchases.purchaseProduct).toHaveBeenCalledWith({
      productIdentifier: 'coins_600',
      productType: 'inapp',
      isConsumable: true,
    });
  });

  it('gives nothing when the player cancels or the pack is unknown', async () => {
    purchases.purchaseProduct.mockRejectedValue(new Error('User cancelled'));
    const shop = nativeShop({ startEarly: false });
    expect(await shop.buy('coins_100')).toBe(0);
    expect(await shop.buy('coins_9999')).toBe(0);
    expect(await shop.buyRemoveAds()).toBe(false);
  });

  it('finds Remove ads bought before, by restoring or quietly', async () => {
    purchases.getPurchases.mockResolvedValue({ purchases: [{ productIdentifier: 'remove_ads' }] });
    const shop = nativeShop({ startEarly: false });
    expect(await shop.adFreeOwned()).toBe(true);
    expect(purchases.restorePurchases).not.toHaveBeenCalled();
    expect(await shop.restore()).toBe(true);
    expect(purchases.restorePurchases).toHaveBeenCalled();
  });

  it('reports no Remove ads when the store has none or fails', async () => {
    purchases.getPurchases.mockResolvedValueOnce({
      purchases: [{ productIdentifier: 'coins_100' }],
    });
    const shop = nativeShop({ startEarly: false });
    expect(await shop.adFreeOwned()).toBe(false);
    purchases.getPurchases.mockRejectedValue(new Error('offline'));
    expect(await shop.restore()).toBe(false);
  });
});
