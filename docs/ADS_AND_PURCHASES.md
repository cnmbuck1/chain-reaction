# Ads and purchases: setting them up

The phone apps already run on **Google's test ads** and the stores' purchase flow
(`src/monetize/nativeShop.ts`). The web build keeps the demo shop. What's left is console work, then
sending Claude the IDs. Never tap your own real ads: it can get an AdMob account suspended.

## What the game does

| | Where | Notes |
|---|---|---|
| **Rewarded ad** | Shop: *Watch a short ad*, 3 coins, 3 a day | Coins only if it's watched to the end. |
| **Interstitial** | After every 3rd clean solve, from level 10 | Never after a miss, a hint or the daily. None after Remove ads. Pacing lives in `src/monetize/prices.ts`. |
| **Coin packs** | Shop | `coins_30` and `coins_150` in the game and on Play; `Coins_30` and `Coins_150` in App Store Connect. Consumable. |
| **Remove ads** | Shop, $2.99 | `remove_ads` (`Remove_ads` in App Store Connect), non-consumable. **Restore purchases** in the shop brings it back on a new phone, and the app checks quietly at launch too. |

Consent: the first time ads start, players in the EU/UK see Google's consent form, then iPhone players
see Apple's "Allow tracking?" question. Saying no still shows ads, just less personalised ones.

Test or real ads: iPhone copies from TestFlight always get test ads, App Store copies get real ones.
Android builds get real ads only when the **Android build** workflow runs with the **production** track.
Until `ADS_TESTING` in `src/monetize/ads.config.ts` is switched off, everything gets test ads.

## 1. AdMob

At [admob.google.com](https://admob.google.com) (the account you used for Rack & Roll):

1. **Apps → Add app → iOS**. "Is the app listed?" **No**. Name: `Chain Reaction`. Note the **App ID**
   (`ca-app-pub-…~…`).
2. In that app, **Ad units → Add ad unit**, twice:
   - **Rewarded**, named `Shop coins`. Leave the reward settings as they are; the game decides the reward.
   - **Interstitial**, named `Between levels`.
3. Do the same for **Android**: **Apps → Add app → Android**, name `Chain Reaction`, and the same two ad
   units with ` (Android)` on their names.
4. **Privacy & messaging → European regulations (GDPR)**: add Chain Reaction (both apps) to your published
   message, or create one with the default settings and the privacy policy link from the store pack.
5. Send Claude the **two App IDs** and the **four ad unit IDs**. They aren't secret, but they go live only
   after you've tried the test build.

Your `app-ads.txt` at `https://cnmbuck1.github.io/app-ads.txt` covers this app too (same AdMob account), as long
as the store listings give `https://cnmbuck1.github.io` as the developer website.

## 2. App Store Connect

1. **Business**: the **Paid Apps** agreement must be active, with banking and tax filled in. If it's active
   for Rack & Roll, it covers this app too.
2. Chain Reaction → **Monetization → In-App Purchases → +**, three times:

   | Type | Reference name | Product ID | Price |
   |---|---|---|---|
   | Consumable | 30 coins | `Coins_30` | $0.99 |
   | Consumable | 150 coins | `Coins_150` | $2.99 |
   | Non-Consumable | Remove ads | `Remove_ads` | $2.99 |

   For each one, add an English display name and description, then a review screenshot (a phone screenshot
   of the shop works; Claude makes one with the store pack). The product IDs above are what App Store Connect has, capitals included (`APP_STORE_IDS` in `src/monetize/prices.ts`). Play IDs must be lowercase.
3. To try purchases in TestFlight, you don't need a sandbox account: TestFlight purchases are free.

## 3. Google Play Console

Products can only be added once a build has been uploaded (see `docs/GOOGLE_PLAY.md`).

1. Chain Reaction → **Monetize with Play → Products → One-time products → Create product**, three times, with
   the same IDs and prices as the table above. **Save**, then **Activate**.
2. **Settings → License testing**: add your Gmail and any tester's, so their purchases are free test ones.

## 4. Going live

Once the IDs are in, a TestFlight build should show **test** ads with the real units. When it's on the App
Store (or a production Android build), real ads start and purchases charge for real.
