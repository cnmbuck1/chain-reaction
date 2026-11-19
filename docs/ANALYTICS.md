# Analytics: seeing how far players get

The phone apps send level events to **Firebase Analytics** (`src/analytics/`), so the Firebase
console shows progress across every player: how many reach each level, where they quit, and how
much help each level takes. Use it to judge when players are close to level 60 and the next
update of 20 levels is needed.

The Settings > Play stats screen is still there, but it only ever shows the phone it's on.

Nothing is sent until the Firebase config files are in the repo and `ANALYTICS_READY` in
`src/analytics/config.ts` is on. The web build never sends anything.

## What is sent

| Event | When | Parameters |
|---|---|---|
| `level_start` | A level or daily opens, replays too | `level_name`, `level` |
| `level_run` | A Run ends at the goal or a stop | + `success` (1 or 0) |
| `level_end` | A level is solved | + `success`, `stars`, `runs`, `hints` |
| `level_quit` | A level is left unsolved | |
| `hint_used`, `retry_used` | A hint or retry is spent | + `paid` (coins, ad, free) |
| `rewarded_ad` | A rewarded ad was watched | `placement` |
| `shop_purchase` | A coin pack or Remove ads was bought | `item` |

`level` is the campaign number, 1 to 60. All daily puzzles are `level` 0, `level_name` `daily`.
The user property **`furthest_level`** holds the highest level each player has solved.
Firebase adds sessions, first opens, retention, country and device on its own.

No account, name or advertising ID is sent (IDFA and Android ad ID collection are turned off).

## 1. Create the Firebase project (about 10 minutes)

At [console.firebase.google.com](https://console.firebase.google.com), signed in with the Google
account that owns AdMob:

1. **Create a project** named `Chain Reaction`. Keep **Google Analytics** on, and pick your
   existing Analytics account (or let it create one).
2. **Add app → iOS**. Bundle ID `com.cnmbuckstudios.chainreaction`. Download
   **`GoogleService-Info.plist`**. Skip the "add SDK" and "initialisation code" steps.
3. **Add app → Android**. Package name `com.cnmbuckstudios.chainreaction`. Download
   **`google-services.json`**. Skip the remaining steps.
4. Send both files to Claude (upload them in the project). They aren't secret: they only say which
   Firebase project the app reports to. Claude commits them and turns `ANALYTICS_READY` on.
5. Optional: in AdMob, **Settings → Linked services → Firebase**, link both apps. Then ad revenue
   shows next to play data.

## 2. Register the custom parameters

Firebase only shows parameters in reports once they are registered. In the Firebase console,
**Analytics → Custom definitions → Create custom dimension**:

| Name | Scope | Parameter / property |
|---|---|---|
| Level | Event | `level` |
| Level name | Event | `level_name` |
| Success | Event | `success` |
| Stars | Event | `stars` |
| Furthest level | User | `furthest_level` |

Optionally add **custom metrics** (Event scope, Standard unit) for `runs` and `hints`.
Data shows up about a day after players start; the **DebugView** shows it live from a test phone.

## 3. Reading it

- **How far players get:** Reports → Engagement → Events → `level_end`, add the *Level* dimension.
  Users per level, from 1 down to 60, is the progress curve. Or open Explore → **Funnel
  exploration** with steps `level_end` where Level = 10, 20, 30, 40, 50, 60.
- **Who is near the end:** Explore → Free form, rows *Furthest level*, values *Active users*.
  When a good share of active players sit at 50 or above, it's time for the next 20 levels.
- **Where players stall:** `level_quit` and `level_run` with Success = 0, by *Level*. A level with
  many quits compared with its starts is a difficulty spike.
- **Help needed:** `hint_used` and `retry_used` by *Level*.

## 4. Privacy answers

**App Store Connect → App Privacy**, add to what AdMob already needs:

- **Usage Data → Product Interaction**: used for **Analytics**; **not linked** to the user's
  identity; **not used for tracking**.
- **Identifiers → Device ID**: Firebase uses an app instance ID. Used for **Analytics**, not
  linked, not used for tracking.
- **Diagnostics** is not needed (Crashlytics isn't included).

**Google Play Console → App content → Data safety**, add:

- **App activity → App interactions**: collected, not shared, for **Analytics**, processed
  ephemerally: no; optional: no.
- **Device or other IDs**: collected for **Analytics** (AdMob already declares it for ads).

The privacy policy should say the app sends anonymous gameplay events to Google Firebase
Analytics to improve the game.
