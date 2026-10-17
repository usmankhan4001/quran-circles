# Redesign hand-off to the app lanes

The owner approved the redesign on 2026-10-17 (`redesign-decisions.md`, D1 to D16). The ui lane has rebuilt the kit in `packages/ui`, so every app picks up the new colours, fonts, corners, buttons, fields, chips, cards, green-topped sheets, toasts and the floating tab bar without code changes. App tests and typechecks pass against the new kit.

The app lanes own their screens (`docs/engineering/ownership.md`). This page lists what each lane changes to match the agreed layouts. The drawn screens are the reference; the screen specs in `screens/` still hold the states, keys and accessibility notes.

## Kit changes the apps should know about

- `Button` has a new `outline` variant. `secondary` is now the leaf-tint button (D8); use `outline` where a green outline was meant.
- `IconButton` has an `onHero` variant for icons on the green header.
- New semantic colours `hero`, `textOnHero`, `heroGlass` and `heroGlassPressed` for the green header that tops main screens (D12). Draw headers with these, not raw values.
- `TextField` puts its label inside the field (D9). No API change.
- `TabBar` floats and shows the label on the chosen tab only; every tab keeps its name for screen readers. Pass icons for every tab.
- Fonts are now Figtree, Jameel Noori Nastaleeq and KFGQPC Uthmanic Hafs. The apps bundle the files once their licences are confirmed; until then the system falls back.
- Night mode is the night green (`dark`).
- `HeroHeader` now fades into the page with the faint eight-point pattern, as drawn (`shape="fade"`, the default, on the web). Use `shape="rounded"` for sheets and short headers. New colour `heroEnd`.
- `Icon` now has the drawings' line set: `home`, `pin`, `book`, `calendar`, `clock`, `bell`, `people`, `user`, `filter`, `route`, `prayer`, `share`, `bookmark` and `star`. The user app's `Glyph` can go.
- `StarNumber` puts a surah, para or ayah number in the eight-point star.
- `TabBar`: the chosen tab now takes the width its label needs, so "My Journey" and "Quran & Prayer" are no longer cut, and badges sit on the icon's corner instead of on the label.

## user-app

| Screen                    | Layout                                                                                                                           | Reference                                                                                               |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Home                      | H4: next circle in the green header, search, map card, circles near you as picture cards, ayah of the day, "Also in the app" row | https://claude.ai/artifact/2CiFog76rb9ZAHLF2BDCHX                                                       |
| Nearby                    | N2: green header with a Map / List switch; list ends with "Ask for a circle near you"                                            | https://claude.ai/artifact/EYjcjnrHaSBfovNtJxtGHU                                                       |
| Session and venue         | S1: photo on top, raised detail cards, one Register bar                                                                          | https://claude.ai/artifact/RgfYMvwTtFh8GuPtDa2ex3                                                       |
| Registration              | R2: in a green-topped sheet over the session page                                                                                | https://claude.ai/artifact/3aF22dRg3yjS8wbGxKr18k                                                       |
| My Journey                | J1: summary header, upcoming with reminder switches, progress, followed masjids; session companion                               | https://claude.ai/artifact/E8bF29LSW1Pc2FSGKM3xa7                                                       |
| Quran and prayer          | Q1: clean lists; paras, search, reading settings, bookmarks, offline, qibla, timetable, alerts                                   | https://claude.ai/artifact/MUf1ve9bvTGhCwsyahvgRx and https://claude.ai/artifact/Q4Qxk1AfrL7i411qrnXVAR |
| Updates, profile, sign-in | B: green header on each page                                                                                                     | https://claude.ai/artifact/4WQhXBEstymMgd8GgEADrU                                                       |
| Feature screens           | Circle request, first open, ayah share, invites, reminders, Ramadan Home, widget                                                 | https://claude.ai/artifact/Q4Qxk1AfrL7i411qrnXVAR                                                       |

Tabs: Home, Nearby, Quran, Journey. Quran, prayer and qibla stay secondary (D12).

## admin-app

Layout A, the same look as the user app (green header, floating tabs: Today, Places, Updates, Account).

- Today, attendance, post an update: https://claude.ai/artifact/LgHSJiqzbsUtSWSKA4NDfc
- Registrants, change or cancel a time, places, venue and circle editors, approval, sign-in, account: https://claude.ai/artifact/9orj7uMZstU7Pq88PrjBY1
- Posters, message templates, circle requests, handover: https://claude.ai/artifact/Q4Qxk1AfrL7i411qrnXVAR

## console

C2: green sidebar with the eight-point pattern, light content area.

- Sessions: https://claude.ai/artifact/HKniV9wA9yrnpqWgGwB22m
- Coordinator invites, bulk import check, exports: https://claude.ai/artifact/9orj7uMZstU7Pq88PrjBY1

## renderer

Posters follow D3 and D4 (Tanzeem green, gilt for decoration, Figtree and Nastaliq), not the earlier emerald, DM Sans and Gulzar in `poster-direction.md`. Poster flow: https://claude.ai/artifact/Q4Qxk1AfrL7i411qrnXVAR

