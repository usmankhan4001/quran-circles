# @qc/content

The Quran reader and prayer times modules the apps mount: the Quran text source and its on-device cache, prayer times, the Hijri date, bookmarks and reading progress.

Owned by the **content** lane ([brief](../../docs/agents/briefs/content.md)). Anything that stores Quran text or translation needs a human approval.

## What is where

| Path                             | What it is                                                                                                                                                                |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/quran/`                     | `QuranSource` and the api.alquran.cloud implementation, with a 24-passage device cache ([decision 0008](../../docs/engineering/decisions/0008-quran-source-and-cache.md)) |
| `src/prayer/`                    | Prayer times (`adhan`, Karachi method, Hanafi Asr) and the Umm al-Qura Hijri date ([decision 0007](../../docs/engineering/decisions/0007-prayer-times-and-hijri.md))      |
| `src/bookmarks/`, `src/reading/` | Bookmarks and reading progress                                                                                                                                            |
| `src/storage/`                   | Storage adapters (AsyncStorage on phones, IndexedDB or localStorage on the web)                                                                                           |
| `src/ui/`                        | The Quran index, reader and prayer times screens, and the Home cards                                                                                                      |

No Quran text or translation is committed here. Tests use invented text marked `FAKE`.

## Commands

```sh
pnpm --filter @qc/content test
node packages/content/scripts/compare-aladhan.mjs     # compare prayer times with Aladhan (needs internet)
```
