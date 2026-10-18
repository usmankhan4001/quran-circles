# Status: user-app

Updated: 2026-10-18
Branch: claude/peaceful-archimedes-ain95k (orchestrator commits; nothing committed by this lane)

## Web push fixtures and SEC-23 (2026-10-18)

- **Push fixtures for the web push allowlist (contracts commit `8201cf0`).** A `webpush` token must now be `PushSubscription.toJSON()` serialised, on an allowed push host. 8 tests (reminders service, auth actions, Profile push switch) sent `'test-subscription'` and failed. `src/test/harness.tsx` now exports `FAKE_WEB_PUSH_TOKEN` (made-up subscription on `fcm.googleapis.com`, `expirationTime: null`, fake keys), used by `FakeRegistrar` and the device registration assertion in `features/reminders/service.test.ts`. No app code changed: `WebPushRegistrar` already sends `JSON.stringify(subscription.toJSON())`, which the rule accepts.
- New `src/platform/push.test.ts` (4 tests; `WebPushRegistrar` had no test): with a stubbed Push API, a new subscription and an existing one both give a token that `DeviceRegister` accepts and `parseWebPushToken` reads; refused permission returns `denied` without subscribing; no VAPID key is `unsupported`.
- **SEC-23 (service worker shell).** `public/sw.js` saves a page load as the offline shell only when the response is status 200, `type` `basic` from this origin (and its final `url` on this origin) and `Content-Type` `text/html`. Page loads under `/api/` and `/webhooks/` are not handled by the worker at all. The cache name went from `qc-shell-v1` to `qc-shell-v2`, so `activate` drops any shell v1 may have saved from a bad response. `src/platform/sw.test.ts`: 13 new tests (good page saved, case-insensitive content type, 404/500/204, opaque redirect, JSON, text, no content type, cross-origin and off-origin responses not saved, a refused response still reaches the page, `/api/` and `/webhooks/` left alone); 12 of them fail against the old worker. The token-in-`localStorage` part of SEC-10 is untouched (separate decision).
- Checks: `pnpm --filter @qc/user-app test` 930 passing in 59 files; `pnpm --filter @qc/user-app typecheck` clean; eslint and prettier clean on the five changed files.
- For the orchestrator: mark SEC-23 fixed in the security findings once reviewed.

## Ayah push taps (2026-10-17, follow-up)

