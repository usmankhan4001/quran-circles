# 0008: Quran text source, cache and storage

Status: accepted
Date: 2026-10-16
Lane: content

## Context

The reader needs Arabic text with an Urdu translation. The rights to store the Urdu translation are unconfirmed (docs/agents/briefs/content.md, "Rights"; WP18 is blocked until they are). So until then the app must not ship or commit any Quran text or translation, and must still work well for someone who has read a surah before.

## Options

- Bundle the text in the repository or the app. Not allowed until rights are confirmed in writing.
- Fetch from the online source on every read. Always works online, never offline.
- Fetch from the online source behind a small on-device cache that remembers what was read.

## Decision

- `QuranSource` is an interface (`getSurah`, `getJuz`). The only implementation is `createAlQuranCloudSource`, which calls api.alquran.cloud with the same editions V1 used: `quran-uthmani` (Arabic) and `ur.maududi` (Urdu). `fetch` is injected, so tests never reach the network and an app can pass its own.
- `createCachedQuranSource` wraps any source. A copy under 30 days old is returned without a request. An older copy is refreshed first; if that fails it is still returned, marked `stale`, and the reader says so. At most 24 passages are kept (least recently read are dropped). Requests for the same passage at the same time share one fetch.
- Storage is injected too: `KeyValueStorage` with adapters for AsyncStorage (phones) and IndexedDB or localStorage (web). A storage that throws or is full is treated as empty.
- The opening formula is cut from ayah 1 by position (the first four words), so it is read from the fetched text and no Quran text is written in the code.
- Tests use invented text that says `FAKE` in every string.
- WP18 (a complete offline copy) is not built. When rights are confirmed it can sit behind the same `QuranSource` interface.

**Rights flag for the orchestrator:** the cache keeps fetched Urdu translation text on the person's own device, for at most 24 passages. That is a runtime cache of a public API's responses, not a distributed copy, and it is what V1's service worker already did (`src/service-worker.ts`). If the rights owner objects to even that, set `maxPassages` to 0 in `createContentServices` (one line) and the reader works online only.

## Consequences

- A surah that was never opened cannot be read offline; the reader says so and offers a retry. A recently read one opens at once.
- If alquran.cloud changes its response shape, responses are validated (zod) and the reader shows an error, not a broken page.
- Revisit when WP18 is unblocked.
