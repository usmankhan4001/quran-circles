# Google Play Console: URLs, data safety answers and listing text

Status: draft, 2026-10-26. Written for Muhammad to copy into Play Console. The Urdu is a draft and the legal wording has not been seen by a lawyer. Everything below was checked against the code on `main` at `7b3101b`; where the code and an older document disagree, the code wins and the difference is listed under "Things to decide".

The package name is `pk.doraquran.circles`. The public pages are routes of the web app at `https://qurancircle.doraquran.pk`, built from `apps/user-app/src/screens/public/`; the words are in `packages/i18n` (`store.*`, `privacy.*`, `deleteAccount.*`, `support.*`, `terms.*`, `legal.*`).

## URLs to enter

| Play Console field                          | URL                                                |
| ------------------------------------------- | -------------------------------------------------- |
| Privacy policy                              | `https://qurancircle.doraquran.pk/privacy`         |
| Account deletion URL (Data safety)          | `https://qurancircle.doraquran.pk/delete-account`  |
| Website (store listing contact details)     | `https://qurancircle.doraquran.pk/welcome`         |
| Support page (also linked from the listing) | `https://qurancircle.doraquran.pk/support`         |
| Terms (optional, link from the description) | `https://qurancircle.doraquran.pk/terms`           |
| Contact email                               | **not decided** (see "Things to decide", number 1) |

The pages need no sign-in and ask the server for nothing about the person. They only exist on the live site after this branch is merged to `main` and Dokploy deploys it.

## Data safety form

Play asks, for each type of data, whether the app collects it, whether it is shared, why, and whether it is optional. "Shared" in Play's sense means sent to a third party for that party's own use; handing data to a service provider that works on our behalf (WhatsApp delivery, push delivery, hosting) is not sharing. The pages say the same in the privacy policy.

### Top-level questions

| Question                                               | Answer                                                                   |
| ------------------------------------------------------ | ------------------------------------------------------------------------ |
| Does the app collect or share any required data types? | Yes                                                                      |
| Is all of the data encrypted in transit?               | Yes (HTTPS everywhere, HSTS)                                             |
| Do you provide a way for users to request deletion?    | Yes: in the app (Profile, "Delete my account") and on the web page above |
| Account creation methods                               | Phone number with a one-time code (and no password)                      |

### Data types

