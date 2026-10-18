# Screen: Nearby

App: User app (tab 2: Nearby). Priority: P0. Written by the ui lane; a human reviews it with the catalog (`docs/design/catalog.md`).

## Purpose

Help someone find the nearest Quran session they can attend, on a map or in a list, narrowed by day, time, section, language and area. When nothing is close, offer to request a circle. This is the main discovery screen and works without an account.

## Layout

1. `Header` (large): "Nearby".
2. **Search row**: a `TextField`-style search ("Search by area or venue") and a "Use my location" `Button` (tertiary). The location permission is asked only when the person taps it.
3. **View switch** (`SegmentedControl`): Map | List. The choice is remembered.
4. **Filter row**: a horizontally scrolling row of `Chip`s (Day, Time, Section, Language, Area), each shows its current value. A "Filters" `Button` (secondary) opens the **filter sheet** (`Sheet`) with a `Select` or `SegmentedControl` for each filter and two buttons: "Show results" (primary) and "Clear filters" (tertiary). Active filters appear as removable chips.
5. **Result count line**: "3 places near you".
6. **Map view**: the map (behind the swappable map interface) with pins; below it a draggable list of the nearest results. Tapping a pin selects the matching row. The map is optional: if it fails to load, the list view opens.
7. **List view**: `ListItem` rows: avatar or icon, venue name, next session ("Next: Fri 9:30 pm"), distance, facility icons as text chips (Women's section, Parking). Row opens the venue and session page.
8. `TabBar` (Nearby selected).

## States

| State            | What the person sees                                                                                                                                                                                                                             |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Loading          | Skeleton rows (3) in the list; the map shows its own placeholder block. Filters stay usable.                                                                                                                                                     |
| Empty            | `EmptyState`: "No sessions found" with "Try another day or area, or ask for a circle near you." Primary action "Request a circle near me". Secondary "Clear filters" when filters are active.                                                    |
| Error            | `ErrorState` with Try again in place of the list. The search field and filters stay.                                                                                                                                                             |
| Offline          | Notice: "You are offline. Showing places we saved earlier." The last results are shown without the map's live tiles; the list works. "Use my location" still works (the phone's location does not need internet).                                |
| Location denied  | A quiet line: "Location is off. Search by area instead." The area search is the default path; location is never required.                                                                                                                        |
| Request a circle | A `Sheet` with area (prefilled), optional days, section and language, and a primary button. One active request per person per area; the error `errors.circle_request_exists` is shown in the sheet. Signing in is asked at this point if needed. |

## Translation keys

English below; Urdu drafts are in `packages/i18n/src/ur/<part>.json` (the part `partOf(key)` names; see `docs/engineering/i18n-keys.md`) under the same keys and carry the draft marker.

| Key                         | English                                                | Used for                            |
| --------------------------- | ------------------------------------------------------ | ----------------------------------- |
| `nearby.title`              | Nearby                                                 | Header                              |
| `nearby.search.label`       | Search                                                 | Search field name                   |
| `nearby.search.placeholder` | Search by area or venue                                | Search field hint                   |
| `nearby.location.use`       | Use my location                                        | Location button                     |
| `nearby.location.denied`    | Location is off. Search by area instead.               | Location denied line                |
| `nearby.view.label`         | Show as                                                | Name of the Map or List switch      |
| `nearby.view.map`           | Map                                                    | Switch option                       |
| `nearby.view.list`          | List                                                   | Switch option                       |
| `nearby.map.label`          | Map of places near you                                 | Name of the map for a screen reader |
| `nearby.filters.open`       | Filters                                                | Button that opens the filter sheet  |
| `nearby.filters.title`      | Filters                                                | Filter sheet title                  |
| `nearby.filters.day`        | Day                                                    | Filter name                         |
| `nearby.filters.time`       | Time                                                   | Filter name                         |
| `nearby.filters.section`    | Section                                                | Filter name                         |
| `nearby.filters.language`   | Language                                               | Filter name                         |
| `nearby.filters.area`       | Area                                                   | Filter name                         |
| `nearby.filters.any`        | Any                                                    | Value when a filter is not set      |
| `nearby.filters.apply`      | Show results                                           | Sheet primary button                |
| `nearby.filters.clear`      | Clear filters                                          | Sheet tertiary button               |
| `nearby.time.*`             | 4 keys: morning, afternoon, evening, night             | Time of day options                 |
| `nearby.result.count.one`   | 1 place near you                                       | Result count, one                   |
| `nearby.result.count.other` | {count} places near you                                | Result count, many                  |
| `nearby.result.distance`    | {distance} km away                                     | Row distance                        |
| `nearby.result.nextSession` | Next: {when}                                           | Row next session                    |
| `nearby.empty.title`        | No sessions found                                      | Empty state title                   |
| `nearby.empty.body`         | Try another day or area, or ask for a circle near you. | Empty state text                    |
| `nearby.request.action`     | Request a circle near me                               | Request a circle button             |
| `nearby.offline`            | You are offline. Showing places we saved earlier.      | Offline notice                      |

Also uses, already defined elsewhere: `days.*`, `sections.*`, `profile.language.en`, `profile.language.ur`, `facilities.*`, `errors.circle_request_exists`, `ui.*`.

## Urdu and right-to-left notes

- Search field text follows the typed language (`direction="auto"`); its icon and clear button sit at the end.
- The filter chip row starts at the right in Urdu and scrolls leftwards. The first chip is Day in both directions.
- The map itself is never mirrored. The list under it is.
- Language names are written in their own script in both locales: English, اردو.
- Distances use Western digits and the unit word from the translation.

## Accessibility notes

- The map is not the only way to the information: every pin is also a list row, and the list is one tap away. The map is `aria-hidden` for screen readers apart from the label "Map of places near you".
- Filter chips are toggles with state; the sheet is a dialog with a close button; applying filters announces the new count ("3 places near you") politely.
- Each list row is one control with a full name including distance and next session.
- Targets: chips are 48 dp tall; pins have a 48 dp hit area.
- Do not rely on colour for open or full sessions: a text label says "Full" or "2 seats left".

## Components used

- Header (large)
- TextField
- Button
- SegmentedControl
- Chip
- Sheet
- Select
- ListItem
- Avatar
- EmptyState
- ErrorState
- Skeleton
- TabBar
- Text
- Map (user-app lane, through the map interface)

## Data

- `venues.list` with city, area, facilities and name; `places.areas`; `occurrences.list` for next sessions.
- `circleRequests.create` and `circleRequests.list` for the request flow.
- Saved results for offline use (user-app lane).

## Open questions

- Kit gap: a map component is outside the kit by design. The user-app lane builds it behind the map interface and uses the kit's tokens for pins and the bottom list.
- Kit gap: a search field with a clear button. Proposed: `TextField` gains a `clearable` prop in the next kit release.
