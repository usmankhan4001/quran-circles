# Low-end performance budgets (deliverable 4)

Quality lane, WP12. Measured on 2026-10-18 in an emulated low-end Android phone against the local stack. All numbers are **provisional**: there is no reference phone or staging yet. The budgets below are proposals for the orchestrator to accept or change. They become binding only after the real-device checks at the end of this page.

## How it was run

```sh
pnpm install
QC_QUALITY=1 pnpm --filter @qc/e2e exec playwright test --project=quality low-end-budgets
```

The `quality` Playwright project is opt-in. It exists only when `QC_QUALITY=1` is set, so the default e2e run never includes it. A full run takes about 12 minutes. Two variables change it:

- `QC_QUALITY_RUNS=<n>` sets the number of runs per scenario. The default is 5; the 3G cold start always runs 3 times.
- `QC_QUALITY_STRICT=1` makes a budget miss fail the run. By default misses are only reported.

Results go to `tests/e2e/node_modules/.cache/qc-e2e/quality/` (`budgets/<scenario>.json`, merged into `budgets.json`). The code is in `tests/e2e/src/quality/`: `low-end-budgets.spec.ts`, `budgets.ts` (the numbers on this page), `lowend.ts`, `perf.ts`, `prod-like-web.ts` and `quran-stub.ts`.

### Device and network

There is no reference phone, so Chromium (Playwright 1.56.1, headless) stands in for one:

| Setting      | Value                                                                                                       |
| ------------ | ----------------------------------------------------------------------------------------------------------- |
| Screen       | 360 × 800 CSS px, device pixel ratio 2, touch, Android Chrome user agent                                    |
| CPU          | 6× slowdown (`Emulation.setCPUThrottlingRate`)                                                              |
| Network      | Slow 4G: 562.5 ms round trip, 1.44 Mbit/s down, 0.69 Mbit/s up. The 3G scenario: 2 s round trip, 0.4 Mbit/s |
| Locale, zone | en-GB, Asia/Karachi                                                                                         |

### Production-like serving

The stack's own web servers are development servers, so the run exports both Expo apps itself (`expo export --platform web`) with the API on the same origin. A small server then sends them the way `infra/caddy/Caddyfile` would:

- gzip on every text response
- immutable cache headers on `/_expo/static` and `/assets`
- single-page fallback to `index.html`
- `/api` proxied to the stack's API, so there is no cross-origin preflight

Caddy also offers zstd. The run used gzip only, so transfer sizes and download times are slightly pessimistic for browsers that accept zstd.

### Data

All data is the synthetic seed plus 100 extra sessions ("Quality circle NNN (synthetic)") for the scroll test, signed in with fresh synthetic accounts. The Quran text API (`api.alquran.cloud`) is stubbed with placeholder text of the real length per surah, delivered at the emulated network speed. Google Maps cannot load without a key and the internet, so the map test measures the web's list-only fallback.

### Runs

Each timed scenario ran 5 times in a fresh browser context (nothing cached, except in the warm-start test). The median and the worst run are reported. The cold-start and bundle scenarios ran on two separate stacks (01:09 and 01:26 UTC), and their medians agree within 3%. The second run was cut short by a container restart, so warm start, coordinator start, scroll, map and reader come from the first run only. Other agents were running load tests and unit tests on the same machine during both runs, so the worst runs include some noise.

## Proposed budgets and results

The ✗ marks the budgets the current build misses.

