# Google Play: first release, step by step

Status: 2026-10-26. Branch `lane/release/play-readiness`, written from `main` at `abc05a0` (production runs that commit). This page is the runbook: the build, the Play Console clicks and the checklist. The words to paste (descriptions, data safety, app access) are in [`play-console.md`](play-console.md); the signing, Firebase and Maps background is in [`go-live.md`](go-live.md) section 3 and 5.

## 1. What the Android build is (audit, 2026-10-26)

| Item                      | State                                                                                                                                                                                                                      | Action                                                                                    |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Package name              | `pk.doraquran.circles` (`app.config.ts`, `APP_ID`). Permanent once the first bundle is uploaded                                                                                                                            | None                                                                                      |
| Version                   | `version` 0.1.0; `versionCode` comes from EAS (`appVersionSource: remote`, `autoIncrement: true` on production), so every build gets a higher code                                                                         | None. Raise `version` in `app.config.ts` for a visible release                            |
| Target SDK                | 36 (React Native 0.88 default, compile 37, min 24). Play requires 36 from 31 Aug 2026 for new apps and updates: met                                                                                                        | None. Expect Play to ask for 37 around Aug 2027                                           |
| Output                    | Production profile builds an AAB (`buildType: app-bundle`); preview builds an APK                                                                                                                                          | None                                                                                      |
| API address in the build  | Production `https://qurancircles.doraquran.pk/api`, preview `https://staging.doraquran.pk/api`                                                                                                                             | None (spelling checked: with an s)                                                        |
| Icon                      | `public/icons/icon-1024.png`, 1024x1024                                                                                                                                                                                    | None                                                                                      |
| Adaptive icon             | Foreground `adaptive-foreground.png` 1024x1024 with transparency on a white background                                                                                                                                     | None                                                                                      |
| Splash                    | No splash plugin is set, so Android 12+ shows the system splash (app icon on the window background) and older phones a plain window                                                                                        | Optional polish later (needs `expo-splash-screen`, a dependency change). Not a blocker    |
| Permissions               | Location (fine, coarse, background) and shared storage (read, write) are blocked in `app.config.ts`. Added by libraries: internet, notifications (Android 13+), vibrate, boot-completed receiver. No camera, mic, contacts | After the first build open Play Console, App bundle explorer, to read the merged list     |
| Deep links                | Custom scheme `quran-circles://` only. No `https` intent filters, so no `assetlinks.json` is needed                                                                                                                        | None                                                                                      |
| Push (Firebase / FCM)     | `google-services.json` is read from the EAS file variable `GOOGLE_SERVICES_JSON`. Not set up yet: the build succeeds and push is off                                                                                       | Owner: see section 2, step 3. Adding it later needs a new build                           |
| Google Maps               | `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` is not set, so the app shows the keyless OpenStreetMap map                                                                                                                               | Fine for a first release. Android key needs the Play signing SHA-1 later                  |
| Back-up                   | Android default (`allowBackup`) applies; sign-in tokens live in the secure store, which Android does not restore to a new phone                                                                                            | None                                                                                      |
| Privacy and deletion text | The public pages still described WhatsApp-code sign-in. Fixed on this branch (English and Urdu, both drafts for a native proofread): email sign-in, Resend as processor, WhatsApp number as a given-not-verified detail    | Merge this branch before submitting for review so the policy matches the app and the form |

Nothing in `app.config.ts` or `eas.json` needed to change for the first build. They are store build configuration (human approval in the ownership map), so they were left alone.

## 2. Build and upload (you run these on your PC; each needs your login)

Needs Node 22 and pnpm 10.28 (repository root `package.json`). From the repository root:

```sh
pnpm install
npm install -g eas-cli          # 16 or newer
cd apps/user-app
eas login                       # the Expo account that owns @twoplustwoios-team/quran-circles
eas whoami                      # check it is the right one
```

1. **Check the project is yours.** `eas project:info` should show id `b4979929-6d56-42e0-aed0-6aa5e53d3069`. If the account cannot see it, run `eas init` and put the id it prints into the EAS variable `EAS_PROJECT_ID` (see `app.config.ts`).
2. **Signing: let EAS manage it.** The first production build asks "Generate a new Android Keystore?": answer yes. Afterwards run `eas credentials -p android`, choose the production profile and download a copy of the keystore. Keep it offline (a password manager attachment or an encrypted drive). This is the upload key; Play App Signing holds the real signing key.
3. **Firebase (push), before the first build.**
   1. Firebase console, add project, Add app, Android, package `pk.doraquran.circles`.
   2. Download `google-services.json` to a folder outside the repository.
   3. `eas env:create --name GOOGLE_SERVICES_JSON --type file --value ./google-services.json --environment production --visibility secret`, then once more with `--environment preview`.
   4. Project settings, Service accounts, Generate new private key. The JSON goes straight into Dokploy as `FCM_SERVICE_ACCOUNT_JSON`, never into the repository or a chat.
      Skip this and the app still works, with reminders by WhatsApp and email only; push needs a rebuild afterwards.
4. **Build the bundle.** `eas build -p android --profile production`. About 15 to 25 minutes on EAS's queue; it prints a build page URL. Download the `.aab` from that page when it finishes.
5. **Optional test phone build.** `eas build -p android --profile preview` makes an APK that talks to staging. Open its link on an Android phone to install it.
6. **First upload is by hand.** Google does not allow the API to create a new app's first release. In Play Console upload the `.aab` as described in section 3 (internal testing). After that, `eas submit -p android --profile production` (internal track, draft) works once a Play service account is linked (Play Console, Users and permissions, then `eas credentials`).

## 3. Play Console, click by click

Signed in to `play.google.com/console` with the developer account.

### 3.1 Create the app

