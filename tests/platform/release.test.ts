import { beforeEach, describe, expect, it, vi } from 'vitest';

const env = vi.hoisted(() => ({
  native: true,
  platform: 'ios',
  environment: 'Production',
  fail: false,
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => env.native, getPlatform: () => env.platform },
}));
vi.mock('@capgo/native-purchases', () => ({
  NativePurchases: {
    getAppTransaction: async () => {
      if (env.fail) throw new Error('iOS 15');
      return { appTransaction: { environment: env.environment } };
    },
  },
}));

async function storeRelease() {
  vi.resetModules();
  const { isStoreRelease } = await import('../../src/platform/release');
  return isStoreRelease();
}

beforeEach(() =>
  Object.assign(env, { native: true, platform: 'ios', environment: 'Production', fail: false }),
);

describe('isStoreRelease', () => {
  it('is an App Store copy on iPhone only in the Production environment', async () => {
    expect(await storeRelease()).toBe(true);
    env.environment = 'Sandbox'; // TestFlight and Xcode builds
    expect(await storeRelease()).toBe(false);
  });

  it('treats an iPhone that cannot tell as an App Store copy', async () => {
    env.fail = true;
    expect(await storeRelease()).toBe(true);
  });

  it('is never a store copy on the web', async () => {
    env.native = false;
    expect(await storeRelease()).toBe(false);
  });

  it('on Android follows the production-track build flag', async () => {
    env.platform = 'android';
    vi.stubEnv('VITE_REAL_ADS', '');
    expect(await storeRelease()).toBe(false);
    vi.stubEnv('VITE_REAL_ADS', '1');
    expect(await storeRelease()).toBe(true);
    vi.unstubAllEnvs();
  });
});
