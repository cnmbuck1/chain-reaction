# Getting Chain Reaction onto the App Store (no Mac needed)

The iPhone app is built on a Mac in the cloud by GitHub (`.github/workflows/ios-testflight.yml`) and sent
straight to TestFlight. It's the same setup as Rack & Roll, so a lot of it is already done.

| | Value |
|---|---|
| App name | Chain Reaction (if it's taken, try "Chain Reaction: Logic Puzzle") |
| Bundle ID | `com.cnmbuckstudios.chainreaction` (fixed for good after the first upload) |
| SKU | `chainreaction` |
| Version | from `package.json` |
| Devices | iPhone only, portrait |
| Primary language | English (U.S.) |
| Category | Games → Puzzle (secondary: Casual) |

## 1. Register the app ID

At [developer.apple.com/account](https://developer.apple.com/account) → **Certificates, IDs & Profiles →
Identifiers → +**:

1. Choose **App IDs → App**.
2. Description: `Chain Reaction`. Bundle ID: **Explicit**, `com.cnmbuckstudios.chainreaction`.
3. Leave the capabilities as they are (In-App Purchase is on by default). **Continue → Register**.

Your iPhone is already registered from Rack & Roll, so there's nothing to do under **Devices**.

## 2. Create the app in App Store Connect

At [appstoreconnect.apple.com](https://appstoreconnect.apple.com) → **Apps → + → New App**:

- Platforms: **iOS**
- Name: **Chain Reaction**
- Primary language: English (U.S.)
- Bundle ID: pick `com.cnmbuckstudios.chainreaction`
- SKU: `chainreaction`
- User access: Full access

## 3. Give GitHub the four secrets

GitHub keeps secrets per repository, so they need adding again here, with the **same values** as in
poolgolf. The API key from Rack & Roll works for every app on your team. If you no longer have the `.p8`
file, make a new key: App Store Connect → **Users and Access → Integrations → App Store Connect API →
Team Keys → +**, name `GitHub`, access **Admin**, then download it (only possible once).

On GitHub: **cnmbuck1/chain-reaction → Settings → Secrets and variables → Actions → New repository secret**:

| Name | Value |
|---|---|
| `APPLE_TEAM_ID` | your 10-character Team ID (developer.apple.com → Membership details) |
| `ASC_KEY_ID` | the API key's Key ID |
| `ASC_ISSUER_ID` | the Issuer ID (above the key list) |
| `ASC_PRIVATE_KEY` | everything in the `.p8` file, including the `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----` lines |

Secrets are encrypted and never shown in the build logs, even though the repository is public. Never paste
them into a chat, an issue or a file in the repository.

## 4. Build and install with TestFlight

1. GitHub → **Actions → iPhone build to TestFlight → Run workflow → Run workflow**. It takes about
   10–20 minutes.
2. When it's green, App Store Connect → Chain Reaction → **TestFlight**. The build appears after Apple
   processes it (usually 5–30 minutes).
3. Add yourself under **Internal Testing** and install it from the **TestFlight** app on your iPhone.
4. For friends, create an **External Testing** group with a **public link**. The first external build gets
   a short beta review (usually a day).

Run the workflow again whenever there's an update you want on your phone; each run uploads a new build.

## 5. Before submitting (later milestones)

- **Agreements, Tax, and Banking**: the Paid Apps agreement must be active for purchases to work. If it's
  active for Rack & Roll, it already covers this app.
- **In-app purchases** and AdMob: see `docs/ADS_AND_PURCHASES.md`.
- **App Privacy**, the age rating, the store page text and screenshots come with the store pack.
