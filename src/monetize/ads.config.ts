// AdMob setup for the phone apps. See docs/ADS_AND_PURCHASES.md for the console steps.
//
// iPhone uses the real Chain Reaction units (app ID in ios/App/App/Info.plist). Android still
// has Google's public sample units, which always show test ads, until its AdMob app exists
// (then replace them and the app ID in android/app/src/main/AndroidManifest.xml).

/** Test ads even where real units are set (TestFlight and non-production Android builds get them anyway). */
export const ADS_TESTING = false;

export const AD_UNITS_IOS = {
  interstitial: 'ca-app-pub-8965676427575286/6743155595',
  rewarded: 'ca-app-pub-8965676427575286/4116992252',
};

export const AD_UNITS_ANDROID = {
  interstitial: 'ca-app-pub-3940256099942544/1033173712',
  rewarded: 'ca-app-pub-3940256099942544/5224354917',
};

/** Google's sample units all start with this publisher ID. */
export const isSampleUnit = (unit: string) => unit.startsWith('ca-app-pub-3940256099942544/');
