# Status: user-app

Updated: 2026-10-25 (map screen)
Branch: claude/peaceful-archimedes-ain95k (orchestrator commits; nothing committed by this lane)

## Map screen: a real map with no key (2026-10-25)

- **Choice: OpenStreetMap tiles, keyless.** Nearby's Map view used to show only a list of places while there was no Google Maps key. `features/maps/TileMapView.tsx` now draws a real street map from OpenStreetMap tiles (plain images, no script, no key), with our own green pins on top. Google Maps stays the first choice: `GoogleMapView` (web) and `GoogleMapView.native` (phones) use it when `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` is set and fall back to `TileMapView` (before: the list) when it is not, or when Google's script fails. When no tile can be fetched at all (offline, blocked) `TileMapView` falls back to the list-only map, so the screen is never blank.
- **What it does.** Opens fitted to all the places and the person's area; drag to move; zoom in, zoom out and "show all places" buttons (each 48 dp, named in English and Urdu); a ring for the person's chosen area; "Use my location" on the web (browser geolocation, asked only when pressed, drawn as a dot, never sent or saved; denial gives a short note, `nearby.map.noLocation` / `nearby.location.denied`). Phones show no locate button until a location module is added (`platform/location.native.ts` says so). The credit "© OpenStreetMap contributors" is drawn on the map and opens the copyright page. Another tile host: `EXPO_PUBLIC_MAP_TILE_URL` (`{z}/{x}/{y}`, optional `{s}`) and `EXPO_PUBLIC_MAP_TILE_ATTRIBUTION`.
- **Tap a pin.** Each pin is a button named with the place, circle and area ("Masjid Noor, 2 sessions here, Gulberg, Lahore"), `aria-selected` when chosen. The card under the map now has a **Join this circle** button for each session (named with the circle's title for a screen reader) next to "Open circle details": signed-in goes to the join flow (`register` route, which the join pledge replaces), signed-out goes to sign in and back (`useRequireAuth`).
- **Right to left.** The map drawing itself stays left to right (geography does not mirror); the controls, credit and the card follow the reader's side. Checked at 390 px wide in English and Urdu in the running web app (tiles stubbed with a plain image because the sandbox cannot reach OpenStreetMap).
- **Needs a human (platform, `infra/`).** The web app's Content-Security-Policy `img-src` must allow `https://tile.openstreetmap.org`, or the browser blocks the tiles and the map falls back to the list on the deployed site. Change request: `docs/engineering/change-requests/2026-10-25-osm-map-tiles-csp.md`. Not edited here (infra is the platform lane's and needs approval).
- **Not done / questions.** OSM's public tile server is for light use; heavy traffic needs a paid or own tile host (set `EXPO_PUBLIC_MAP_TILE_URL`). No pin clustering (circles at one venue already share a pin with a count). The Join button goes to the current register screen; when the join pledge lands, point it at the pledge sheet.
- Tests: `features/maps/tiles.test.ts` (8: projection, tiles cover the view, wrap and poles, drag, fit, address template), `features/maps/TileMapView.test.tsx` (8: pins as named buttons, selection, controls in both languages, credit and its link, OSM tile addresses, Urdu right to left, the area ring, fall back to the list with no tiles), `screens/NearbyScreen.test.tsx` (+3: Join signed in, signed out, Urdu). `pnpm --filter @qc/user-app test`: 1130 passing in 73 files; typecheck, eslint and prettier clean. New keys `nearby.map.{zoomIn,zoomOut,showAll,noLocation,creditLink,join}` (English and Urdu, Urdu drafts).

## Audit fixes (25 Oct 2026): sign-in wait, map list without coordinates, V1 import banner

