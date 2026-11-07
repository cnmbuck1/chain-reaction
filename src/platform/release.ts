// Is this copy of the app the one players get from the store? TestFlight, Xcode and Android
// test-track builds are not, so they keep test ads and the testing tools in Settings.

import { Capacitor } from '@capacitor/core';
import { NativePurchases } from '@capgo/native-purchases';

let cached: Promise<boolean> | null = null;

/**
 * True for an App Store copy on iPhone, and for an Android build made for Play's production
 * track (VITE_REAL_ADS). Always false on the web, where the prototype keeps its testing tools.
 */
export function isStoreRelease(): Promise<boolean> {
  cached ??= (async () => {
    if (!Capacitor.isNativePlatform()) return false;
    if (Capacitor.getPlatform() === 'android') return import.meta.env.VITE_REAL_ADS === '1';
    try {
      const { appTransaction } = await NativePurchases.getAppTransaction();
      return appTransaction.environment === 'Production';
    } catch {
      // Can't tell (older iOS): treat it as an App Store copy.
      return true;
    }
  })();
  return cached;
}