| Area                 | Measure                                                     | Budget  | Median  | Worst   | Status |
| -------------------- | ----------------------------------------------------------- | ------- | ------- | ------- | ------ |
| App start, cold      | First contentful paint                                      | 3.0 s   | 9.2 s   | 9.7 s   | ✗      |
| App start, cold      | Home shows real content (next session or list)              | 6.0 s   | 11.1 s  | 11.9 s  | ✗      |
| App start, cold      | Home interactive (content, then no long task for 5 s)       | 8.0 s   | 11.7 s  | 12.2 s  | ✗      |
| App start, cold      | Bytes over the air until interactive                        | 900 KiB | 922 KiB | 922 KiB | ✗      |
| App start, cold      | First tap on Nearby after start, until the list shows       | 1.5 s   | 1.9 s   | 2.2 s   | ✗      |
| App start, warm      | Home content (installed: service worker and cache in place) | 3.0 s   | 2.1 s   | 2.6 s   | ✓      |
| Coordinator start    | Admin app cold start, Today with its actions                | 6.0 s   | 11.6 s  | 11.7 s  | ✗      |
| Nearby scroll        | Dropped frames at 60 Hz, 100 rows, fling down and back      | 10%     | 0%      | 1.6%    | ✓      |
| Nearby scroll        | Longest main-thread task while scrolling                    | 100 ms  | 0 ms    | 0 ms    | ✓      |
| Map                  | Tap "Map" until the map (web fallback) shows                | 1.5 s   | 0.32 s  | 0.62 s  | ✓      |
| Quran reader         | Tap Al-Baqarah until its first verse shows, first time      | 3.0 s   | 2.3 s   | 2.5 s   | ✓      |
| Quran reader         | Same surah again, from the saved copy                       | 1.0 s   | 0.47 s  | 0.68 s  | ✓      |
| Quran reader         | Total blocking time while the surah renders                 | 1.0 s   | 0.22 s  | 0.33 s  | ✓      |
| JS bundle, user app  | JavaScript the first screen needs, gzip                     | 450 KiB | 544 KiB | 544 KiB | ✗      |
| JS bundle, admin app | JavaScript the first screen needs, gzip                     | 450 KiB | 509 KiB | 509 KiB | ✗      |

For the cold start and the bundle, the median is from the second stack and the worst is across both stacks (10 runs). The first stack's medians were FCP 9.5 s, Home content 11.3 s, interactive 12.1 s and first tap to Nearby 2.1 s.

### Why these budgets

- **Start.** A first paint within 3 s and real content within 6 s on Slow 4G is the usual target for a usable mobile web app. On a 2 GB Android phone, 8 s to interactive is the most people will wait on a first visit. These budgets apply to the first visit only. Daily use starts warm, and the warm budget (3 s) is the one most users feel.
- **Scroll.** 10% dropped frames and no task over 100 ms is what reads as smooth on a 60 Hz screen. Both are already met by a wide margin, so these budgets guard against regressions.
- **Map.** 1.5 s covers the fallback that was measured. For Google Maps tiles on the phone, the suggested budget is 4 s to the first tiles; see the real-device checks.
- **Reader.** 3 s for the longest surah on a first open, which includes the download. Reopening from the saved copy should feel instant, at under 1 s.
- **Bundle.** 450 KiB gzip of first-screen JavaScript is roughly what a 6× slower CPU can parse and run in about 2 s. It also downloads in about 2.5 s on Slow 4G.

### Other measurements (no budget proposed)

| Measure                                           | Median   | Worst   |
| ------------------------------------------------- | -------- | ------- |
| Cold start, largest contentful paint              | 11.1 s   | 11.2 s  |
| Cold start, Home shell (tab bar drawn)            | 10.1 s   | 10.2 s  |
| Cold start, total blocking time                   | 438 ms   | 618 ms  |
| Cold start transfer: JavaScript                   | 588 KiB  | 588 KiB |
| Cold start transfer: fonts (all 7 files)          | 310 KiB  | 310 KiB |
| Cold start transfer: API responses                | 23 KiB   | 23 KiB  |
| Cold start on 3G: first contentful paint          | 22.2 s   | 22.4 s  |
| Cold start on 3G: Home content and interactive    | 32.9 s   | 33.3 s  |
| Warm start: first contentful paint                | 1.6 s    | 2.1 s   |
| Warm start: Home interactive                      | 3.5 s    | 3.9 s   |
| Coordinator cold start: transfer                  | 897 KiB  | 897 KiB |
| Nearby scroll: 95th percentile frame, worst frame | 16.7 ms  | 50 ms   |
| Map: total blocking time                          | 105 ms   | 237 ms  |
| User app, all JavaScript (20 files), gzip         | 612 KiB  | -       |
| User app, first-screen JavaScript, raw and brotli | 2.31 MiB | 429 KiB |
| Admin app, all JavaScript (22 files), gzip        | 557 KiB  | -       |