| Play category and type                         | Collected | Shared | Optional?                                            | Purpose                               | What it is in the app                                                                                                                  |
| ---------------------------------------------- | --------- | ------ | ---------------------------------------------------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Personal info: **Name**                        | Yes       | No     | Required to join a circle; browsing needs no account | App functionality, Account management | `users.display_name`, typed when joining                                                                                               |
| Personal info: **Phone number**                | Yes       | No     | Required to sign in or join                          | App functionality, Account management | Sign-in number, code delivery, reminders and confirmations                                                                             |
| Personal info: **Other info**                  | Yes       | No     | Optional                                             | App functionality, Personalisation    | Age group, profession, education, prior Quran reading, language, daily goal; the area and section chosen when joining (see decision 3) |
| App activity: **App interactions**             | Yes       | No     | Optional (only for signed-in people)                 | App functionality                     | Circles joined and cancelled, circles and masjids followed, reading days, memorised surahs, reading position                           |
| App activity: **Other user-generated content** | Yes       | No     | Optional                                             | App functionality                     | Bookmark notes                                                                                                                         |
| Device or other IDs                            | Yes       | No     | Optional (only if notifications are allowed)         | App functionality                     | Push token (Firebase Cloud Messaging on Android, the browser's push address on the web)                                                |

### Data types to answer "No" to, with the reason

- **Location (approximate and precise): No.** `app.config.ts` blocks `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION` and `ACCESS_BACKGROUND_LOCATION`, and `location.native.ts` never asks. The area is picked from a list. "Use my location" exists on the web only and stays on the device.
- **Financial info, Health and fitness, Messages (emails, SMS, other), Photos and videos, Audio, Files and docs, Calendar, Contacts, Web browsing: No.** None is read.
- **App info and performance (crash logs, diagnostics): No.** No analytics or crash SDK is in the app (`apps/user-app/package.json`). Google Play and Firebase may collect their own; that is theirs.
- **Advertising or marketing: No.** No ads, no ad id, no sale of data.

### Other forms in Play Console

| Form                                  | Suggested answer                                                                                                                                                    |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ads                                   | No ads                                                                                                                                                              |
| App access                            | Some features need sign-in. Reviewers need a way in: see decision 5                                                                                                 |
| Content rating                        | Religious content; no user-to-user chat, no gambling, no violence. Answer the questionnaire from the app, not from this line                                        |
| Target audience                       | 13 and over (decision 4). Not designed for children, so the Families policy does not apply                                                                          |
| Government, news, health, finance app | No                                                                                                                                                                  |
| Permissions declared                  | Internet, notifications (Android 13 and later), vibrate and the boot-completed receiver that notifications add. Check the merged manifest after the first EAS build |

## Store listing text

Play's limits: app name 30, short description 80, full description 4000. Corrected from `docs/release/store-listing.md`, which still said "reserve a seat": registering is a pledge to join, not a booking (`docs/product/decisions.md`, Registration).

| Field             | English                                                                | Urdu                                                                          |
| ----------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| App name          | Quran Circles (13)                                                     | قرآن سرکلز                                                                    |
| Short description | Find a Quran circle at a masjid near you, join it and read along. (65) | اپنے قریب مسجد میں قرآنی حلقہ تلاش کریں، اس میں شامل ہوں اور ساتھ پڑھیں۔ (72) |
| Category          | Education                                                              |                                                                               |
| Tags (suggested)  | Education, Religion, Reference                                         |                                                                               |

### Full description, English

Quran Circles helps you find and join Quran study circles at masjids in Pakistan.

FIND A CIRCLE NEAR YOU
See the circles in your city and area on a map or a list, with the masjid, the day and the time.

KNOW WHAT YOU WILL STUDY
Each circle shows the portion for the next session, so you can read ahead.

JOIN IN A FEW TAPS
Sign in with a code sent on WhatsApp and pledge to come. We confirm, remind you before each session, and tell you if the time changes or a session is cancelled.

READ ALONG
Open the Quran with translation, keep your place, and track the surahs you are memorising.

PRAYER TIMES
Today's five prayers for your city, with the next one highlighted.

KEEP YOUR JOURNEY
The circles you joined and the masjids you follow, in one place.

Quran Circles is free, has no ads, and never sells your information. It works in English and Urdu and is built to stay quick on low-end phones and slow connections.

Privacy policy: https://qurancircle.doraquran.pk/privacy
Delete your account: https://qurancircle.doraquran.pk/delete-account

Quran Circles is a service of Tanzeem-e-Islami.

### Full description, Urdu (draft)

قرآن سرکلز آپ کو پاکستان کی مساجد میں قرآنی حلقے تلاش کرنے اور ان میں شامل ہونے میں مدد دیتا ہے۔

اپنے قریب حلقہ تلاش کریں
اپنے شہر اور علاقے کے حلقے نقشے یا فہرست میں دیکھیں، مسجد، دن اور وقت کے ساتھ۔

جانیے آپ کیا پڑھیں گے
ہر حلقہ اگلی نشست کا حصہ دکھاتا ہے، تاکہ آپ پہلے سے پڑھ سکیں۔

چند ٹیپ میں شامل ہوں
واٹس ایپ پر آنے والے کوڈ سے سائن اِن کریں اور آنے کا وعدہ کریں۔ ہم تصدیق کرتے ہیں، ہر نشست سے پہلے یاد دلاتے ہیں اور وقت بدلنے یا نشست منسوخ ہونے پر بتاتے ہیں۔

ساتھ پڑھیں
ترجمے کے ساتھ قرآن کھولیں، جہاں رکے وہیں سے جاری رکھیں اور اپنے حفظ کا حساب رکھیں۔

اوقاتِ نماز
آپ کے شہر میں آج کی پانچوں نمازوں کے اوقات، اگلی نماز نمایاں۔

اپنا سفر جاری رکھیں
جن حلقوں میں آپ شامل ہوئے اور جو مساجد آپ فالو کرتے ہیں، ایک ہی جگہ۔

قرآن سرکلز مفت ہے، اس میں اشتہار نہیں ہیں اور آپ کی معلومات کبھی فروخت نہیں کی جاتیں۔ یہ انگریزی اور اردو میں ہے اور کم قیمت فونز اور سست انٹرنیٹ پر بھی تیز چلنے کے لیے بنائی گئی ہے۔

رازداری کی پالیسی: https://qurancircle.doraquran.pk/privacy
اکاؤنٹ حذف کریں: https://qurancircle.doraquran.pk/delete-account

قرآن سرکلز تنظیمِ اسلامی کی ایک خدمت ہے۔

## Things to decide

1. **Contact email.** Not chosen. The pages show `[contact email not set yet]` and no mail button until it is set. Set `QC_CONTACT_EMAIL` in the Dokploy environment (it is passed to the web build as `EXPO_PUBLIC_CONTACT_EMAIL`), then redeploy. Play also needs it in the listing's contact details. Choose it before submitting.
2. **Who we are in the policy.** The pages say Quran Circles is run by "Tanzeem-e-Islami", taken from the logo and the earlier listing draft. Confirm the legal name of the publisher account, and whether the policy should name a legal entity and address.
3. **Is the chosen area "location" for Play?** The area is a neighbourhood picked from a list, not read from the device. The answer above treats it as profile information ("Other info"). A stricter reading would also declare "Approximate location" collected, not shared, for app functionality. Declaring it costs nothing at review; leaving it out risks a mismatch if a reviewer reads it that way. Recommendation: leave it out, and say so if asked.
4. **Minimum age.** The policy says the app is not for children under 13. Profile offers an "under 18" age band, so minors can use it. Confirm 13 or choose another age; it also sets the target audience and content rating answers.
5. **Reviewer access.** Sign-in needs a code on WhatsApp. Production has no fixed test code (`AUTH_FIXED_CODE` is for staging only), so Play's reviewers cannot sign in. Either state in "App access" that most of the app works without an account, or prepare a reviewer account with a number you control and give the code on request. Do not set a fixed code in production.
6. **Deletion by email is a promise.** The delete page says that if someone cannot sign in, they can email, we send a WhatsApp code to the number to check it is them, and we aim to finish within 30 days. That needs a person to do it. There is no admin screen for deleting a user in the console that I found; the API's `me.delete` only deletes the signed-in person. Confirm the 30 days and who does it, or ask for an admin tool.
7. **What the policy claims about messages.** SEC-06 in `docs/security/review.md` says names stay in `message_outbox.payload` after sending and, for invitations, after the sender is deleted. The delete page says only that messages sent to the person lose their number and text, which the deletion code does. It does not claim the invitation names are removed. Fixing SEC-06 would let the page say more.
8. **Hosting and other countries.** The policy does not say where the servers are. If the Dokploy host is outside Pakistan, say so, and name the SMS provider once one is chosen (`SMS_GATEWAY_URL` is not set yet).
9. **Rights beyond deletion.** The policy offers "ask us what we hold about you" and correction by email. There is no data-export tool. Keep the wording if someone will answer such emails by hand.
10. **Page text size.** The new words add about 5.5 KB (English) and 7 KB (Urdu) gzip to the user-app's language file, which every visitor downloads. A separate on-demand part for the legal text would remove that, but it changes `packages/i18n` and the web language loader, so it needs the contracts and ui lanes.
11. **Search engines and Play's checker.** The pages are drawn by the app in the browser (the site is a single-page app). Browsers and Google show them fine; if Play's policy checker reports "no content", a static copy of the four text pages generated at build time is the fix.
12. **Screenshots.** The landing page shows the app icon and feature text only, because the project's shared folder has icons but no current screenshots. Add screenshots from `tools/store-assets` once they are regenerated for the pledge flow (the old ones show seat booking).
13. **Play button link.** It points at `https://play.google.com/store/apps/details?id=pk.doraquran.circles`, which gives "not found" until the app is published. Override with `EXPO_PUBLIC_PLAY_STORE_URL` if needed.
14. **Landing at `/welcome`, not `/`.** The root of the site is the app itself and redirects to Home, so the landing page lives at `/welcome`. Say if the root should show it instead.

## Change to the older listing file

`docs/release/store-listing.md` still describes "Reserve your seat". It is the Apple and Google draft from 2026-10-18; the Google text above replaces it for Play. The Apple text is not changed here.
