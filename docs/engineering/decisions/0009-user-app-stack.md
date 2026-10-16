# 0009: User app stack (Expo SDK 58, router, services, storage, tests)

Status: accepted
Date: 2026-10-16
Lane: user-app

## Context

The user app (`apps/user-app`) is one Expo (React Native) codebase for iOS, Android and an installable web app (PWA). It has to work offline in a basic way, in English and Urdu (both directions), at four text sizes, and its logic has to be proved on the web target with tests, because native builds cannot run here.

## Options

Navigation: (1) expo-router (file based, web URLs for free), (2) React Navigation by hand.
State and data: (1) a small query cache of our own over the typed client, (2) a data library (TanStack Query) plus a store.
Where tokens live on the web: (1) local storage, (2) in-memory only, (3) cookies set by the API.
Offline copy: (1) keep public data only, (2) keep everything the screens showed.
Tests: (1) Vitest with react-native-web in jsdom, as decision 0003 chose for the kit, (2) Jest with the React Native preset.

## Decision

- Expo SDK 58 with expo-router. Web output is `single` (a single-page app) so the build needs no server rendering; `public/index.html` is the page template, because `+html.tsx` is ignored in that mode. Versions are pinned.
- Screens never import the router. They use a `Route` value and a `Navigator` (`src/nav`), and the root layout builds the real navigator from expo-router. Tests pass a recorder. Changing the router touches one file.
- Everything the app needs from outside React (API client, auth session, cache, preferences, reminders, push, content modules, map view, link opener, clock) is an `AppServices` object injected at the root. Tests build the same object with in-memory parts and the contract mock handler (`createMockHandler`), so screens are rendered with no network and no mocking of modules.
- Data: a small `QueryCache` with `useQuery`, `usePagedQuery` and `useAction` hooks. Framework-free classes (auth session, preferences, cache, reminders, push) are read with `useSyncExternalStore`. Refresh of an expired access token is single-flight and retried once in one wrapper around the typed client.
- Offline privacy: public data (sessions, venues, places, config, pages) is saved on the device and shown with a "saved copy" note when the server cannot be reached. Personal data (`me:*`: registrations, follows, consents, updates) lives in memory only and is wiped on sign out and on account deletion.
- Tokens: Keychain/Keystore (`expo-secure-store`) on phones. The web has no secure store, so tokens go in local storage for the app's own origin. This is the common choice for a web app; the refresh token rotates on every use and reuse signs the device out (decision 0002), which limits what a stolen copy is worth. Revisit if the API gains cookie sessions.
- Reminders are local notifications scheduled on the phone, opt-in per session, planned by a pure function (60 minutes before, at most 50 scheduled, 14 days ahead). The web build does not schedule local reminders (browsers cannot do it reliably); it offers web push for alerts instead, and says plainly which is available.
- Maps: the app depends on a `MapView` interface. A list-only fallback is always available; `GoogleMapView` (Maps JavaScript API on the web, `react-native-maps` on phones) is the adapter. The key is a public build variable.
- Quran and prayer: `@qc/content` is mounted through `ContentModules` (`src/features/content`), never imported by screens.
- Tests: Vitest, react-native-web in jsdom (decision 0003). Hooks are tested through the real providers; screens are rendered in the 16 combinations of locale (en, ur) x colour (light, dark) x text size (0 to 3) where layout could change.

## Consequences

- Screens and hooks are tested without a device. What tests cannot show (native notifications, secure store, react-native-maps, store builds) is isolated in `src/platform` and `features/maps`, each a thin adapter over a tested interface.
- The app has a small amount of its own data code instead of a library; the cost is maintaining it. The surface is about 300 lines and fully tested.
- Web tokens in local storage is a known trade-off, written down here.
- Fonts (DM Sans, Gulzar, AlMushaf) are named by the kit but not bundled yet; see the change request to the ui lane.
