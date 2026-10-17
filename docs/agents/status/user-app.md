# Status: user-app

Updated: 2026-10-17
Branch: claude/peaceful-archimedes-ain95k (orchestrator commits; nothing committed by this lane)

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
- Not matched to the drawn screens: circle progress on My Journey (no data), real photos (no field), Arabic text on the ayah card (not in `@qc/content`), Hijri date in the Home header, distance on the map card, `DateStrip` and `PrayerStrip` unused (nothing in the app needs them), registration sheet is a modal route on phones but a full page on the web.
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
- Google Maps key: the web and phone map need a public key in `EXPO_PUBLIC_GOOGLE_MAPS_KEY`; until then the list-only view is shown. Who creates it, and which referrer restrictions apply?
- Web push needs `EXPO_PUBLIC_VAPID_PUBLIC_KEY` and the API's matching private key (messaging lane). Confirmed who generates the pair?
- Family sessions: decided by the owner: a family session accepts women, men or family. Kept.
- Should "Ask for a circle near you" at the end of the Nearby list show when the `circle_requests` flag is off? It shows always, with the coming-soon message.
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
