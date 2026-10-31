// AdMob setup for the phone apps. See docs/ADS_AND_PURCHASES.md for the console steps.
//
// These are Google's public sample ad units: they always show test ads, earn nothing and are
// safe to tap. The real units replace them once the AdMob apps exist, along with the AdMob app
// IDs in ios/App/App/Info.plist and android/app/src/main/AndroidManifest.xml.

/** Test ads even where real units are set (TestFlight and non-production Android builds get them anyway). */
export const ADS_TESTING = true;

export const AD_UNITS_IOS = {
  interstitial: 'ca-app-pub-3940256099942544/4411468910',
  rewarded: 'ca-app-pub-3940256099942544/1712485313',
};

export const AD_UNITS_ANDROID = {
  interstitial: 'ca-app-pub-3940256099942544/1033173712',
  rewarded: 'ca-app-pub-3940256099942544/5224354917',
};

/** Google's sample units all start with this publisher ID. */
export const isSampleUnit = (unit: string) => unit.startsWith('ca-app-pub-3940256099942544/');