- Tapping an `ayah_of_the_day` push now opens the reader at `/quran?surah=…&ayah=…`. Tap handling moved out of `src/app/_layout.tsx` into `src/nav/pushTaps.ts`: `pushTapRoute(data)` reads a server push with `PushData` from `@qc/contracts` and an exhaustive switch on its `type` (a new contract type fails the typecheck until handled); `ayah_of_the_day` parses `deepLink` with the contract's `parseDeepLink` and opens the `quran` route only for a valid `quran` link (scheme or web origin). The other six types keep today's behaviour (open `sessionId` when present), and on-device reminders (`{ sessionId }` only) still open their session. Anything malformed is ignored, so a tap just opens the app. `usePushTaps(source, navigator)` subscribes; `_layout.tsx` passes the `expo-notifications` response listener (null on the web).
- Feature flags are not read on a tap: the push only arrives when the server allowed it, so a tap opens the reader even with `ayah_of_the_day` off.
- Tests: `src/nav/pushTaps.test.tsx`, 29 tests (worker-shaped payload checked through `PushPayload`, scheme and web links, 15 malformed payloads, unchanged session behaviour per type, hook subscribe/unsubscribe, web no-op, flag off still opening the reader end to end through the Quran tab's address read-back). Totals: 912 passing in 58 files. `typecheck`, `test`, `npx eslint apps/user-app` and `npx prettier --check apps/user-app` pass.
- Not done (outside this follow-up): a tap that cold-starts the app is not read explicitly (`getLastNotificationResponseAsync`), so it depends on whether the listener sees the launch response on each platform; this was already true for reminders. Other push types do not yet follow their `deepLink` (for example `update` to `/updates/<id>`, which has no app route yet).

## Next features on contract 1.0.0-rc.4 (2026-10-17, late)

Built against `docs/product/features-next.md` and the accepted change request `2026-10-17-next-features.md`, contract `1.0.0-rc.4` and its mock (all five flags on there). Each piece is behind its flag, read with `featureOn` (missing is off); while the first `config.get` is on its way a card waits rather than flashing. Only `apps/user-app/**`, user-app keys in `packages/i18n` and this file were edited.

- **Days read (`reading_days`).** Home card "Days read": "1 of 7 days this week" (weeks Monday to Sunday, Pakistan dates) and "4 days this month", from one `readingDays.list` call covering whichever starts first. "I read today" records `manual`; with a daily goal, "I met today's goal" records `goal` (with `pages` when the unit is pages). Once today counts, the button gives way to a quiet "Today is counted". No streak, no missed-day words, no chain (product decision). Reading in the reader is recorded automatically: a new content mount `subscribeReading` (built on `readingPosition.subscribe` in `contentPackage.tsx`) tells `ReadingSync` (mounted next to `ReminderSync`) each time the reader saves a place; today (or yesterday, sent with `date`, for a save just before midnight) is recorded as `reader`, once per date and source while the app runs, retried after a failure, never for older dates. A date the server would refuse is not sent (`readingDayDateIssue`); the server's `{ path: 'date', code: 'out_of_range' }` gets a plain message and is not retried. Personal, so memory only; a visitor sees "Sign in to count the days you read".
- **Daily goal and revise-after (Profile, new "Reading" section).** Daily goal: No goal or 1, 2, 5 pages, 1, 2 rukus, 10, 15, 30 minutes (a goal set elsewhere is added to the list); `me.update` with `dailyGoal`. Revise after: 7, 14 (default), 21, 30 days; choosing 14 sends null (= default). Each shows only with its flag.
- **Read together today (`community_today`).** Flat card with the one national number: "{count} people read today" and "{count} pages read together", plural forms, digits through the translator. Public, saved for offline. When it cannot be had the card stays away (not worth a retry box).
- **Ayah of the day (`ayah_of_the_day`).** `ayahOfTheDay.get` with the followed venue and circle ids (repeated params, sorted, at most 50 each; waits for the follows so it asks once). A coordinator pick shows "Chosen by {name}". Arabic in the Quran font, the translation through `verseTranslation(verse, locale)` and the `QuranTextCredit` line come from the existing `AyahText` content mount. "Read this ayah" opens the `quran` route (`/quran?surah=…&ayah=…`); a test checks the contract's `buildDeepLink({ type: 'quran' })` parses back to the same route. Call fails with nothing saved: the contract's `builtInAyahFor(today)`. Flag off: the pre-rc.4 local pick (unchanged). Only the national pick (no follows) is saved on the device.
- **Ayah notification switch.** Profile, Notifications: "Ayah of the day" (`profile.ayahPush.*`), on when there is no row (`consentGranted('push', 'ayah_daily', rows)`), a revoked row is off; a change is one `consents.set` with `{ channel: 'push', purpose: 'ayah_daily', granted }`, no venue. Hidden with the flag off.
- **Memorisation (`memorisation`).** New screen and route `memorisation` (`/memorisation`), reached from a card on My Journey ("1 surah to revise this week"). Counts per mark on the green header; "Revise this week" lists memorised surahs past the person's setting via `needsRevision` (never revised first, then longest ago), each with "Mark revised" (`{ status: 'memorised', markRevised: true }`); "Your surahs" with a picker of all 114 (names from `@qc/content` `SURAHS`) and a sheet to set learning, memorised or revising, mark revised or clear (`memorisation.delete`). No reminders. Signed out: sign-in prompt; flag off: "not available yet".
- **Read tonight's portion (`read_along`).** Home card on the day (Pakistan date) of a session the person registered for or follows, with a portion that has a place in the Quran (para opens at the juz start, surah at ayah 1, range at its first ayah; lessons have none). Followed venues and circles are asked for today's sessions (`occurrences.list` with `venueId`/`circleId` and the Pakistan day bounds, at most 10 follows; a failed one is left out). Reading any ayah of the portion also records `portion`. No new notification.
- i18n: 70 keys in `en.json` and `ur.json` together (Urdu draft under the file's `_meta.status` marker): `daysRead.*`, `communityToday.*`, `readAlong.*`, `memorisation.*`, `home.ayah.from*`, `profile.reading.title`, `profile.goal.*`, `profile.reviseAfter.*`, `profile.ayahPush.*`. Inserted after `home.ayah.read`, re-checked present at the end. `dynamicKeys.test.ts` covers `memorisation.status.*` and `daysRead.unit.*`.
- Tests: 883 passing in 57 files (was 731 in 48). New: `features/reading/days.test.ts`, `features/reading/sync.test.tsx`, `features/ayah/useAyahOfTheDay.test.tsx`, `features/memorisation/logic.test.ts`, `features/readAlong/portion.test.ts`, `features/profile/readingSettings.test.ts`, `screens/HomeNextFeatures.test.tsx`, `screens/MemorisationScreen.test.tsx`, `screens/ProfileReading.test.tsx`, plus a `subscribeReading` test on the real package. Failure paths: each flag off, API errors on every call, `out_of_range` from the client rule and from the server, signed out; 16-combination matrix (LTR/RTL, light/dark, four sizes) for Home with the new cards, the tracker and the Profile section. Existing Home/redesign/content ayah tests now expect the server pick (mock flag on) or pin the flag off for the old behaviour. `pnpm --filter @qc/user-app typecheck`, `test`, `pnpm --filter @qc/i18n test`, `npx eslint apps/user-app` and `npx prettier --check apps/user-app packages/i18n` pass. (`@qc/user-app` has no `lint` script; eslint was run directly.) The web export was not re-run.

Notes and questions:

- Goal "met" is the person's own tap: the reader does not measure pages or minutes, so `reader` days send no `pages`/`ayahs` and add nothing to `pagesTogether`. If the community page count should grow from reading in the app, `@qc/content` would need to report pages read (content lane).
- The mock answers every 204 endpoint itself, ignoring handlers, so the `memorisation.delete` failure test uses a forced error (`failNext`). Worth knowing for the contracts lane.
- A registered session's card disappears once its next date moves on (after it ends), because registrations come with their next date only; a followed session stays until midnight.
- Ayah push taps: wired in the follow-up above.

## Fonts and credits (2026-10-17, font bundling)

- Fonts load at start-up with `expo-font` (`src/fonts/appFonts.ts`, called from `src/app/_layout.tsx` next to `loadServices`): Figtree 400 to 800, Mehr Nastaliq Web, KFGQPC Uthmanic Script HAFS, from `@qc/ui/font-sources`. Faces use `display: swap` on the web. Loading never rejects and stops waiting after 3 s, so a missing font only means a fallback font. The web export bundles all seven files unmodified.
- New screen About and credits (`src/screens/CreditsScreen.tsx`, route `credits`, `/credits`), reached from Profile, Support, "About and credits". It lists Figtree (OFL 1.1), Mehr Nastaliq Web (Mehr Type / CSaLT, ITU Punjab, CC BY-SA 4.0, licence link), KFGQPC Uthmanic Script HAFS, the Tanzil Project (link to tanzil.net) and both Maududi translations. Strings: `credits.*` (Urdu draft). Tests across the 16-combination matrix.

## Showcase gaps closed (2026-10-17 evening)

Against "Gap list: built apps against the drawings" in `docs/design/redesign-handoff.md` (user-app rows). Only `apps/user-app/**`, `packages/i18n` (user-app keys) and this file were edited.

- Header: on scrolling pages the kit `HeroHeader` (default `fade` shape with the pattern) now scrolls away inside the page; a compact green row (title, back) appears once it has gone (`screen-compact-header`). Sheets keep a fixed `rounded` header; pages whose content scrolls by itself keep a fixed header. Night uses the kit's `heroEnd` fade (web; native keeps the solid green until the kit has a gradient view).
- Home next circle: a white raised card half on the green (`NextCircleCard`): big start time (`countdown` text), day and "in 25 minutes / 3 hours / 2 days" (`home.countdown.*`), the portion being read, the section with its picture, and two buttons: Directions (maps link) and My registration (Journey) when registered, otherwise See details.
- Home circles near you: picture cards with drawn venue art (`ui/VenueArt`, theme colours, a stable colouring per venue), the distance from the chosen area on the art, name, time and section under it. Same cards for the nearest places on the Nearby map.
- Home extras: the Updates feed and the next prayer / continue reading cards are gone from Home; a row of round shortcuts (Quran, Prayer times, Qibla, Updates with the unread count) and today's prayers in the kit `PrayerStrip`, built by a new `PrayerStrip` content mount (city chosen in the prayer view; asks for a city until then).
- Ayah of the day: a new `AyahText` content mount reads the ayah through `@qc/content`'s own source and cache (the reader's path): the Arabic in the Quran font, and the Urdu translation on an Urdu screen. English shows the Arabic and the reference (no English translation source exists). Offline with nothing cached, or the source down: the reference only. No Quran text was added to the repo; tests use placeholder words.
- Icons: the local `Glyph` and `PhotoBlock` are deleted; every icon is the kit `Icon` (tabs, bell, search, filter, profile tiles, registration summary, shortcuts). A test fails if either file comes back.
- Urdu times: `formatClockTime`, `formatLocalTime` and `formatDateTime` wrap the time run in a first-strong isolate on Urdu screens, so "9:30 PM" keeps its order inside right-to-left text; the date around it stays right to left.
- Nearby: one chip row under the search in the green header: city (opens a city sheet, kept in preferences), area, day, Women / Men / Family toggles and Filters (n). Only time, language and programme still show as removable chips under the header. Map pins are drawn green pins with the number of circles at each place (`ui/MapPin`; list-only map and phones; the web Google map labels the pin with the count).
- Session and venue: the top is the drawn place (230 dp) with a dark fade, round glass back and share buttons, and the title over a fade into the green. Share uses the system share sheet (`platform/share.ts`); where there is none a toast says so.
- Registration: Women / Men / Family cards carry a picture each (`ui/SectionIcon`); the people stepper has the people icon.
- Quran tab: one title. The app now builds the tab from `@qc/content`'s exported screens (`QuranIndexScreen`, `QuranReaderScreen`, `PrayerTimesScreen`) and its saved view, under the app header, instead of `QuranPrayerTab`, which adds a second large title.
- Updates: each card shows its kind as a picture in a tinted square (clock, cross, star, bell) and ends with "Go to session" when it has one.
- Sign-in: a line-drawn masjid in the green top (`ui/MasjidLineArt`).
- Venue art is now drawn Quran art (owner, 2026-10-17): `ui/VenueArt` draws an open mushaf on a rehal with an eight-point star medallion behind it, plain page lines and no letters, theme colours only, same props and per-venue colouring; tests in `ui/VenueArt.test.tsx` (15). The sign-in masjid is unchanged.
- i18n keys added to `en.json` and `ur.json` together (Urdu draft): `home.countdown.now`, `home.countdown.minutes/hours/days.one/other`, `home.next.myRegistration`, `home.ayah.source`, `session.share`, `session.share.message`, `session.share.unavailable`, `updates.goToSession`.
- New local pieces marked `TODO(kit)`: `VenueArt`, `MapPin`, `SectionIcon`, `Shortcut`, `MasjidLineArt` (plus the existing `GlassButton`, `PictureCard`, `MapPreviewCard`, `ChoiceCards`, `Stepper`, `SearchButton`).
- Tests: 670 passing in 42 files (was 612). New: scroll-away header and compact row, photo top with share, chip row, pin counts, next-circle card, shortcuts, prayer strip and ayah words through the real package with a made-up source answer, Urdu time isolation, kind icons, sign-in art, section pictures, and the 16-combination matrix for the photo top and venue art. Typecheck, eslint and prettier pass on the changed files.

Still open (needs data or another lane):

- Venue photos: the contracts have no photo field. Needs `photoUrl` (or an image id) on `VenueSummary` and `Venue`, upload and storage in the admin app and API, and permission from the masjid to publish the picture. Until then the drawn art stands in.
- Ayah translation in English: no English edition is fetched or licensed. Needs a chosen English translation with a licence that allows showing it in the app, added to `@qc/content`'s source.
- Urdu translation (Maududi from api.alquran.cloud) and the Arabic (Tanzil, CC BY 3.0) are shown from the online source as the reader shows them; the Tanzil credit and the Urdu translation's rights still need confirming (content lane, WP18). Home fetches the whole surah for one ayah (large for Al-Baqarah); a single-ayah call in `@qc/content` would save data.
- Quran list StarNumber, Arabic surah name styling, offline mark, and star ayah-end marks in the reader live in `@qc/content` (content lane).
- Kit pieces not built: map pins, stepper, choice cards, shortcut, picture card, gradient view for native fades.

## Owner decisions, 2026-10-17 afternoon (digest "Further decisions")

- "Ask for a circle near you" (end of the Nearby list) and "Request a circle near me" (empty Nearby list) show only when `featureFlags.circle_requests` from `config.get` is on. Flags come for the city being browsed (`preferences.cityId`, the same city Nearby lists); until `config.get` has answered once for that city (or when it fails with no saved copy) they are off. Tests: on, off, a city change both ways, and a failed `config.get`.
- Home map card: "N circles near you · nearest 1.2 km". The distance is worked out on the phone (haversine, `src/core/distance.ts`) from the same point Nearby sorts by: the chosen area's centre (`useOrigin`). Nearby uses no phone location, so there is no permission to ask; with no area or an area without coordinates the card keeps the old text. Written as metres to the nearest 10 m under 1 km, km with one decimal under 10 km, whole km from 10 km; digits through the kit's `formatNumber` (Western in both languages today). The Home calculation logs nothing and sends nothing new to the server.
- Home green header: today's Hijri date as the kit `HeroHeader` eyebrow ("8 Ramadan 1448 AH"), from `@qc/content`'s exported `hijriDate` and `todayAt` with Pakistan Standard Time (`PAKISTAN_UTC_OFFSET_MINUTES`) and `config.hijriOffsetDays` (`src/features/home/hijri.ts`). Month names reuse the `prayer.hijriMonth.*` keys. Tests with the fixed clock: offset 0, +1, -1, +2, clamping, the midnight turn in Pakistan, Urdu. `hijri.ts` imports these pure functions from `@qc/content` directly (as `platform/contentStorage.ts` does) rather than through the `ContentModules` mount points; the date is read when Home renders and does not tick over at midnight on an open screen.
- i18n keys added to `en.json` and `ur.json` together (Urdu draft): `home.map.countNearest.one/other`, `home.distance.metres`, `home.distance.km`, `home.hijri.date`.
- Tests: 612 passing in 42 files. `expo export --platform web` bundles.

## Redesign (2026-10-17)

The approved redesign (D1 to D16) is applied to `apps/user-app`. Behaviour, hooks and i18n keys are unchanged; 16 keys were added to `en.json` and `ur.json` together (Urdu is a draft).

- Tabs: Home, Nearby, Quran, Journey, with icons; the floating bar comes from the kit `TabBar`.
- Every screen sits in `ScreenFrame`, which now uses the kit `HeroHeader` (green, `hero` and `textOnHero` only) and the kit `Banner` for the offline note.
- Home (H4): next circle in the green header with the bell and avatar, search and filter buttons that open Nearby, a map card, circles near you as picture cards, ayah of the day, "Also in the app" row, then the Updates feed and the prayer and reading cards.
- Nearby (N2): search and Map / List switch in the green header (kit `SearchField`), small cards for the nearest places on the map, the list ends with "Ask for a circle near you" (coming-soon toast).
- Session and venue (S1): photo area (neutral block) in the header, kit `Tag` and `SeatMeter`, raised cards, one Register bar.
- Registration (R2): sheet look (handle, close button, session in the green top), Women / Men / Family cards (a family session offers all three, others fade), people stepper, consent card. Route presented as a modal.
- My Journey (J1): three numbers in the header (upcoming, waiting, following), registrations as kit `SessionCard`s with reminder switches in a card under each, followed masjids in a card.
- Updates as cards, Profile with quick tiles, Sign-in with the kit `CodeField`, kit `ConfirmSheet` and kit `SessionCard` everywhere a session is listed.
- Local stand-ins marked `TODO(kit)` in `src/ui/`: `Glyph`, `GlassButton`, `PictureCard`, `MapPreviewCard`, `ChoiceCards`, `Stepper`, `PhotoBlock`, `SearchButton`. Change request `2026-10-17-user-app-redesign-gaps.md`.
- Not matched to the drawn screens: circle progress on My Journey (no data), real photos (no field), Arabic text on the ayah card (not in `@qc/content`), `DateStrip` and `PrayerStrip` unused (nothing in the app needs them), registration sheet is a modal route on phones but a full page on the web.
- Tests: 577 passing in 40 files, including the green-header token check on every screen in the 16-combination matrix, a scan that screens, components and `ui/` hold no raw colours, and new tests for each redesigned layout. `expo export --platform web` bundles.

## Done

Wave 2 of `docs/agents/briefs/user-app.md`, in `apps/user-app`. Proved on the web target; native device and store builds were not attempted.

- Shell: expo-router with four tabs (Home, Nearby, My Journey, Quran & Prayer) and Profile from the avatar. Providers: typed API client with one retry after a single-flight refresh on `token_expired`, i18n en/ur with RTL, `ThemeProvider` from `@qc/ui` (light, dark, high contrast, four text sizes, reduce motion from the device), season mode from `config.get`.
- Sign in: phone, code (WhatsApp first, SMS offered after the wait), optional name. Returns the person to where they were.
- Nearby: list with filters (city, area, day, time of day, section, language), list or map toggle through a swappable `MapView` (list-only fallback, Google Maps adapter for web and phones), saved copy shown offline.
- Venue and session pages with the facilities checklist in words, coming dates, call and directions, follow.
- Registration: area picker, section, party size, WhatsApp consent checkbox (never pre-ticked), waiting list, confirmation, and `already_registered`, `session_full`, `registration_closed` (and the other API codes) in plain words in both languages.
- My Journey: registrations (confirmed and waiting), cancel with confirm, followed venues, per-session reminder opt-in (local notifications on phones, planned by a pure tested function).
- Home: your next session, next session near you by season, Updates feed with unread badge on the tab, prayer and reading cards from `@qc/content`.
- Profile: language, text size, appearance, name, push and WhatsApp switches, alerts per followed venue, sign out, account deletion (`me.delete`) with confirm that also wipes the device.
- Quran & Prayer: `@qc/content` is wired in (`QuranPrayerTab`, `NextPrayerCard`, `ContinueReadingCard`, `ContentProvider` with the signed-in client, Hijri offset from config, IndexedDB cache on the web). Without the package the tab says it is not available.
- Offline shell: service worker (`public/sw.js`: app shell and built files only, never the API, plus web push and notification taps), manifest, icons (placeholders), `public/index.html` template. `expo export --platform web` succeeds.
- i18n: about 130 keys added to `en.json` and `ur.json` together (Urdu is a draft), all through `@qc/i18n`; keys built from values are checked in both languages by a test.
- Tests (before the redesign): 507 passing in 36 files (Vitest, react-native-web in jsdom, contract mock handler, no network). Hooks: sign in and token refresh, registration flow with the error-code mapping, filters to query mapping, cache and offline, reminders planning, push. Screens in LTR and RTL, light and dark, four text sizes: Nearby, Sign in, Session, Venue, Registration, Journey, Home, Updates, Profile, Quran & Prayer mount. Service worker script run in a sandbox.
- Docs: decision `0009-user-app-stack.md`; change requests `2026-10-16-user-app-ui-kit-needs.md`, `2026-10-16-user-app-content-mount.md`, `2026-10-16-user-app-contract-notes.md`.
- Dev: `pnpm --filter @qc/user-app mock` serves the contract mock on port 4010 with CORS for local web runs.

## In progress

- Nothing.

## Blocked

- Nothing blocking. Waiting on other lanes for polish only: fonts and a pressable avatar (ui), a double header on the Quran tab (content), see the change requests.

## Questions for the orchestrator

- App id: iOS bundle id and Android package are unset in `app.config.ts`. What are they, and who owns the store accounts?
- Google Maps key: the web and phone map need a public key in `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` (the name `src/platform/env.ts` reads); until then the list-only view is shown. Who creates it, and which referrer restrictions apply?
- For the platform lane: the root `.env.example` and the deploy env docs should carry `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` (not `EXPO_PUBLIC_GOOGLE_MAPS_KEY`), next to `EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_VAPID_PUBLIC_KEY`. This lane did not edit `.env.example`. The full list is in the header comment of `apps/user-app/app.config.ts`.
- Web push needs `EXPO_PUBLIC_VAPID_PUBLIC_KEY` and the API's matching private key (messaging lane). Confirmed who generates the pair?
- Family sessions: decided by the owner: a family session accepts women, men or family. Kept.
- "Ask for a circle near you": decided by the owner, hidden unless `circle_requests` is on. Done. When the flag is on it still shows the coming-soon message (request-a-circle is a later wave).
- Reminder lead time is fixed at 60 minutes on the device. The messaging lane asks for a per-program setting; if it ships, the app should read it from `config.get`.
- Surah names for the Home reading card come from the content package; nothing needed here.
- Phone numbers assume Pakistan (+92) when typed without a country code. Other countries need the code typed.
- Demographic profile fields (age band, prior reading) are not built; they are not in this wave's list.
- Request-a-circle, session companion and the home-screen widget are later waves. The request-a-circle action shows a "coming soon" message.
- `V1ImportBanner` from `@qc/content` is not mounted; the data-migration lane should say where it belongs.

## Contract change requests

- `docs/engineering/change-requests/2026-10-16-user-app-ui-kit-needs.md`
- `docs/engineering/change-requests/2026-10-16-user-app-content-mount.md`
- `docs/engineering/change-requests/2026-10-16-user-app-contract-notes.md`

## Findings from integration

From the WP11 end-to-end run of the PWA (web export, `EXPO_PUBLIC_API_URL` = real API) (details in `tests/e2e/FINDINGS.md`): find, code sign-in, registration, Journey, the feed, the manifest, the service worker's offline shell and deep links all work against the real API.

- F-05 (medium, pending outside dependency): web push needs `EXPO_PUBLIC_VAPID_PUBLIC_KEY` and the worker's VAPID keys.
- F-04 (admin-app finding; user app aligned 2026-10-17): the phone step (`signIn.phone.intro`) now says "We will send a code on WhatsApp, or by SMS if WhatsApp is not available.", the same as the admin app. Urdu draft updated together; test in `screens/SignInScreen.test.tsx`.
- F-06 (low, fixed 2026-10-17): this file now names the maps key `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`, as `src/platform/env.ts` reads it; `app.config.ts` lists the public variables. The root `.env.example` is the platform lane's (note under Questions).
- F-10 (low, fixed 2026-10-17): the offline banner now follows the platform's connection state as well as failed calls. `core/connectivity.ts` combines two signals: the device state (`watch(source)`) and the last call. `platform/networkStatus.ts` gives the web target a source from `navigator.onLine` and the `online`/`offline` events, wired in `bootstrap.ts` through `createServices({ network })`: the banner shows at once on an offline start or when the connection drops, and clears when it returns. Native has no network-status module installed (no new dependency added), so it keeps the failed-call signal only. Tests: `core/connectivity.test.ts`, `platform/networkStatus.test.ts`, `platform/networkStatus.androidOs.test.ts`, and two in `screens/NearbyScreen.test.tsx` (banner over the saved list as soon as the device goes offline, with no API call, and gone when back online; banner on an offline start).
