# Status: user-app

Updated: 2026-10-16
Branch: claude/peaceful-archimedes-ain95k (orchestrator commits; nothing committed by this lane)

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
- Tests: 507 passing in 36 files (Vitest, react-native-web in jsdom, contract mock handler, no network). Hooks: sign in and token refresh, registration flow with the error-code mapping, filters to query mapping, cache and offline, reminders planning, push. Screens in LTR and RTL, light and dark, four text sizes: Nearby, Sign in, Session, Venue, Registration, Journey, Home, Updates, Profile, Quran & Prayer mount. Service worker script run in a sandbox.
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
- Family sessions: the app lets the person pick women, men or family. Is that wanted? (Contract-notes request.)
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
