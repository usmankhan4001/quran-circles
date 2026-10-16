# Brief: content

Lane: content (Quran and prayer)
Work packages: WP8 (Wave 2), WP18 (Wave 4)
Wave: 2
Priority: P0 for WP8, P1 for WP18
Approval: reviewer agent, UI review, human for anything that stores Quran text or translation

## Goal

The lean Quran and prayer modules for the Quran & Prayer tab, built as a package the user app mounts: a Quran reader with Urdu translation, bookmarks and last read, and prayer times with a countdown and the Hijri date. It keeps V1's behaviour and removes V1's runtime dependency on an outside prayer service.

## You own

`packages/content/`.

## You must not touch

`apps/`, other `packages/`. Mount points in the apps are wired by the user-app lane.

## Read first

`docs/product/decisions.md` (Quran and prayer), `docs/product/experience.md`, `docs/design/screens/` (Quran & Prayer), the V1 reader and prayer code at the repository root (`components/Quran/`, `components/PrayerTimes.tsx`, `services/quran.ts`, `src/services/aladhan.ts`), `@qc/ui`.

## Deliverables

Wave 2 (WP8):

1. **Reader.** Arabic with Urdu translation that can be switched off, adjustable Arabic size, jump to an ayah, quick navigation between surahs, surah and juz index with search by name, last read. Port V1's behaviour, using `@qc/ui` components.
2. **Source.** Fetch text and translation from the current online source through one `QuranSource` interface, with a cache. Do not store a copy of the translation until WP18 (see rights below).
3. **Bookmarks and reading positions** through the contract's endpoints when signed in, and local-only when not. Offer a one-time import of V1 browser bookmarks at first login.
4. **Prayer times.** Calculate on the device with a prayer-time library (the Karachi method and Hanafi Asr, matching V1) instead of calling an outside API. Show the next prayer with a countdown and a week and month calendar.
5. **Hijri date** with the admin-set offset from the contract's setting, because Pakistan starts months by moon sighting.
6. **Home cards.** Small "next prayer" and "continue reading" components for the Home tab.

Wave 4 (WP18):

7. **Offline copy.** Our own stored text with the Tanzil credit shown, and an offline reader. Only after the rights in the next section are settled.

## Rights (blocking for WP18)

The Arabic text is reported as CC BY 3.0: copy it unchanged and credit Tanzil. Tanzil's translations are non-commercial unless the translator or publisher agrees, and the Maududi translation's rights are unconfirmed. Do not store or ship a copy of the translation until the orchestrator confirms permission in writing.

## Definition of done

- The reader works at four text sizes, right-to-left, light and dark, and offline for anything already cached.
- Prayer times match V1's output for the same place and date, with tests.
- Hijri offset is applied and tested.
- No Quran text or translation is committed to the repository before WP18's approval.

## Commands that must pass

```sh
pnpm check
pnpm --filter @qc/content test
```

## Decisions to respect

Lean scope: no Adhan sound alarms, no audio recitation, no prayer widget in V2. Quran and prayer are supporting tools, not the USP. The Quran font is for Quran text only.

## Stand-ins

Component kit not published yet: wait for the ui lane's first release. API endpoints not ready: use the mock server. Rights not settled: keep fetching from the online source.