1. All apps, Create app.
2. App name `Quran Circles`. Default language: English (United States). App or game: App. Free or paid: Free.
3. Declarations: tick the developer programme policies and US export laws boxes. Create app.

### 3.2 Set up your app (Dashboard checklist)

| Section (Policy and programs, App content)    | What to enter                                                                                                                                                                                                                                                                                    |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Privacy policy                                | `https://qurancircles.doraquran.pk/privacy`                                                                                                                                                                                                                                                      |
| App access                                    | "All or some functionality is restricted". Add instructions, paste the text from `play-console.md`, decision 5                                                                                                                                                                                   |
| Ads                                           | No, my app does not contain ads                                                                                                                                                                                                                                                                  |
| Content rating                                | Start questionnaire, email `support@qurancircles.doraquran.pk`, category "Reference, news, or educational". Answer No to violence, sexual content, bad language, controlled substances, gambling; No to users interacting or sharing location; No to digital purchases. Expect the lowest rating |
| Target audience and content                   | Age groups 13-15, 16-17, 18 and over. Not appealing to children. This keeps the app out of the Families programme                                                                                                                                                                                |
| Data safety                                   | Fill from `play-console.md`: collects Name, Email address, Phone number, App interactions, Other user-generated content (bookmark notes), Device or other IDs. None shared. Encrypted in transit: yes. Deletion: yes, account deletion URL `https://qurancircles.doraquran.pk/delete-account`    |
| Government apps / Financial features / Health | No / none / none                                                                                                                                                                                                                                                                                 |
| News apps                                     | Not a news app                                                                                                                                                                                                                                                                                   |
| Advertising ID                                | The app does not use it                                                                                                                                                                                                                                                                          |
| Store settings (Grow, Store presence)         | Category Education. Tags: Education, Religion, Reference. Contact email `support@qurancircles.doraquran.pk`, website `https://qurancircles.doraquran.pk/store`. Phone number is optional: leave empty                                                                                            |
| Main store listing                            | App name, short and full description from `play-console.md` (English). Upload the graphics in section 4                                                                                                                                                                                          |
| Translations                                  | Manage translations, add Urdu (اردو), paste the Urdu name and descriptions, upload the Urdu screenshots. Have a native speaker proofread first                                                                                                                                                   |

### 3.3 Upload to internal testing

1. Testing, Internal testing, Create new release.
2. Play App Signing: accept "Use Google-generated key".
3. Upload the `.aab`. Release name stays the default. Release notes: `Quran Circles first test build.` Save, then Next, then Start rollout to internal testing.
4. Testers tab, create an email list (yourself and a few people; up to 100), save. Copy the opt-in link and open it on an Android phone signed in with a listed Google account, then install from Play.
5. Test: browse as a guest, sign in with an email code, join a circle, open the Quran and prayer times, delete a test account.
6. Note the SHA-1 of the app signing key (Test and release, App integrity) if you later add an Android Maps key.

### 3.4 Closed testing and production

| Account type                                                            | What Google requires before production                                                                                                     |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Personal account created after 13 November 2023                         | A closed test with at least 12 testers opted in for 14 days in a row, then apply for production access (Dashboard, "Apply for production") |
| Organisation account (Tanzeem-e-Islami, verified with a D-U-N-S number) | No such requirement. After the content, listing and data safety forms are complete you can create a production release directly            |

The project notes say the account is an organisation account. Check Play Console, Settings, Developer account, Account details: "Account type". If it says Personal, run the closed test: Testing, Closed testing, Create track, add 12 or more tester emails (or a Google Group), roll out, and keep them opted in for 14 days.

Production: Production, Create new release, choose the tested bundle (Add from library), notes, Save, Send for review. First reviews usually take a few days.

## 4. Store graphics (made into `D:\Apps\CSG Venture\USMAN\play-assets`)

| Asset             | Play requirement                               | File                                                       |
| ----------------- | ---------------------------------------------- | ---------------------------------------------------------- |
| App icon          | 512x512, PNG, up to 1 MB                       | `icon-512.png`                                             |
| Feature graphic   | 1024x500, PNG or JPG, no transparency          | `feature-graphic-1024x500-en.png`, `...-ur.png`            |
| Phone screenshots | 2 to 8; 16:9 or 9:16; each side 320 to 3840 px | `screenshots/en/*.png`, `screenshots/ur/*.png` (1080x1920) |

Screenshots are the web build of the app against demo data, light mode, English and Urdu (right to left).

## 5. Final pre-launch checklist

- [ ] This branch is merged to `main` and Dokploy has redeployed (so the public pages match the email sign-in).
- [ ] `https://qurancircles.doraquran.pk/privacy`, `/delete-account`, `/support`, `/terms`, `/store` load without signing in (checked on 2026-10-26: they load).
- [ ] `support@` and `privacy@qurancircles.doraquran.pk` receive mail (Cloudflare Email Routing, forward to your inbox). Send a test from outside. Google may email the contact address.
- [ ] Reviewer mailbox `playreview@qurancircles.doraquran.pk` exists and a "Play review" account is registered (only needed for production review).
- [ ] Firebase set up and `GOOGLE_SERVICES_JSON` uploaded before the build (or you accept push being off).
- [ ] Keystore backed up offline.
- [ ] Production API healthy: `https://qurancircles.doraquran.pk/api/health` returns `{"ok":true}`; Resend sends from `notifications@qurancircles.doraquran.pk`.
- [ ] Internal test passed on a real phone: guest browse, email code sign-in, join, cancel, reminder opt-in, delete account.
- [ ] Urdu texts and screenshots proofread by a native speaker.
- [ ] All App content forms show a green tick; Data safety matches the privacy policy.
- [ ] Account type checked (section 3.4) and, if personal, 14-day closed test running.
- [ ] Production release created and sent for review.
