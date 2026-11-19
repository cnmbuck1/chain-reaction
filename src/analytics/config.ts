// Firebase Analytics for the phone apps. See docs/ANALYTICS.md for the console steps.
//
// iOS is on: ios/App/App/GoogleService-Info.plist is in the app. Android stays off until
// android/app/google-services.json is added, since without it the SDK has no app to report to.

/** The platforms that send level events to Firebase. Add 'android' once its config file is in. */
export const ANALYTICS_PLATFORMS: readonly string[] = ['ios'];