- **Sign-in wait in words.** The sign-in screen said "Try again in 847 seconds." It now says "Try again in about 15 minutes." (`core/wait.ts`: `waitOf` and `retryAfterText`; seconds under a minute, minutes up to 90, then hours, rounded up and "about" when not whole; nothing for a missing or unusable wait). New plural keys `signIn.wait.{seconds,minutes,aboutMinutes,hours,aboutHours}.{one,other}` (Urdu drafts). **Not changed:** `components/JoinHalqaSheet.tsx` still uses `signIn.retryAfter` (raw seconds) because the join flow is being replaced by the join pledge; whoever owns that rewrite should use `retryAfterText(t, seconds)`. The old `signIn.retryAfter.*` keys stay until then.
- **Map list without a map key.** `ListOnlyMapView` no longer prints "31.5204, 74.3587" under each place. Each place shows its area and city in the reader's language and, when the person picked an area, how far it is ("Saddar, Rawalpindi · 2.1 km"), from `markersFromSessions(..., locationOf)` and `describeLocation` (`features/nearby/markers.ts`); `MapMarker.location` is new and optional. A place whose area and city cannot be read gets no location line. The "map unavailable" note has a pin icon and friendlier words (`nearby.map.unavailable`, Urdu draft).
- **V1 bookmarks import banner.** It is mounted: `QuranIndexScreen` (`@qc/content`) draws `V1ImportBanner` at the top of the Quran tab, and `platform/contentStorage.ts` passes `readV1` on the web, so the offer appears when the browser has V1 bookmarks or a last-read place and someone is signed in. The earlier note that it was not mounted was out of date. New tests in `features/content/contentPackage.test.tsx` pin it on the app's Quran tab (offered with V1 data, Urdu and right to left, hidden with no V1 data, with only invalid entries, and while signed out).
- Tests: `core/wait.test.ts` (new), `screens/SignInScreen.test.tsx` (+5), `screens/NearbyScreen.test.tsx` (+5), `features/nearby/schedule.test.ts` (+4), `features/content/contentPackage.test.tsx` (+5). `pnpm --filter @qc/user-app test`: 1075 passing in 69 files.

## Placeholders marked "Coming soon" (2026-10-25)

Owner's decision: features drawn with no data or code behind them stay visible, faded, with a small "Coming soon" badge, take no press and are announced as turned off. Only `apps/user-app/**` and the user-app keys in `packages/i18n` were edited; booking, the seat pass, the session's main follow button and `JoinHalqaSheet` were left alone (the join-pledge work).

