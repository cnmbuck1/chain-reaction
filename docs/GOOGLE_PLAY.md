# Google Play: putting Chain Reaction on Android

The Android app is built by the **Android build** workflow on GitHub (`.github/workflows/android-play.yml`,
no Android Studio needed). It's the same setup as Rack & Roll. This guide is the part done in your browser.

**Check the testing rule early:** on personal developer accounts, Google asks for a **closed test with at
least 12 testers for 14 days in a row** before a new app can go to production. Look at the new app's
**Dashboard** in the Play Console once it's created: if it shows the closed-testing step, start the 14 days
as soon as the first build is up, since it sets the soft launch date.

| Thing | Value |
|---|---|
| App name | `Chain Reaction` (or `Chain Reaction: Logic Puzzle` if taken) |
| Package name | `com.cnmbuckstudios.chainreaction` (fixed for good once the first build is uploaded) |
| Products | `coins_100`, `coins_600`, `remove_ads` ($2.99) |

## 1. The upload key (GitHub secrets)

Google Play only accepts builds signed with this app's **upload key**. Use a new key for Chain Reaction, not
the Rack & Roll one. It comes as four values. In GitHub: **chain-reaction → Settings → Secrets and variables →
Actions → New repository secret**, four times:

| Name | Secret |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | the key file as one long line of text |
| `ANDROID_KEYSTORE_PASSWORD` | the key file's password |
| `ANDROID_KEY_ALIAS` | `upload` |
| `ANDROID_KEY_PASSWORD` | the key's password |

Keep a copy of the key file and its password somewhere safe (a password manager). It's never stored in the
repository. If it's lost, Google can swap in a new upload key after a support request.

To make one yourself on any computer with Java installed:

```
keytool -genkeypair -v -keystore chain-reaction-upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 chain-reaction-upload.jks > ANDROID_KEYSTORE_BASE64.txt   # on a Mac: base64 -i chain-reaction-upload.jks
```

## 2. Create the app in the Play Console

1. [play.google.com/console](https://play.google.com/console) → **Create app**.
   - App name: `Chain Reaction`. Language: English (United States).
   - **Game**, **Free**. Tick the two declarations.
2. The payments profile from Rack & Roll covers this app too.

## 3. The first build

1. GitHub → **Actions → Android build → Run workflow**, track **internal** or **alpha**, then **Run workflow**.
   About 5 minutes.
2. Open the finished run, scroll to **Artifacts**, download **chain-reaction-android** and unzip it. The `.aab`
   is for Google Play; the `.apk` installs straight onto an Android phone.
3. Play Console → **Test and release → Testing → Closed testing** (or **Internal testing**) → **Create new
   release** → upload the `.aab`. Accept Google's default for **Play App Signing**.
4. Under the track's **Testers** tab, add your testers' Gmail addresses and send them the **join link**.

## 4. Builds straight to Google Play (optional)

If the Rack & Roll service account is set up, invite the same service account email in this app's Play
Console (**Users and permissions**, "Release to testing tracks" and "Release to production") and save the
same JSON key as the repository secret `PLAY_SERVICE_ACCOUNT_JSON` here. Each run then puts a draft release on
the chosen track; you press **Start rollout**. This only works after the first `.aab` was uploaded by hand.

## Later milestones

In-app products, AdMob for Android, the store listing and the App content declarations (privacy policy, ads,
content rating, data safety) come with the ads, purchases and store pack milestones.
