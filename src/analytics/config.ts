// Firebase Analytics for the phone apps. See docs/ANALYTICS.md for the console steps.
//
// Off until the Firebase config files are in the apps (ios/App/App/GoogleService-Info.plist and
// android/app/google-services.json): without them the Android SDK has no app to report to.

/** Send level events to Firebase. Turn on once both config files are committed. */
export const ANALYTICS_READY = false;