## Gap list: built apps against the drawings (2026-10-17)

The owner asked for the apps to look like the drawings. The ui lane ran the user app, admin app and console from this branch against the mock API, in English, Urdu and night, and compared each screen with its drawing. Kit gaps are fixed (see the list above). What is left belongs to the app lanes. Each row says what the app shows now and what the drawing shows.

### user-app

| Screen                 | Now                                                                             | Drawing                                                                                                                                                                      |
| ---------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home header            | Sticky; flat green block with rounded corners; covers content as you scroll     | Scrolls away with the page; green fades into the page with the eight-point pattern (`HeroHeader` default now); a compact top row when scrolled                               |
| Home, next circle      | Small translucent card inside the green                                         | White raised card half on the green: big start time and countdown, the portion being read, the section (women, men, family), and two buttons, Directions and My registration |
| Home, circles near you | Green blocks with a placeholder mark                                            | Picture cards with the venue photo or drawn venue art, distance tag on the photo, name and time under it                                                                     |
| Home, ayah of the day  | Only "Surah 93, ayah 3" and a Read link                                         | The ayah in Arabic (Quran font), its translation in the screen's language, and the reference, on a leaf card with gilt rule                                                  |
| Home, extras           | Updates, Next prayer and Continue reading as full cards after "Also in the app" | Extras are a small row of round shortcuts; prayer time sits in the `PrayerStrip`                                                                                             |
| Icons everywhere       | Local `Glyph` drawings; the pin reads as an eye                                 | Kit `Icon` line set; swap `Glyph` for `Icon` (same names, `prayer` included)                                                                                                 |
| Times in Urdu          | "PM 4:30" (the time is reordered by the right-to-left line)                     | "4:30 PM" kept left to right with `ltrRun` or `isolate`                                                                                                                      |
| Nearby                 | City select, Choose area and Filters as large buttons                           | One row of chips (area, day, women/men/family) under the search field; map pins are the drawn green pins with the count                                                      |
| Venue and session      | Green box with a house mark where the photo goes                                | Full-width venue photo with a dark fade, back and share buttons on it; when there is no photo, drawn venue art (needs a photo field from contracts, or art)                  |
| Register               | Section cards are text only                                                     | Women, men and family cards each with their icon; the people stepper                                                                                                         |
| Quran list             | Header "Quran & Prayer" repeats the "Quran" title; plain surah numbers          | One title; numbers in `StarNumber`; Arabic surah name in the Quran font at the row end; offline mark on saved surahs                                                         |
| Quran reader           | Fallback Arabic font; shows offline in the mock                                 | KFGQPC Uthmanic Hafs (font file to bundle once licensed); ayah end marks in the star                                                                                         |
| Updates                | Plain cards                                                                     | Each update has its kind icon (time change, cancelled, new circle) and a "Go to session" button                                                                              |
| Sign-in                | No picture                                                                      | Line-drawn masjid at the top of the green header                                                                                                                             |
| Night                  | Hero very dark                                                                  | Hero lightens to `heroEnd` before fading into the page (now in the kit)                                                                                                      |

My Journey and Profile match their drawings.

### admin-app

| Screen                    | Now                                               | Drawing                                                                                          |
| ------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Today                     | Session list only                                 | Big next-session card plus four quick actions: Attendance, Post update, Change time, Registrants |
| Places                    | Empty state for the venue coordinator in the mock | The coordinator's venues as photo cards; check the mock data or the scope rule                   |
| Circle editor             | Not reachable for the venue coordinator           | Reachable from the venue page, as drawn                                                          |
| Occurrence and attendance | Error in the mock                                 | Attendance list with tick boxes and a count; check the mock route                                |

Green headers, floating tabs and the session card with `SeatMeter` already match.

### console

| Screen                 | Now                                 | Drawing                                                                                                |
| ---------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Every table page       | Table only                          | A row of KPI cards above the table (sessions this week, registrations, places full, pending approvals) |
| Table card             | No search or add                    | Search field and an Add button in the table card's top row                                             |
| Invites, import, audit | Not shown for the venue coordinator | These are admin pages; check them as an admin, they are drawn in C2                                    |

The green sidebar with the pattern matches.

### Still open across lanes

- Font files: Figtree, Jameel Noori Nastaleeq and KFGQPC Hafs need their licences confirmed before the apps bundle them. Until then screens use fallbacks, which is the biggest visible difference in Urdu and Quran text.
- Photos: the drawings assume venue photos. Contracts have no photo field yet; until they do, use drawn venue art.

## Kit pieces still to build

Now in the kit: `HeroHeader` (the green header, D12), `SearchField`, `CodeField`, `Tag`, `Banner`, `SeatMeter`, `DateStrip`, `PrayerStrip`, `SessionCard`, `ConfirmSheet`, `StarNumber` and the line icon set. Still to come from D7: Stepper (people counter) and the map pins. Apps can draw those locally until then.