## What misses and why

The cold start misses all of its budgets for the same reason: **nothing is drawn until all of the JavaScript and all of the fonts have arrived.**

1. **The first paint waits for the whole bundle.** `index.html` is an empty root `<div>`. The first screen needs three scripts: 2.31 MiB raw and 544 KiB gzip, of which `__common` is 257 KiB and `entry` is 285 KiB. On Slow 4G, the download alone takes about 3.5 s. Parsing and running the scripts at 6× CPU takes most of the rest. So FCP (9.2 s) is roughly "download everything, then run everything".
2. **The root layout then waits for seven fonts.** `apps/user-app/src/app/_layout.tsx` (line ~101) renders nothing until `loadServices` and `loadAppFonts` both settle, and `loadAppFonts` loads every bundled family, with a timeout of a few seconds. Those families are Figtree (5 weights), Mehr Nastaliq and KFGQPC. That is 310 KiB over the air, more than half the JavaScript size. Mehr (130 KiB raw) is only needed for Urdu, and KFGQPC (241 KiB raw, OTF) only for the reader. The admin app has the same gate (`apps/admin-app/src/fonts/FontGate.tsx`).
3. **The bundle carries more than the first screen needs.** `entry` is almost the same size in both apps (1.06 MiB raw), which points to shared packages, mostly React Native Web, `@qc/ui` and `@qc/i18n`. Both languages' strings for every screen are in the first load. In earlier checks the i18n tables were about 30 to 55 KiB gzip.

The first-tap miss (1.9 s against 1.5 s) comes from the Nearby route chunk loading and the list query starting only after the tap.

What already works well:

- The warm start (2.1 s to content) shows the service worker and cache headers doing their job.
- Scrolling 100 rows never dropped below 60 fps in the median.
- The reader stays under its budgets with a realistic-length surah.

## Recommendations by owner lane

| Lane                       | Recommendation                                                                                                                                                                                                                                  | Expected effect                                                                   |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| user-app, admin-app        | Draw an inline shell in the exported `index.html` (brand colour, app name, a spinner, in both languages from the saved preference), so something paints before the JavaScript has arrived.                                                      | FCP from about 9 s to under 2 s. Meets the 3 s budget on its own.                 |
| user-app, admin-app, ui    | Gate the first render on the UI font of the current script only: Figtree 400 for English, Mehr for Urdu. Load the other Figtree weights after the first render (they already use `font-display: swap`). Load KFGQPC only when the reader opens. | Saves about 200 to 280 KiB and one to two seconds before content on a cold start. |
| ui                         | Ship the web fonts as WOFF2 next to the native TTF/OTF in `@qc/ui/font-sources`.                                                                                                                                                                | Roughly halves the font bytes.                                                    |
| contracts (i18n), user-app | Split the i18n tables per language, and per app where possible, and load the other language on demand.                                                                                                                                          | About 15 to 30 KiB gzip off the first load.                                       |
| user-app, admin-app        | Run a bundle analysis (`npx expo export --dump-sourcemap` with `source-map-explorer`) and lazy-load whatever the first screen does not need: the map, the reader, poster sharing and the memorisation screens.                                  | Needed to reach the 450 KiB budget.                                               |
| user-app                   | Preload the Nearby route chunk and its first query after Home settles.                                                                                                                                                                          | First tap to Nearby under 1.5 s.                                                  |
| platform                   | Keep `encode zstd gzip` in Caddy. Check in staging that Chrome on Android receives zstd. Brotli would give 429 KiB against gzip's 544 KiB for the first-screen JavaScript, and zstd should land between the two.                                | About 10 to 20% fewer JavaScript bytes, for free.                                 |

