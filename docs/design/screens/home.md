# Screen: Home

App: User app (tab 1: Home). Priority: P0. Written by the ui lane; a human reviews it with the catalog (`docs/design/catalog.md`).

## Purpose

Show the person what to do next: the next session near them or for the circles they follow, what is new from the venues they follow, the next prayer and where they stopped reading. Home is season-aware: the server says whether Dora or Circles leads (`config.get`), and the heading and the first card change with it. A first-time visitor who is not signed in sees the same screen with sessions near them; no account is needed to browse.

Success: from opening the app, a person reaches a session's details, or registers, in two taps.

## Layout

Top to bottom, one column, 16 dp side gutters, 16 dp between cards:

1. `Header` (large): the season title (Dora near you / Circles near you). At the end: the avatar button for Profile (an `Avatar`, name from the account, or a person icon when signed out).
2. **Next session card** (`Card`, pressable). Venue name, day and time, distance, a facility line, and a large primary `Button` "See details". If the person is registered for the next session it says so with a `Chip`-style status and no button. For a one-off special lecture, the card shows the lecture title.
3. **Updates** section: title row with an unread `Badge` and "See all updates" (tertiary button). Up to three `ListItem` rows (venue avatar, message, time); unread rows have a dot.
4. **Prayer card** (`Card`): the next prayer's name, the countdown ("Asr in 1 h 20 min") and the Hijri date.
5. **Continue reading card** (`Card`, pressable): surah and verse where the person stopped; opens the reader. If never opened: "Start reading".
6. `TabBar` at the bottom (Home selected). The Home tab shows a dot when there are unread updates.

At the largest text size the cards stack with the same order; the prayer and reading cards are full width, never side by side.

## States

| State                     | What the person sees                                                                                                                                                                                                                                                              |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Loading                   | Skeleton for the next session card (block 120 dp), three skeleton rows for updates, a skeleton for each small card. Announced once as Loading.                                                                                                                                    |
| Empty: no sessions nearby | `EmptyState` inside the first card: "No sessions near you yet", with the action "Request a circle near me" (opens the request flow in Nearby).                                                                                                                                    |
| Empty: no updates         | One quiet line under the Updates title: "No updates yet. Follow a venue to hear from it." No illustration.                                                                                                                                                                        |
| Error                     | Each section fails on its own. A failed section shows `ErrorState` (compact) with Try again; the other sections stay. A failure of everything shows one `ErrorState` for the page.                                                                                                |
| Offline                   | A one-line notice under the header: "You are offline. Showing what we saved earlier." Cached sessions, updates and prayer times stay visible. Prayer times keep counting down because they are calculated on the phone. Actions that need the network are disabled with a reason. |
| Signed out                | Everything works for browsing. The avatar shows a sign-in prompt. Updates show only public ones.                                                                                                                                                                                  |
| Season switch             | When the server flips Dora to Circles (or back), the heading and the first card change on the next refresh. Nothing else moves.                                                                                                                                                   |

## Translation keys

English below; Urdu drafts are in `packages/i18n/src/ur.json` under the same keys and carry the draft marker.

| Key                            | English                                         | Used for                                    |
| ------------------------------ | ----------------------------------------------- | ------------------------------------------- |
| `home.season.doraTitle`        | Dora near you                                   | Header, Dora season                         |
| `home.season.circlesTitle`     | Circles near you                                | Header, Circles season                      |
| `home.nextSession.title`       | Your next session                               | Card title when the person is registered    |
| `home.nextSession.near`        | Next session near you                           | Card title when showing a session near them |
| `home.nextSession.action`      | See details                                     | Primary button on the card                  |
| `home.nextSession.empty.title` | No sessions near you yet                        | Empty state title                           |
| `home.nextSession.empty.body`  | You can ask for a circle in your area.          | Empty state text                            |
| `home.updates.title`           | Updates                                         | Section title                               |
| `home.updates.empty`           | No updates yet. Follow a venue to hear from it. | Empty updates line                          |
| `home.updates.seeAll`          | See all updates                                 | Link under the section                      |
| `home.reading.title`           | Continue reading                                | Card title                                  |
| `home.reading.position`        | {surah}, verse {ayah}                           | Card line with the surah and verse          |
| `home.reading.start`           | Start reading                                   | Card when nothing has been read             |
| `home.offline`                 | You are offline. Showing what we saved earlier. | Offline notice                              |
| `prayer.next`                  | Next prayer                                     | Prayer card title                           |
| `prayer.countdown`             | {prayer} in {time}                              | Prayer card countdown                       |
| `nearby.request.action`        | Request a circle near me                        | Empty state action                          |

Also uses, already defined elsewhere: `ui.unread`, `ui.newUpdates` (Badge), `ui.errorTitle`, `ui.errorBody`, `ui.retry`, `ui.loading`, `tabs.*`, `profile.title`, `prayer.hijri`, `prayer.fajr` to `prayer.isha`.

## Urdu and right-to-left notes

- Whole screen mirrors: the avatar button moves to the left end of the header in Urdu; the card chevron points left.
- The countdown sentence has two placeholders (`{prayer}` and `{time}`). Format `{time}` with the locale's numerals (Western digits) and keep it as one left-to-right run.
- A venue name in English inside an Urdu card is isolated (`isolate()`), so the distance and time stay in the right order.
- Surah names come from the content package in Urdu in Urdu mode. Verse numbers use Western digits.
- Updates written by coordinators can be in either language: render each with `direction="auto"`.

## Accessibility notes

- Heading order: the header title is level 1; each section title is level 2.
- The next session card is one control with a full name: "Al-Noor Masjid, Friday 9:30 pm, 2 km away. See details". The inner button is not a second focus stop.
- The Updates unread badge is read once: "Updates, 3 unread". The Home tab's dot is read as part of the tab name.
- The countdown is not a live region (it would announce every minute). It is read when the card is focused.
- Skeleton is announced once; offline notice is a status message.

## Components used

- Header (large)
- Avatar
- Card
- Button
- ListItem
- Badge
- Chip
- EmptyState
- ErrorState
- Skeleton
- TabBar
- Text

## Data

- `config.get`: season, feature flags, Hijri offset.
- `occurrences.list` for the next session near the person or for followed circles; `follows.list`.
- `updates.feed`, `updates.unreadCount`, `updates.markRead` (on opening the list).
- `readingPosition.get`; prayer times are calculated on the phone from the chosen city (content package).

## Open questions

- Should Home show the nearest session by distance or the earliest by time? Proposed: earliest session within 15 km, with distance shown.
- Prayer calculation method and the Hijri offset range are owned by the content lane.
