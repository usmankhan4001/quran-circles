# Screen: Venue and session page

App: User app (opens from Home, Nearby and My Journey). Priority: P0. Written by the ui lane; a human reviews it with the catalog (`docs/design/catalog.md`).

## Purpose

Everything a person needs to decide to come: where it is, when it meets, what it reads, who it is for, which facilities exist, and one clear button to register. A venue can run several sessions; a simple venue has one, and the page then reads as a single session page. It is also the landing page of a shared deep link (invite a friend or family), which opens straight to registration.

## Layout

1. `Header` with back button: venue name; subtitle area and city. At the end: a follow `IconButton`-style toggle is avoided; "Follow this venue" is a button below (see 4).
2. **Session summary** (`Card`): session name or circle name, schedule line ("Every Friday at 9:30 pm"), next date, teacher if any, language, who it is for (section). For a Dora session, today's portion with a "Read ahead" link into the Quran reader. If the coordinator added a recap after the last session it shows under "After the session".
3. **Status line**: seats left, full, waiting list open, cancelled, or time changed (with the new time). Plain words, with an icon.
4. **Primary action**, large and full width: "Register" (or "Join the waiting list" when full, disabled with the reason when cancelled or in the past). Below it, tertiary buttons: "Follow this venue" / "Following", "Invite a friend or family" (share card).
5. **Where** (`Card`): address (`Text`), "Get directions" (opens the maps app), "Call the venue" (the venue's own public number), and a small static map.
6. **Facilities**: a list of the checklist items that are present, each a `ListItem` with a check: Women's section, Parking, Wudu area, Access for elders and wheelchairs, Child friendly; then the entrance notes as plain text. Items that are absent are not listed (no red crosses). If none were filled in: "The coordinator has not added facilities yet."
7. **More sessions** (only when the venue has several): `ListItem` rows that open the other sessions.
8. Optional "Join online" `Button` for the rare online circle.

## States

| State                 | What the person sees                                                                                                                                                |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Loading               | Header with the name if known from the previous screen; skeleton blocks for the summary and the Where card.                                                         |
| Empty                 | Venue with no published session: "No sessions here yet." with Follow so the person hears when one is added.                                                         |
| Error                 | `ErrorState` with Try again. If the venue no longer exists (archived, wrong link): "We could not find this venue" with a button back to Nearby.                     |
| Offline               | The last copy is shown with a notice. Register is disabled with "You are offline"; directions and call still work. Following is queued and sent when online.        |
| Full                  | Status "This session is full." Primary action becomes "Join the waiting list" (capacity is optional and off by default).                                            |
| Cancelled or changed  | Cancelled: danger-subtle status "This session is cancelled." and no register button. Time changed: warning-subtle status "The time changed. New time: Fri 8:00 pm". |
| Registered already    | Status "Registered" and the button becomes "Cancel registration" (tertiary, danger text) which opens the cancel confirmation described in My Journey.               |
| Deep link, signed out | Opens this page with the register button focused; the registration screen asks for the number and code only when the button is pressed.                             |

## Translation keys

English below; Urdu drafts are in `packages/i18n/src/ur/<part>.json` (the part `partOf(key)` names; see `docs/engineering/i18n-keys.md`) under the same keys and carry the draft marker.

| Key                         | English                                                                                      | Used for                     |
| --------------------------- | -------------------------------------------------------------------------------------------- | ---------------------------- |
| `venue.address.title`       | Address                                                                                      | Where card title             |
| `venue.directions`          | Get directions                                                                               | Directions button            |
| `venue.call`                | Call the venue                                                                               | Call button                  |
| `venue.follow`              | Follow this venue                                                                            | Follow button                |
| `venue.following`           | Following                                                                                    | Follow button when following |
| `venue.share`               | Invite a friend or family                                                                    | Share an invite              |
| `venue.facilities.title`    | Facilities                                                                                   | Facilities section title     |
| `venue.facilities.none`     | The coordinator has not added facilities yet.                                                | No facilities line           |
| `venue.sessions.title`      | Sessions                                                                                     | More sessions title          |
| `venue.sessions.empty`      | No sessions here yet.                                                                        | No sessions line             |
| `venue.notFound.title`      | We could not find this venue                                                                 | Not found title              |
| `venue.notFound.body`       | It may have been removed. Go back to Nearby to find another.                                 | Not found text               |
| `session.when`              | When                                                                                         | Schedule section label       |
| `session.schedule`          | Every {day} at {time}                                                                        | Weekly schedule line         |
| `session.next`              | Next: {date}                                                                                 | Next date line               |
| `session.teacher`           | Teacher: {name}                                                                              | Teacher line                 |
| `session.language`          | Language: {language}                                                                         | Language line                |
| `session.section`           | For: {section}                                                                               | Who it is for                |
| `session.portion.title`     | Today's portion                                                                              | Portion title                |
| `session.portion.readAhead` | Read ahead                                                                                   | Read ahead link              |
| `session.seatsLeft.one`     | 1 seat left                                                                                  | Seats, one                   |
| `session.seatsLeft.other`   | {count} seats left                                                                           | Seats, many                  |
| `session.full`              | This session is full.                                                                        | Full status                  |
| `session.waitlist`          | Join the waiting list                                                                        | Waiting list button          |
| `session.cancelled`         | This session is cancelled.                                                                   | Cancelled status             |
| `session.changed`           | The time changed. New time: {when}                                                           | Time changed status          |
| `session.recap.title`       | After the session                                                                            | Recap title                  |
| `session.online`            | Join online                                                                                  | Online link button           |
| `registration.submit`       | Register                                                                                     | Primary action               |
| `facilities.*`              | 6 keys: womenSection, parking, wuduArea, elderWheelchairAccess, childFriendly, entranceNotes | Facility names               |

Also uses, already defined elsewhere: `days.*`, `sections.*`, `journey.cancel`, `errors.session_full`, `errors.session_cancelled`, `errors.registration_closed`, `errors.occurrence_in_past`.

## Urdu and right-to-left notes

- The schedule sentence `Every {day} at {time}` is one key with two placeholders; Urdu word order differs (`ہر {day} کو {time} بجے`). Never assemble it from parts.
- Venue name and address can be English inside Urdu text: isolate them. The phone number is a left-to-right run.
- The static map is not mirrored. The directions and call buttons stay in the content flow and mirror.
- Facility rows show the check at the start side.
- Today's portion may name a Surah: use the Urdu name in Urdu mode; ayah ranges use Western digits.

## Accessibility notes

- Heading levels: venue name is level 1; Where, Facilities and Sessions are level 2.
- Status (full, cancelled, changed) is text plus an icon and is a status message when it changes while the page is open.
- The register button's name includes the session: "Register for Friday 9:30 pm". A disabled button states why ("This session is full" is next to it, not a tooltip).
- Call and directions buttons say what they open ("Call the venue"), and the phone number is in the name.
- Facilities are a list; absent items are omitted so a screen reader does not read negatives.

## Components used

- Header
- Card
- Button
- ListItem
- Text
- Skeleton
- ErrorState
- EmptyState
- Toast (follow confirmation)
- Avatar (venue mark)

## Data

- `venues.get` (with facilities), `sessions.list`, `sessions.get`, `sessions.occurrences`, `occurrences.get`.
- `follows.create` and `follows.delete`.
- Share card: made by the poster renderer (WP16) from the session; deep link opens this page.

## Open questions

- Show 'seats left' only when capacity is on; otherwise show nothing. Confirmed by the product decision: capacity is optional and off by default.
