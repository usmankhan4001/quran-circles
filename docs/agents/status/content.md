# Status: content

Updated: 2026-10-17
Branch: claude/peaceful-archimedes-ain95k (orchestrator commits; nothing committed by this lane)

## Done

### 2026-10-17: Quran gaps from the drawings (redesign-handoff.md, gap list, Quran list and reader rows)

Drawing: Q1 "Clean lists" in https://claude.ai/artifact/MUf1ve9bvTGhCwsyahvgRx.

- **Quran list.** Surah and juz numbers in the kit's `StarNumber`. The Arabic surah name sits at the row end in the Quran font (`Text variant="quran" lang="ar"`, so `fonts.quran` with its fallback), in the accent colour as drawn. Surahs kept by the text cache show a "saved on this phone" mark (`SavedMark`, drawn with views because the kit has no download icon) and the row's screen-reader name ends with `quran.offline.saved`. The saved set comes from the existing `source.cachedPassages()` (surahs only; a cached juz or single ayah does not mark a surah), read by the new `useSavedSurahs()` hook when the list mounts.
- **Reader.** Each ayah's number is in `StarNumber` beside its Arabic, at the Arabic's start, in a row that runs right to left in both app languages (as drawn). The star has the accessible name `quran.ayah.number`; the plain "Ayah N" caption is gone.
- **Single-ayah read.** `QuranSource.getAyah(surah, ayah, options?) => Promise<QuranAyah>` (`{ verse: QuranVerse; fromCache; stale; fetchedAt }`), on the same source and cache path:
  - `createAlQuranCloudSource`: one request, `/ayah/{surah}:{ayah}/editions/quran-uthmani,ur.maududi`; checked with zod; refuses an answer for another ayah; drops a translation that belongs to another ayah; `not_found` without a request for an ayah that does not exist.
  - `createCachedQuranSource` (what `services.source` is, which the user app's `AyahText` mount uses today): served from a cached surah or juz that holds the ayah when there is one, else fetched alone and kept under its own key (`qc.quran.cache.v1:ayah:S:A`). Same 30-day freshness, stale fallback when offline, in-flight sharing and abort handling. A single ayah takes one place in the same index, so `cacheMaxPassages` (including 0) still bounds what is kept; it is not listed by `cachedPassages()`.
  - Also exported: `useAyah(surah, ayah)` hook and `AyahText` component (`{ surah, ayah, showTranslation?, testID? }`: Arabic in the Quran font without the opening formula, Urdu translation on an Urdu screen by default, then the credit; draws nothing while loading or on failure, matching the app's `AyahText` mount contract). The user-app lane can mount `AyahText` directly in place of its own `HomeAyahText`, which still fetches the whole surah.
- **Text credit.** `QuranTextCredit` shows `quran.credit.arabic` ("Arabic text: Tanzil Project (tanzil.net)", Urdu draft added under the file's `_meta.status` marker) under every reader passage (surah and juz) and inside `AyahText`. No licence name is printed; see the question below.
- Tests: **820 in 25 files** (was 657 in 24). New: source and cache `getAyah` (fetch, cache hit from surah / juz / single entry, refresh, stale fallback, offline, not found, in-flight, limit 0, eviction, damaged and mismatched entries, abort); list star numbers, Arabic name font and colour, saved mark and label, juz stars, storage failure; reader star placement and accessible name, credit under surah and juz; `AyahText`, `QuranTextCredit`, `SavedMark` across the 24-combination matrix (light / dark / high contrast x en / ur x four text sizes). All text is invented ("FAKE-AR 93:3").
- Checks: `pnpm --filter @qc/content typecheck` and `test`, `npx eslint packages/content`, `prettier --check` on changed files, `pnpm --filter @qc/user-app test` (670 pass) and `typecheck`, `pnpm --filter @qc/i18n test`.

### Earlier (WP8)

WP8, Wave 2 items 1 to 6. WP18 (offline copy) is not built; no Quran text or translation is committed.

- **Quran source and cache.** `QuranSource` interface; `createAlQuranCloudSource` (same editions as V1: `quran-uthmani`, `ur.maududi`; responses checked with zod); `createCachedQuranSource` (30 days fresh, stale copy served when offline and marked, 24 passages, same-passage requests share one fetch). `fetch` and storage are injected. Storage adapters: AsyncStorage, localStorage, IndexedDB, in-memory, plus a resilient wrapper that treats a failing storage as empty. Decision: `docs/engineering/decisions/0008-quran-source-and-cache.md`.
- **Reader.** Arabic (`Text variant="quran" lang="ar"`, Quran font for Quran text only) with switchable Urdu translation; six Arabic sizes on top of the app's four text sizes; jump to ayah (surah: `255`, juz: `255` or `2:255`); surah / juz / bookmarks index with search by name (English, Roman Urdu spellings, Arabic script, number); previous / next surah and a surah picker sheet; last-read saved while scrolling (top verse, after a pause, not while the reader is still scrolling to its start); opening formula cut from ayah 1 by position; share; stale / offline / error / loading states; Quran-direction order for previous and next in both languages.
- **Bookmarks and reading position.** Local store is the source of truth; syncs through `bookmarks.list/create/delete/import` and `readingPosition.get/put` when signed in; local-only when not; offline deletes are queued; a server position newer than the device's wins. One-time V1 import (`createV1Importer`, `V1ImportBanner`): maps `quran_bookmarks`, `quran_last_read`, `quran_fontSize`, `quran_showTranslation`; max 500 per call; idempotent so a retry is safe; marked handled after import or "No thanks".
- **Prayer times.** `adhan` 4.4.6, Karachi method, Hanafi Asr, Dhuhr margin 0 (matches what V1 asked Aladhan). Calendar day at the place in Pakistan Standard Time, never the phone's zone. Next prayer with countdown (rolls Isha to tomorrow's Fajr, keeps Fajr across midnight), week and month calendar, 14 Pakistani cities with Urdu names. Decision: `0007-prayer-times-and-hijri.md`.
- **Hijri date.** Vendored Umm al-Qura table (1318 to 1500 AH) plus `hijriOffsetDays` (-2..2, "days to add"), independent of phone time zone.
- **UI.** `QuranPrayerTab` (whole tab, remembers section, city and calendar view), `QuranIndexScreen`, `QuranReaderScreen`, `PrayerTimesScreen`, `NextPrayerCard`, `ContinueReadingCard` (home and tab variants), `V1ImportBanner`, `ContentProvider` / `createContentServices`, hooks (`useNow`, `useNextPrayer`, `useBookmarks`, `useReadingPosition`, `useReaderPrefs`). All strings via `@qc/i18n` (`quran.*`, `prayer.*`, `home.reading.*`; added to en and ur together, Urdu values are drafts). Designed to the specs in `docs/design/screens/quran-and-prayer.md` and `home.md`.
- **Tests: 635 in 24 files, none touch the network, all text is invented ("FAKE-AR 2:255").**
  - Prayer times: pinned values for Karachi (2026-10-16) and Lahore (2026-06-21); an independent PrayTimes.org implementation agrees with the app within one minute for 6 cities x 7 dates; time-zone independence; the Dhuhr margin.
  - Hijri: offsets -2 to +2 including month and year rollover; table equals `@umalqura/core` for every day 1900 to 2077; same answer under four `TZ` values; the offset shows on the card and on every calendar row.
  - Cache and offline: fresh, stale, offline-uncached, retry, eviction, in-flight sharing, storage failures.
  - Bookmarks: sync, offline queue, local fallback, merge, sign-out; import mapping and the whole import flow against a fake server that uses the real `@qc/contracts` client.
  - Search by surah name in English and Roman Urdu, Arabic script, numbers.
  - Countdown across Isha and across midnight (fake clock, fake timers).
  - Components across the 24-combination matrix (3 colour modes x en/ur (RTL) x 4 text sizes): RTL, text-size scaling, theme colours, accessible names, Quran font only on `lang="ar"` text.
- Package checks pass: `pnpm --filter @qc/content typecheck`, `pnpm --filter @qc/content test`, `pnpm exec eslint packages/content`, `pnpm exec prettier --check packages/content`.

## In progress

- Nothing.

## Blocked

- WP18 (offline copy): blocked on written rights for the Urdu translation, as briefed. Not started.
- Live comparison with Aladhan: no network from the build environment. `packages/content/scripts/compare-aladhan.mjs` does it (six cities, five dates, exits non-zero on more than one minute). Someone with internet should run it once and note the result in decision 0007. Until then the check is the independent reference algorithm.

## What waits on the UI kit or on the apps

- Icons: the reader uses labelled `Button`s where the design has bookmark, text-size, share and search icon buttons (change request below).
- Fonts: AlMushaf and Gulzar files are bundled by the apps; the package only names them through the kit.
- Swipe to turn the page needs a gesture library in the app; previous / next surah buttons are in place and are the accessible path.
- The app wires it up: `createContentServices({ fetch, storage, cacheStorage?, getApi, readV1? })`, then `<ContentProvider services hijriOffsetDays={config.hijriOffsetDays} signedIn>` and `<QuranPrayerTab />` in the fourth tab. Home uses `<NextPrayerCard place={...} />` and `<ContinueReadingCard onOpen />`. On the web pass `readV1: (key) => localStorage.getItem(key)` to get the V1 import; on phones leave it out.

## Questions for the orchestrator

- **Text credit (for the owner):** the repo says the Arabic text is "reported as CC BY 3.0: credit Tanzil" (`docs/product/decisions.md`, brief). Nothing in the repo confirms that the `quran-uthmani` edition served by api.alquran.cloud is the Tanzil text, or what wording or link the licence asks for. The line shown is "Arabic text: Tanzil Project (tanzil.net)", without a licence name. Please confirm the source and whether the line should also name the licence (for example "CC BY 3.0") or link to tanzil.net. The Urdu translation (Maududi) has no credit line yet; its rights are still open (WP18).
- **Decision 0008** lists `QuranSource` as `getSurah` and `getJuz`; it now also has `getAyah`. Not my file to edit; worth a line there.
- **Kit:** a `download` (saved offline) icon in `Icon` would replace the package's drawn `SavedMark`.

- **Rights:** the cache keeps fetched translation text on the person's device (at most 24 passages), as V1's service worker did. If that is not acceptable until WP18 is cleared, pass `cacheMaxPassages: 0` to `createContentServices` (tested): the reader then works online only.
- **Reader page-turn direction:** I followed the spec's proposal. Previous / next surah are ordered right to left in both languages (previous on the right). Say if English mode should follow the app direction instead.
- **Surah names in Urdu:** the lists show the Latin transliteration as the title and the Arabic name in the Quran font; Urdu-script names (not Arabic-script) for all 114 surahs need a reviewed table. Sentences on an Urdu screen use the Arabic-script name.
- **Hijri day change:** it changes at midnight at the place. Switching at Maghrib is a product choice, not a calculation one.
- **Data-migration lane's change request** (`2026-10-16-bookmark-import-home.md`): `@qc/content` already exports `mapV1Bookmarks` (and `mapV1LastRead`, the importer and the banner), with the 500 limit and ayah-count validation, so apps can import it from here. The move into `@qc/contracts` may not be needed; both mappings should be compared once.
- Decision index: `docs/engineering/decisions/README.md` does not list 0007 and 0008 (not my file to edit).
- Test environment: the package sets `testTimeout: 30000` and a 5 s async wait in its own config because the whole repo's tests run at once and long surahs render hundreds of rows in jsdom.

## Contract change requests

- [`docs/engineering/change-requests/2026-10-16-content-ui-kit-needs.md`](../../engineering/change-requests/2026-10-16-content-ui-kit-needs.md): six icons and a `lang` option on `ListItem`.
- No contract change is needed: `bookmarks.*`, `readingPosition.*` and `config.get` were enough.