- **One treatment:** `src/ui/ComingSoon.tsx`. `ComingSoon` draws either a greyed button face from its label (an action not built) or faded children (content), with the badge after it; the wrapper is one accessible stop with `aria-disabled`, a role (`button`, `link` or `group`) and the name "{visible text}, coming soon" (`comingSoon.label`), so the spoken name holds the visible words. The drawing inside is `aria-hidden` with no pointer events; high contrast fades less (0.75 against 0.5). `ComingSoonBadge` is the pill on its own, for layouts that place it themselves. Works LTR and RTL (row that wraps, start/end only), at all four text sizes, light, dark and high contrast.
- **Labelled:**
  - Session page: "Join online" when the circle has no online link (`session-online`, role link). With a link it is the working link it was.
  - Session page: "Host not listed yet" when the session has no circle and so no teacher (`session-circle-soon`). A teacher's name, when the circle has one, shows as before.
  - Session and venue pages: the drawn place standing in for a photo (`session-photo-soon`, `venue-photo-soon`, "Photos of this place, coming soon"), with the badge on the header's button row (`screen-photo-soon-badge`). Done once in `ScreenFrame`, so both photo headers have it.
  - Home: the Ramadan special programme row shown when no other programme is coming (`home-special-sample`). It no longer opens Nearby; "· Sample" is gone from `home.special.sampleWhen` (the badge says it).
  - Nearby, with `circle_requests` on: "Ask for a circle" at the end of the list (`nearby-ask-action`) and "Request a circle near me" under the empty list (`nearby-request`, no longer the empty state's secondary button). Neither shows the toast any more; with the flag off both stay hidden.
- **Not labelled, and why:**
  - Reciter audio and the day/night look in the Quran reader: drawn in `packages/content` (`QuranReaderScreen`), outside this lane; both already show switched off with "coming soon" in their names. To share this badge the content lane would need it (or the kit) to offer one.
  - Livestream and GPS / "Use my location": not drawn anywhere in the user app (`nearby.location.*` keys are unused). Nothing to label.
  - Picture cards (Home "Circles near you", Nearby map "nearest") use the same drawn place, but each card is a working link to the session or place; fading it would hide a real feature. Only the large photo headers carry the badge.
- Keys (English and Urdu, Urdu drafts under the file's review marker): `comingSoon.badge`, `comingSoon.label`, `comingSoon.photo`; changed `home.special.sampleWhen`.
- Tests: `ui/ComingSoon.test.tsx` (the 16-combination matrix, content in both languages, high contrast, no press, badge placement), `screens/comingSoon.test.tsx` (each placeholder in English and Urdu: label, badge, `aria-disabled` and role, nothing happens on press; the working online link and teacher name stay as they were), `HomeScreen.test.tsx` (Ramadan row in both languages), `redesign.test.tsx` (ask action). Helper `test/comingSoon.ts`. `pnpm --filter @qc/user-app test`: 1070 passing in 70 files; typecheck, `@qc/i18n` tests, eslint and prettier clean.

## App icon from the logo (2026-10-18)

- The placeholder icons are replaced by the Quran Circles logo (the hand with the Quran, تنظیمِ اسلامی and the wordmark), generated with every inked pixel inside each platform's safe zone. Generator and the full set (iOS, Android legacy and adaptive, PWA, favicon, store icons): project files `store-assets/`.
- `app.config.ts`: `icon` is `public/icons/icon-1024.png` (opaque, App Store size); Android adaptive icon uses `public/icons/adaptive-foreground.png` on white (was emerald `#064e3b`, which clashed with the white logo). Store build configuration: needs the human approval in the ownership map.
- Manifest gains a 192 maskable icon. Web icons are palette PNGs to keep the service worker's precache small (192: 10 KB, 512: 36 KB).
- `sw.js` shell version is `qc-shell-v3` so installed copies pick up the new icons; `sw.test.ts` updated (v0 to v2 deleted, v3 kept). 27 passing.
- Not changed: `public/index.html` (the UI redesign is editing it). Its `apple-touch-icon` still points at `icon-192.png`, which now carries the logo.

## Low-end budgets, third pass (2026-10-18): one Home render, start frame, Nearby prefetch

- **Home renders once.** On a web start at Home, `app/_layout.tsx` asks `needsStartData(app, 'home')` (`boot/startQueries.ts`: config or next occurrences missing from the cache) and, only then, waits up to 0.8 s (`START_DATA_WAIT_MS`, never rejects) for the start queries before the first render, so Home draws with its data instead of a skeleton then content. With the data cached (warm start) nothing waits.
- **Start frame.** `ui/startFrame.ts`: the web root layout arms `armStartFrameDeferral()`; `useStartFrameDeferral()` holds Home's below-the-fold cards (map preview, ayah of the day, reading block, shortcuts) for one frame (rAF then a zero timeout) on that first render only. Not armed in tests or on phones, so existing tests are unchanged.
- **First tap to Nearby.** `prefetchNearbyList(app)` warms the Nearby list's first page with exactly the query Nearby will make (city, saved area origin); skipped when fresh (30 s) or when an area is chosen but its areas are not cached. The tabs layout schedules it with the route chunk prefetch 1.5 s after the tabs appear (web only, cancelled on unmount).
- Tests: `ui/startFrame.test.tsx` (3), `boot/startQueries.test.ts` (+6: `needsStartData`, `prefetchNearbyList`), `screens/HomeScreen.test.tsx` (+1: web start shows the below-fold cards a frame later). `pnpm --filter @qc/user-app test`: 1032 passing in 68 files.
- Results (low-end emulation, Slow 4G, medians of 3; full table in `docs/quality/low-end-budgets.md`, "After the third pass"): first tap to Nearby 1.48 s to **0.83 s**; Home content 6.91 s to 6.73 s (**still over 6 s**); warm start 3.42 s to 3.18 s (**still over 3 s**); Home interactive 7.60 s to 7.83 s (within budget and within noise, closer to 8 s). The run also drops Playwright request routing (integration), so part of the gain may be the harness.

## Low-end budgets, second pass (2026-10-18): i18n per language, content subpaths, zod, Home renders

Lanes touched: user-app, admin-app, `packages/i18n`, `packages/content` (see `i18n.md`, `content.md`, `admin-app.md`).

- **Words: one language, this app's words only.** On the web, Metro sends `@qc/i18n` to `@qc/i18n/client` (`metro.redirects.cjs`), a live catalogue that starts empty. `src/i18n/languages.web.ts` downloads `@qc/i18n/tables/user-app/<lang>` (shared and user-app parts, about 9.6 KB gzip for English, 12 KB for Urdu) as its own chunk. `src/boot/earlyLanguage.web.ts` starts the page language's download as soon as the bundle starts running (it first imports `expo`, which installs the chunk loader; without it the download threw "Requiring unknown module"). The root layout waits for it next to the first font. Phones and tests keep every language in the bundle (`languages.ts`).
- **Switching.** `useShownLocale` keeps the screens in the old language until the new one's words are in, so nothing shows half-translated or as keys. Profile prefetches the other language when it opens; the tabs fetch it quietly 20 s after they appear, at idle (`usePrefetchOtherLanguage`), so the service worker has both files and an offline switch works. A switch whose download fails shows the offline toast (`ui.offlineBody`) and leaves the choice as it was. A loader that throws before it starts counts as a failed download and is retried next time.
- **Content subpaths.** Imports moved to `@qc/content/home`, `/prayer`, `/meta` and `/storage`; the Quran and Prayer tab (`features/content/quranPrayerTab.tsx`) is now a lazy chunk with a skeleton (`tab-loading`).
- **zod.** On the web only, zod's JSON-schema modules (`to-json-schema`, `json-schema-*`, `compile`, `from-json-schema`) are swapped for `src/platform/zod-left-out.js`, whose functions throw if ever called. Parsing and validation code is untouched; `metroRedirects.test.ts` checks the stub's exports against zod's own and that parsing still works.
- **Home renders.** `useAuthStatus()` (selects `status` only) replaces `useAuthState()` in 16 places, so token refreshes no longer re-render Home and the tabs. `useCacheEntry` subscribes per key. AyahOfTheDay, ReadAlong, DaysRead and CommunityToday cards and the prayer strip are memoised; the bell and the shortcuts are their own memoised components. Home interactive is now within budget.
- Tests: `i18n/languages.test.tsx` (13: loader once, retry after failure, a throwing loader, prefetch, web catalogue gets only this app's words one language at a time, `useShownLocale`, the delayed prefetch), `metroRedirects.test.ts` (catalogue and zod redirects), `dynamicKeys.test.ts` reads the app's own parts. `pnpm --filter @qc/user-app test`: 1022 passing in 67 files.

### Results (same command, low-end emulation, Slow 4G, medians of 3)

| Measure                             | Budget  | Before (two runs) | After A | After B |
| ----------------------------------- | ------- | ----------------- | ------- | ------- |
| First-screen JS (gzip, script tags) | 450 KiB | 524 KiB (1)       | 445 KiB | 445 KiB |
| Home content                        | 6 s     | 7.01 / 7.35 s     | 6.83 s  | 6.87 s  |
| Home interactive                    | 8 s     | 8.86 / 8.24 s     | 7.40 s  | 7.60 s  |
| Transfer before interactive         | 900 KiB | 620 / 618 KiB     | 549 KiB | 549 KiB |
| First tap to Nearby                 | 1.5 s   | 1.37 / 1.52 s     | 1.46 s  | 1.50 s  |
| Warm start content                  | 3 s     | 2.90 / 3.01 s     | 2.99 s  | 3.14 s  |
| Admin Today content                 | 6 s     | 7.31 / 7.55 s     | 7.30 s  | 6.97 s  |
| Admin first-screen JS (gzip)        | 450 KiB | 476 KiB (1)       | 406 KiB | 406 KiB |

(1) As measured in the first pass. The same measurement on this morning's tree, before this pass, was 545 KiB (user) and 510 KiB (admin): other lanes' work had grown both since. First paint stays at 0.77 s, scroll, map and the Quran reader stay within budget. Warm start and first tap stay on the line (±0.15 s between runs).

### Still over budget, and exactly why

Measured with an in-page CPU profile and resource timings on the same harness (a probe spec in my scratch folder, not committed).

- **Home content, 6.85 s (0.85 s over).** The main bundle arrives at 3.7 s (450 KB gzip on Slow 4G). Running it takes 1.28 s (to 5.0 s): about 25 % is zod building the contract schemas at import (`@qc/contracts`, about 250 ms), about 25 % is the module loader compiling code, the rest expo-router and react-native-web. The start requests and the language file then take one round trip (to 5.7 s). The first render takes 0.70 s and shows the skeleton because the next sessions arrive 40 ms after it starts; the second render, with the data, takes 0.37 s, so content shows at 6.9 s. Most of the render time is React reconciling react-native-web's element tree (0.77 s of 1.3 s), not app code.
- **Admin Today content, 6.97 to 7.30 s (1.0 to 1.3 s over).** Bundle at 3.5 s; it runs until 4.7 s; `me` (asked early) can only finish after that, at 5.3 s; first render 0.62 s; only then does Today ask `admin/sessions` (it needs the working scope from `me`), another round trip, so Today shows at 6.8 to 7.3 s.
- **Test-harness effect.** `localOnly` (tests/e2e/src/support/browser.ts) and the Quran stub use Playwright request routing, which intercepts every request. Under it, a request made while the main thread is busy completes only after the busy stretch ends: the language file and the admin `me`, both asked at about 3.6 to 3.8 s, get their first byte exactly when the bundle finishes running. Without routing (same probe, 3 runs each) Home content is 0.2 to 0.3 s and Today 0.1 to 0.25 s sooner. Real phones have no such interception. Fix for the integration lane: block outside hosts with Chromium's `--host-resolver-rules` instead of a route, so nothing is intercepted.

### What would close the rest

- **Contracts lane:** build the zod schemas lazily (or per endpoint) so importing `@qc/contracts` does not construct all of them. About 0.25 s of bundle run time at start in both apps.
- **Admin app (mine, next step):** start `admin/sessions` as soon as the early `me` answer is in (the working scope comes from `me` and the saved scope), instead of after the first render. In the probe that saves about 0.55 s.
- **User app (mine, next step):** draw Home's first frame only once the start queries have answered or failed (capped, about 0.8 s), so there is one render instead of a skeleton and then the content (about 0.3 s); and mount the cards below the fold a frame later (needs a check that the screen tests still pass unchanged).
- Even with all three, Home content is close to 6 s, not clearly under it. The rest is the size of expo-router, react-native-web and React themselves.

## Low-end cold start (2026-10-18, `tests/e2e/src/quality/budgets.ts`)

Only `apps/user-app/**` outside screen components, plus the ui lane's font files (ui status).

- **Start screen in `public/index.html`.** The browser draws the app's name ("Quran Circles", the same in both languages, so it has no direction to get wrong) and a spinner on the header green before any script arrives, in light, dark (the media query or the saved choice) and high contrast, at all four text sizes, and slower under reduced motion. `src/boot/startScreen.ts` takes it away once the root layout is ready (saved choices, sign-in and the first font), so nothing is ever seen in the wrong language or direction underneath it. FCP goes from 9.7 s to 0.8 s.
- **`public/boot.js`** (external: the production policy allows no inline script) reads `qc.preferences.v1` before the app's scripts and sets `<html lang dir>`, `data-qc-color` and `data-qc-text-size`, and the start screen's label (`ui.loading`). Urdu comes from the saved choice, or from a device in Urdu when nothing is chosen (as `defaultPreferences` does). For Urdu it preloads Mehr; `index.html` preloads Figtree 400. It never throws. The service worker serves `/boot.js` network-first with the cached copy offline (`public/sw.js`, version unchanged); tests in `platform/sw.test.ts`.
- **Fonts.** The web no longer downloads every TTF and OTF (310 KB) before the first frame. `src/fonts/loadFonts.web.ts` declares the `@qc/ui/web-fonts` faces (WOFF2, `font-display: swap`) and waits only for the language's face; the first screen's other Figtree weights are preloaded once Home's data has been asked for (`startFonts`). The Quran font loads only with Quran text. iOS and Android keep `loadFonts.ts` (all bundled fonts, as before).
- **Bundle.** `src/entry.ts` (package `main`) puts the root layout, the tabs layout and Home in the main bundle instead of three chunks fetched one after another. `metro.config.cjs` + `metro.redirects.cjs`: zod's all-locales barrel (about 40 KB gzip, never used) and, on the web only, `expo-notifications` are swapped for an empty module; the minifier writes Urdu as UTF-8, not `\uXXXX`.
- **Start requests.** `src/boot/startQueries.ts`: once the saved choices are read, the config (every start) and, on a start at Home, the next sessions, your registrations and your follows are asked for while the page is still drawing; Home's own queries join them through the new `QueryCache.share` (one request per key in flight, so start-up no longer sends config 8 times and registrations and follows 4 times each). Keys and requests match the hooks'; the test renders Home after the prefetch and checks nothing is asked twice. `src/app/_layout.tsx` reads the saved state once (`loadOnce`).
- **Nearby.** Its code is fetched 1.5 s after the tabs appear (`prefetchTabLater`), so the first tap does not wait for the download.
- Tests (new): `boot/bootPage.test.ts` (19: boot.js run in a sandbox for en, ur, device Urdu, colours, sizes, damaged values; preload URLs equal the bundler's content-hash names; strings equal `app.name` and `ui.loading`; no inline script), `boot/startQueries.test.ts` (6), `boot/routeChunks.test.ts` (4), `boot/startScreen.test.ts` (2), `fonts/loadFonts.web.test.ts` (4), `platform/metroRedirects.test.ts` (3), 7 more in `data/cache.test.ts`, 3 more in `platform/sw.test.ts`. `pnpm --filter @qc/user-app test` 994 passing in 66 files; typecheck clean; eslint and prettier clean on every changed file.

### Results

Measured with `QC_QUALITY=1 QC_QUALITY_RUNS=3 pnpm --filter @qc/e2e exec playwright test --project=quality low-end-budgets` (low-end emulation, Slow 4G, medians of 3). Before is the tree at the start of this pass. After is two full runs on separate fresh stacks (A, B); the machine was shared with other agents' runs, so expect about ±0.3 s.

| Measure                             | Budget  | Before  | After A | After B |
| ----------------------------------- | ------- | ------- | ------- | ------- |
| First paint (FCP)                   | 3 s     | 9.65 s  | 0.78 s  | 0.79 s  |
| Home content                        | 6 s     | 11.63 s | 7.01 s  | 7.35 s  |
| Home interactive                    | 8 s     | 12.17 s | 8.86 s  | 8.24 s  |
| Transfer before interactive         | 900 KiB | 923 KiB | 620 KiB | 618 KiB |
| First-screen JS (gzip, script tags) | 450 KiB | 545 KiB | 524 KiB | 524 KiB |
| First tap to Nearby                 | 1.5 s   | 1.97 s  | 1.37 s  | 1.52 s  |
| Admin Today content                 | 6 s     | 11.79 s | 7.31 s  | 7.55 s  |
| Admin first paint                   | 3 s     | 9.70 s  | 0.78 s  | 0.78 s  |
| Admin first-screen JS (gzip)        | 450 KiB | 510 KiB | 476 KiB | 477 KiB |
| Warm start content                  | 3 s     | 3.23 s  | 2.90 s  | 3.01 s  |

Scroll (0.3 to 1.3 % dropped), map (0.3 to 0.4 s) and the Quran reader (2.4 s first, 0.5 to 0.8 s again) stay within budget. Fonts at start: 310 KB before, 67 KB after.

### Still over budget, and why

- **Home content (7.0 to 7.4 s, budget 6 s) and first-screen JS (524 KiB, budget 450 KiB).** The main bundle (about 530 KB gzip) takes until about 4.2 s to arrive on Slow 4G and about 1.1 s to run on the emulated CPU, so the first screen cannot draw before about 5.7 s. The rest is one API round trip (0.6 s) and the render. Getting under 6 s needs about 100 KB less JS. The largest parts are expo-router, react-native-web and react-dom (about 60 % together, not removable), zod (about 56 KB gzip), `@qc/i18n` (both languages and every app's strings, about 36 KB gzip for Urdu alone) and `@qc/content` (about 30 KB gzip, imported whole). Moving Home into the main bundle added about 17 KB to the "script tags" number, but it is code the first screen needed anyway; it removed two round trips.
- **Home interactive (8.2 to 8.9 s, budget 8 s).** After content, a run of responses each re-render Home (150 to 400 ms each on the emulated CPU): places, `me`, unread count, reading position, bookmarks, community today, reading days, ayah of the day and its text (which waits on config and follows). Fewer, cheaper re-renders mean changes inside screens and providers, which this pass did not touch.
- **First tap to Nearby (1.37 / 1.52 s) and warm start (2.90 / 3.01 s)** are on the line: within budget in one run, just over in the other.

### Change requests (not made here; both done in the second pass above)

- **i18n per language** (`packages/i18n`): export each language's table on its own (`@qc/i18n/en`, `@qc/i18n/ur`) and load only the saved language at start, the other on switch. Ideally also split by app (user app, admin, console). Saves about 36 KB gzip at start.
- **`@qc/content` subpath exports**: Home pulls the whole package (surah list, Quran mounts, import banner). Subpaths such as `@qc/content/surahs` would keep the rest out of the main bundle. About 30 KB gzip.
- Both would bring first-screen JS close to the 450 KiB budget and Home content close to 6 s.

## Accessibility fix pass (2026-10-18, `docs/quality/accessibility-rtl.md`)

- **A-02 (serious, `aria-prohibited-attr`).** The facilities rows (`components/FacilitiesChecklist.tsx`) and the stat tiles on My Journey and Memorisation no longer put `aria-label` on a role-less `div`; the visible number and caption are no longer `decorative`, so a screen reader reads them as text. Tests: `VenueScreen`, `JourneyScreen`, `MemorisationScreen`.
- **A-08 (landmarks).** `ScreenFrame` is the `main` landmark (`<main>` on the web); a sheet frame is a modal `dialog` named by its title instead. The kit `TabBar` adds the `navigation` landmark. Test: `ScreenFrame.test.tsx`.
- **A-10.** Home's big time is split into the figures and the day period (`features/home/clock.ts`, `splitClock`), laid out as one row (`NextCircleCard.tsx`), so "PM" can no longer wrap under the figures; the bell badge sits clear of the bell (`ui/GlassButton.tsx`). Tests: `clock.test.ts` (7), `HomeScreen.test.tsx` (en and ur), `ui.test.tsx`.
- **A-07 (forced colours).** The Home filter button has a transparent border, which forced colours paint, so it stays visible; `ui/SectionIcon.tsx` draws its glyph in the system text colour while forced colours are on (kit `useForcedColors`). Test: `ui.test.tsx`.
- **A-09** is not fixed here: the Latin "PM" comes from `Intl` in `core/format.ts`. Change request in `docs/agents/status/i18n.md`.
- Not touched in that pass: `_layout.tsx`, `public/index.html`, routes (changed since in the low-end pass above).

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

- Low-end budgets (second pass above): Home content and Admin Today are still over 6 s. Should I take the two next steps listed there (start `admin/sessions` from the early `me`; one first render with data on Home)? They need the contracts lane's lazy schemas as well to get close to 6 s.
- For the integration lane: the quality harness's request routing (`localOnly`, the Quran stub) delays every request made while the page's main thread is busy (see "Test-harness effect" above). Blocking outside hosts with `--host-resolver-rules` would measure what a phone sees.
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
- `V1ImportBanner` from `@qc/content` is mounted on the Quran tab through `QuranIndexScreen` (checked 25 Oct 2026; see above).

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

## Test pass and fixes (2026-10-25)

Full local run (Postgres, API, worker, PWA, admin app, console) in English and Urdu at phone width. All unit tests pass. The e2e run passes 23 of 24 flows.

Fixed after the 20 Oct "Halqa discovery, join sheet, habit tracking" commit:

- Lint (12 errors) and Prettier (4 files): unused state, imports and variables in `JoinHalqaSheet.tsx`, `SessionScreen.test.tsx` and the console showcase artboards.
- Text: the profile alerts switch showed a raw `{venue}` (argument was `name`); "WhatsApp & SMS Reminders" and "WhatsApp / SMS Alerts" were hard-coded English (new keys `session.reminders.title`, `venue.followBadge`, with Urdu drafts); the follow sheet showed the Hijri moon-sighting note and then said "No updates yet. Follow a venue" after following (new key `venue.followDone`).
- Journey showed a "Days read" heading with an endless skeleton when `reading_days` is off; it now follows the feature flag, with a test.
- The Prayer view on the Quran tab asked "Choose your city" although Home had a city; it now falls back to the app's city, with a test.
- `tests/e2e` console flow: the invite button is now "Send Scoped Invite".

Open, for the orchestrator:

- **Seat booking is unreachable (high).** The session screen's primary button now follows the venue; nothing opens `register/[sessionId]`, so people cannot reserve a seat. `tests/e2e/src/flows/pwa/attendee.spec.ts` ("register for a session") fails for this reason. Decide whether registration returns or the e2e flow and `registerState` are retired.
- Map shows a list of places without `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`; the Quran text needs api.alquran.cloud; reader audio ("Recitation coming soon") is not built; "Host not listed yet" and "Join online" are stand-ins (now marked "Coming soon", 2026-10-25).

## Join pledge replaces seat booking (2026-10-25)

Owner decision: no seat booking. Registering is a pledge to join, followed by a confirmation, reminders and change or cancellation notices (`docs/product/decisions.md`, Registration). This closes the open "Seat booking is unreachable (high)" item above.

- Session screen: the main button is Join (`session.join`) and opens `register/[sessionId]`; a guest goes through sign-in and comes back to the form. Once joined it reads "You are joining" (`session.joined`) and opens My Journey. A session that takes no registrations keeps Follow (with the join sheet for guests). `registerState` no longer has a waiting-list state. The reminders card under the venue now says what joining brings (`session.reminders.body`) instead of the empty-feed line.
- Join form (`RegistrationScreen`): heading "Join this circle", no party-size stepper (the request sends `partySize: 1`), no waiting-list heading or intro, submit "Confirm I will join" (`registration.pledge`). The WhatsApp checkbox now names the confirmation and reminders. The confirmation screen drops the party line and the waiting-list number.
- Journey: no seat pass (QR tile and pass reference removed), no party count or waiting-list number; status reads Joining or Waiting for confirmation. Session and Nearby cards show no seat meter or "full" tag; the Nearby card's badge says Join (or Follow for walk-in sessions).
- Copy (English and Urdu drafts together): seat, reserve, waiting-list and party-size keys removed; the rest reworded (`journey.*`, `registration.*`, `profile.push.description`, `notifications.waitlistPromoted.title`, `errors.already_registered`).
- Notices: no server change needed. The API already queues the WhatsApp confirmation when the box is ticked, the worker sends push reminders to confirmed registrants with a device, and time changes and cancellations go to registrants (`apps/api/src/modules/updates/publish.ts`). The on-device reminder switch on the confirmation screen stays opt-in, because the browser asks for permission on a tap.
- Tests: `SessionScreen.test.tsx` (Join opens the form, guest goes to sign-in with a way back, "You are joining" opens Journey, no seat words even with an old limit, Follow for walk-in sessions), `RegistrationScreen.test.tsx`, `redesign.test.tsx` (no stepper, sends 1), `JourneyScreen.test.tsx`, `registerState.test.ts`. `tests/e2e/src/flows/pwa/attendee.spec.ts` now checks the Join label, no stepper, and "You are joining" after. The e2e api, pwa, console and admin-app projects pass against a local stack (25 of 25).

Open, for the orchestrator:

- `packages/contracts/src/messages.ts` `waitlist_promoted` body still starts "A seat opened up". It mirrors the approved WhatsApp template `qc_waitlist_promoted`, so it changes only with a new template approval. It fires only for a session left with an old seat limit.
- The kit's `SeatMeter` and its `ui.seats*` strings are now used by no app (ui lane to keep or retire). The design showcase artboards still draw seat passes and seat meters.

## Session screens improved (2026-10-25)

Direction: improve what exists, keep today's layouts (look-and-feel board, "Quran Circles look and feel"). Checked in the running web app at 390 px in English and Urdu, and at the largest text size in Urdu.

- Session page: Join is the green action (`variant="emerald"`), Directions is short ("Directions", `journey.directions`) so it no longer wraps to two lines. The hero shows who the session is for only; the schedule and length are in the timing card right under it (they were said twice). The timing card puts the date on its own line with the length and schedule tag below, so nothing clips at the largest Urdu size. "Join online" is its own row instead of squeezing into the host row. Once joined, the card under the venue says "You are joining this circle" with a check and what happens next (`registration.success.*`); before that it says what joining brings.
- Join form and confirmation: the submit and "See it in My Journey" buttons are green.
- My Journey: each registration shows its status as a tag with words (Joining, Waiting for confirmation, Cancelled), and a cancelled session gets no reminder switch.
- Tests: `SessionScreen.test.tsx` (before and after joining), `JourneyScreen.test.tsx` (status tag).

Open: "Host not listed yet" and "Join online" still read "Coming soon" (owner's earlier choice). The sample sessions all share one clip-art photo; the look-and-feel board proposes a calm pattern instead (not built here).

## Member redesign: maps, session and venue pages (2026-10-26, branch lane/ui/member-redesign)

- Done: map-unavailable/offline list fallback, full-screen map (close, search, filter chips, locate, bottom card with Join/Details), session page on the white frame (today's portion, about this circle), venue page with a map card above the Maps/Call/Follow row that opens the full map.
- "Coming soon" rows are hidden until there is real data: the session host row (no teacher) and "Join online" (no link) are left out; the photo placeholders on session and venue are gone. `comingSoon.test.tsx` now checks they are absent.
- New en and ur keys: `venue.mapsShort`, `venue.alerts`, `session.todaysPortion`, `session.about` (Urdu are drafts).
- Checks on this branch: user-app typecheck, eslint on changed screens, and all 75 user-app test files pass; i18n tests pass.
- Not touched (other threads): Quran, Prayer, My Journey, profile and states.

## Member redesign: visual check and integration (2026-10-26, branch lane/ui/member-redesign)

- Visual check in the web build (mock API), 375 px wide: Welcome, Features, Sign up, Sign in, Home, Nearby, full map, session, venue in Urdu RTL; venue and Home in night; Home, Nearby and venue at the largest text size in English. One bug found and fixed: on the full map the zoom buttons sat under the search bar and chips (`controlsInset` on the map view). Not looked at in the browser: the code step, the join pledge sheet and the map-off/offline states (covered by tests only).
- Merged `lane/ui/member-journey` (clean, no conflicts). `lane/ui/member-quran` has no commits beyond this branch yet, so nothing to merge.
- Nearby now draws `NoCirclesState` (empty list, no filters; "Widen the area" opens the area picker; "Ask for a circle" stays out until requests are built), `OfflineState` (network error) and `LoadErrorState` (other errors). Filtered empty lists keep the old empty state.
- Home: `NextCircleCard` takes `offline`; offline it shows "Saved on your phone" and a disabled "Joining needs internet" button. Keys `home.next.saved`, `home.next.joinOffline` (Urdu drafts).
- The 3 Registration (R2) tests already pass against the join pledge after the merge; no change needed.
- Checks: user-app typecheck, eslint on `apps/user-app/src`, 77 test files / 1186 tests, i18n 40 tests all pass.
