# Screen: Quran and Prayer

App: User app (tab 4: Quran & Prayer). Priority: P0. Written by the ui lane; a human reviews it with the catalog (`docs/design/catalog.md`).

## Purpose

Two supporting tools in one tab: a Quran reader with Urdu translation, bookmarks, the last place read and an offline copy; and prayer times with a countdown and the Hijri date. They support the app; they are not its main purpose, so the screen is simple and quiet. The reader's own page design (verse layout, page flow) is shared with the content lane; this spec fixes the screen around it.

## Layout

A `SegmentedControl` at the top switches between **Quran** and **Prayer times**; the choice is remembered. The `TabBar` stays at the bottom.

**Quran view**

1. "Continue reading" `Card` (pressable) with the surah, verse and a large "Continue" button. Hidden until something has been read.
2. `TextField`-style search "Find a surah", then the **Surahs** list: `ListItem` rows with the number, the Arabic name in AlMushaf (Quran font, Quran text only), the Urdu or English name, and the verse count.
3. **Bookmarks**: a `ListItem` row opens the list of bookmarks.
4. **Offline copy**: a `Card` with "Save for offline reading", the progress "Saving: 40%", then "Saved on this phone". Only shown when the content lane's rights allow storing text (WP18); until then the card is hidden and text is fetched online.

**Reader** (opens full screen; header with back, surah name, a bookmark `IconButton` for the current verse and a text-size `IconButton`):