Recommendations only: the quality lane did not change any application code. With the first two items done, the cold-start budgets look reachable without changing the stack.

## Limits of these numbers

- **Emulation.** CPU throttling multiplies the speed of a fast desktop CPU. It does not model a slow phone's memory, thermal throttling, GPU or storage, so real phones can be faster at parsing and slower at painting. Throttled networks have no packet loss or radio wake-up delay.
- **The build is a web export.** It is not the Android build. The native app has no JavaScript download, so its cold start depends on the APK, Hermes bytecode and the native font loader. Only the bundle-size and in-app numbers (scroll, reader, map) carry over in spirit.
- **The map was not measured.** Only the list-only fallback ran. Google Maps tiles, the SDK start and marker clustering need the phone and a key.
- **Placeholder Quran text.** It has the real verse counts and lengths, but not the real script or font shaping. KFGQPC shaping cost on a phone is unknown.
- **A shared machine.** Other agents ran load tests at the same time. Worst runs may include their noise; medians were steady across two stacks.
- **Small samples.** 5 runs, or 3 for 3G, are enough to see an order of magnitude, not to set a tight threshold. On the phone, use at least 10 runs.

## Real-device checks a human must do

Use the reference phone, or the lowest-end Android phone the programme expects: 2 GB RAM, Android 10 to 12, Chrome. Run these against staging with the production build and synthetic data, and record each one 10 times with the median and the worst.

1. **Cold start on Slow 4G and 3G.** Clear Chrome's site data, then open the user app URL. Use a real mobile connection or Chrome DevTools remote debugging with no extra throttling. Time three things:
   - first paint
   - Home showing the next session or the list
   - the first tap on Nearby showing the list

   Then repeat for the coordinator app. Compare with the 3 s, 6 s, 8 s and 1.5 s budgets.

2. **Warm start from the installed PWA.** Add to home screen, open it once, close it, wait one minute, then open it again. Time Home's content against the 3 s budget. Repeat in airplane mode, where the cached shell and offline messages should show.
3. **Native Android build.** Install the release build and repeat check 1 from the launcher icon: cold, after a force stop, and warm, from recents. Capture the native start times with `adb shell am start -W`.
4. **Nearby scroll.** With at least 100 sessions in the city, fling the list down and back three times, with GPU rendering profile bars on (Developer options, "Profile HWUI rendering"). Count frames above the 16 ms line. Repeat with TalkBack on, swiping through 20 rows, and note any lag between the swipe and the announcement.
5. **Map with Google Maps.** With the production Maps key, tap Map on Nearby: time it until the first tiles and markers show (suggested budget: 4 s on Slow 4G). Pan and zoom for 30 seconds and watch for jank or blank tiles.
6. **Quran reader.** Clear storage, open Al-Baqarah, and time it until the first verse in the real KFGQPC font, against the 3 s budget. Scroll to the end, close it, reopen it (budget: 1 s), then repeat in airplane mode. Check the Uthmani script for missing glyphs or overlapping marks at all four text sizes.
7. **Memory.** After 10 minutes of normal use (Home, Nearby, a session, the reader, Profile), check Chrome's or the app's memory in Developer options, Running services. Note it if it is above about 250 MB, or if Android kills the app in the background.
8. **Data use.** On a fresh install, read Android's per-app data usage after one cold start and after one day of normal use. Compare it with the 900 KiB start budget.
9. **Urdu and the largest text size.** Repeat checks 1 and 6 in Urdu at the largest text size, which uses the Mehr font and longer layout.
10. **Every release candidate.** Repeat checks 1, 2, 4 and 6 for each release candidate, and record the results next to this page. Then replace the provisional numbers and change the budgets if the phone disagrees with the emulation.
