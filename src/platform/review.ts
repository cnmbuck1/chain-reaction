// Apple's own rating prompt (SKStoreReviewController / AppStore.requestReview). Apple decides
// whether it really appears: never in TestFlight, at most three times a year. Only on iPhone;
// the web build and Android (not shipped yet) do nothing.

import { Capacitor } from '@capacitor/core';
import { InAppReview } from '@capacitor-community/in-app-review';

/** Lets the result card's stars land before the prompt slides in. */
export const REVIEW_DELAY_MS = 1500;

export function requestReview(delay = REVIEW_DELAY_MS) {
  if (Capacitor.getPlatform() !== 'ios') return;
  setTimeout(() => {
    InAppReview.requestReview().catch(() => {
      // No prompt this time; nothing for the player to see.
    });
  }, delay);
}