- Each verse: Arabic in AlMushaf at the reader size, right to left; under it the Urdu translation in Gulzar (a switch "Show Urdu translation" in the reader's settings sheet); verse number; a bookmark toggle per verse (48 dp).
- The reader's text size uses the same four steps as the app; the reader's own sheet repeats the control "Text size".
- The last verse reached is saved as the person's reading position.

**Prayer view**

1. A large `Card`: the next prayer's name and the countdown ("Asr in 1 h 20 min"), the Hijri date and "Times for Lahore".
2. A list of today's six times (Fajr, Sunrise, Dhuhr, Asr, Maghrib, Isha) as `ListItem`s; the next one is marked with a text label "Next" and a bar, not colour alone.
3. A line: "The Hijri date follows moon sighting in Pakistan." (the admin-set offset is applied).
4. Change city: a `Select` at the top of the view.

## States

| State               | What the person sees                                                                                                                                                                                           |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Loading             | Surah list: skeleton rows. Reader: skeleton lines while a surah loads; the previous verses stay visible when moving on. Prayer: skeleton card.                                                                 |
| Empty: no bookmarks | "No bookmarks yet. Tap the bookmark on any verse." No illustration.                                                                                                                                            |
| Empty: no city      | `EmptyState`: "Choose your city" / "We need your city to show prayer times." action "Choose city" (opens the city `Select`).                                                                                   |
| Error               | `ErrorState` with Try again for the surah list or a surah. A failed surah keeps the person on the previous page.                                                                                               |
| Offline             | Prayer times work fully offline (calculated on the phone); the Hijri date too. Surahs that are saved open; one that is not shows "This part is not saved. Connect to the internet to read it." with Try again. |
| Downloading         | Progress text "Saving: 40%" in a status region and a `Button` to stop. The reader remains usable.                                                                                                              |

## Translation keys

English below; Urdu drafts are in `packages/i18n/src/ur.json` under the same keys and carry the draft marker.

| Key                         | English                                                     | Used for                      |
| --------------------------- | ----------------------------------------------------------- | ----------------------------- |
| `quran.title`               | Quran                                                       | Reader and list header        |
| `quran.tab.quran`           | Quran                                                       | Switch option                 |
| `quran.tab.prayer`          | Prayer times                                                | Switch option                 |
| `quran.continue`            | Continue reading                                            | Continue card                 |
| `quran.surahs`              | Surahs                                                      | Surah list title              |
| `quran.search`              | Find a surah                                                | Surah search                  |
| `quran.bookmarks.title`     | Bookmarks                                                   | Bookmarks title               |
| `quran.bookmarks.empty`     | No bookmarks yet. Tap the bookmark on any verse.            | No bookmarks line             |
| `quran.bookmark.add`        | Add bookmark                                                | Bookmark button name          |
| `quran.bookmark.remove`     | Remove bookmark                                             | Bookmark button name when set |
| `quran.translation.show`    | Show Urdu translation                                       | Translation switch            |
| `quran.textSize`            | Text size                                                   | Reader text size control      |
| `quran.offline.save`        | Save for offline reading                                    | Offline copy button           |
| `quran.offline.saving`      | Saving: {percent}%                                          | Progress text                 |
| `quran.offline.saved`       | Saved on this phone                                         | Saved line                    |
| `quran.offline.unavailable` | This part is not saved. Connect to the internet to read it. | Unsaved and offline line      |
| `prayer.title`              | Prayer times                                                | Prayer view header            |
| `prayer.next`               | Next prayer                                                 | Next prayer label             |
| `prayer.countdown`          | {prayer} in {time}                                          | Countdown                     |
| `prayer.fajr`               | Fajr                                                        | Prayer name                   |
| `prayer.sunrise`            | Sunrise                                                     | Prayer name                   |
| `prayer.dhuhr`              | Dhuhr                                                       | Prayer name                   |
| `prayer.asr`                | Asr                                                         | Prayer name                   |
| `prayer.maghrib`            | Maghrib                                                     | Prayer name                   |
| `prayer.isha`               | Isha                                                        | Prayer name                   |
| `prayer.hijri`              | Hijri date                                                  | Hijri label                   |
| `prayer.hijriNote`          | The Hijri date follows moon sighting in Pakistan.           | Hijri note                    |
| `prayer.city`               | Times for {city}                                            | City line                     |
| `prayer.noCity.title`       | Choose your city                                            | No city title                 |
| `prayer.noCity.body`        | We need your city to show prayer times.                     | No city text                  |
| `prayer.noCity.action`      | Choose city                                                 | No city button                |

Also uses, already defined elsewhere: `profile.textSize.*`, `tabs.quranPrayer`, `ui.*`.

## Urdu and right-to-left notes

- Quran text is always right to left and always AlMushaf, whatever the app language; it is the only text in AlMushaf. The translation under it is Gulzar (Urdu) or DM Sans (English) in the app's direction.
- Quran line height is 2.2 times the size so stacked marks never touch; do not clip with a fixed-height row. At 1.5x text, a verse may take most of a screen; that is expected.
- In the surah list, the Arabic name sits at the end side and the number at the start side, in both languages.
- Prayer names are in Urdu in Urdu mode (فجر, ظہر, عصر, مغرب, عشاء); clock times use Western digits with am and pm from the translation.
- The reader's page turn and swipe follow the Quran's right-to-left direction in both app languages (swipe leftwards for the next page). This is a reader decision for the content lane; flag any change.

## Accessibility notes

- Verse text carries `lang="ar"` so a screen reader pronounces it in Arabic; the translation carries its own language.
- Each verse is one stop with the translation read after the Arabic; bookmark and share are actions on the verse, not separate stops for every word.
- Text size in the reader never overlaps the controls; its steps match the app's four.
- The countdown is read when focused, not announced every minute. "Next" is written, not just coloured.
- Download progress is a polite status message at 25 percent steps.

## Components used

- SegmentedControl
- Card
- ListItem
- Select
- IconButton
- Switch
- Sheet
- Button
- EmptyState
- ErrorState
- Skeleton
- Text (variant quran)
- TabBar

## Data

- Quran text and Urdu translation: `packages/content` (WP18); the translation's rights are unconfirmed, so no stored copy until confirmed in writing.
- `bookmarks.list`, `bookmarks.create`, `bookmarks.delete`, `bookmarks.import`, `readingPosition.get`, `readingPosition.put`.
- Prayer times calculated on the phone; Hijri offset from `config.get`.

## Open questions

- Which prayer calculation method and juristic school for Asr (content lane)?
- Does the reader page-turn direction follow the Quran (right to left) in English mode too? Proposed: yes.
