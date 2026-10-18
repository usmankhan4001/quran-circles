# Screen: Today's registrants

App: Admin app (Home for a venue coordinator). Priority: P0. Written by the ui lane; a human reviews it with the catalog (`docs/design/catalog.md`).

## Purpose

A coordinator opens the app at the venue and sees, within one tap, who has registered for today's session: names, party sizes and how to reach them. It also lets them see the waiting list. It is read-only; changes to a registration are made by the person or by a call. Used on a phone, often one-handed, with a bad connection.

## Layout

1. `Header`: "Today's registrants" with the venue and circle name under it.
2. A `Select` "Session" (only shown when the coordinator runs more than one session today); default is the next one.
3. Counts: "{count} registered" (plural forms) in a `Card` with the total headcount including parties, and a `Badge` count for the waiting list.
4. A `SegmentedControl`: All | Waiting list.
5. A search `TextField` "Search by name".
6. List of `ListItem`s: name, party size ("Party of {count}"), and two trailing 48 dp `IconButton`s: Call and WhatsApp (they open the phone and WhatsApp with the number; the number itself is not shown on screen). Waiting-list rows carry a "Waiting list" label.
7. Bottom bar: primary button "Take attendance" (goes to the attendance screen).

## States

| State        | What the person sees                                                                                                                                                                    |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Loading      | Counts card and five skeleton rows.                                                                                                                                                     |
| Empty        | `EmptyState`: "No registrations yet" / "People who register will appear here." No action.                                                                                               |
| Empty search | "No one matches your search." Clear search keeps the keyboard open.                                                                                                                     |
| Error        | `ErrorState` with Try again; the last loaded list stays visible under a banner if there is one.                                                                                         |
| Offline      | The list that was last loaded stays, with the line "You are offline. This list may be out of date." Call and WhatsApp still work (they use the phone). Search works on the cached list. |
| Not allowed  | A coordinator without scope for the venue gets the standard not-allowed `ErrorState` from the API's 403; the screen never shows another venue's people.                                 |

## Translation keys

English below; Urdu drafts are in `packages/i18n/src/ur/<part>.json` (the part `partOf(key)` names; see `docs/engineering/i18n-keys.md`) under the same keys and carry the draft marker.

| Key                                 | English                                    | Used for             |
| ----------------------------------- | ------------------------------------------ | -------------------- |
| `admin.registrants.title`           | Today's registrants                        | Header               |
| `admin.registrants.session`         | Session                                    | Session select label |
| `admin.registrants.search`          | Search by name                             | Search field label   |
| `admin.registrants.filter.all`      | All                                        | Segment              |
| `admin.registrants.filter.waitlist` | Waiting list                               | Segment              |
| `admin.registrants.total.one`       | 1 person coming                            | Count, singular      |
| `admin.registrants.total.other`     | {count} people coming                      | Count, plural        |
| `admin.registrants.party`           | Party of {count}                           | Party size           |
| `admin.registrants.call`            | Call                                       | Call button name     |
| `admin.registrants.whatsapp`        | Message on WhatsApp                        | WhatsApp button name |
| `admin.registrants.waitlisted`      | Waiting list                               | Waiting-list label   |
| `admin.registrants.empty.title`     | No one has registered yet                  | Empty title          |
| `admin.registrants.empty.body`      | People who register will appear here.      | Empty text           |
| `admin.registrants.offline`         | You are offline. This list is from {time}. | Offline notice       |

Also uses, already defined elsewhere: `admin.attendance.title` for the bottom button, `ui.*`, `errors.*`.

## Urdu and right-to-left notes

- Rows mirror: name at the start, action buttons at the end (left in Urdu). The order of the two icon buttons does not change.
- Names are a left-to-right or right-to-left run depending on script: use `direction="auto"` and isolate the name from the party text so a Latin name inside Urdu text does not scramble the line.
- Party sizes and counts use Western digits.
- Phone and WhatsApp icons do not flip.

## Accessibility notes

- Call and WhatsApp buttons have names that include the person ("Call Ayesha"), not just "Call". The visible label is the icon; the accessible name is complete.
- Counts update politely when the list refreshes; focus does not move.
- The 48 dp targets are separate from the row, and the row itself is not a button (no action), so a screen reader goes name, party, call, WhatsApp.
- Phone numbers are never read aloud or shown in this list.

## Components used

- Header
- Select
- Card
- Badge
- SegmentedControl
- TextField
- ListItem
- IconButton
- Button
- EmptyState
- ErrorState
- Skeleton

## Data

- `registrations.forSession` (scoped to the coordinator's venue by the API).
- No phone number is sent to the client for display; call and WhatsApp use a short-lived link from the API, or the number only inside the action intent. Open question below.
- Offline cache of the last list, cleared on sign-out.

## Open questions

- Does `registrations.forSession` return the phone number to the coordinator? If it does, it must not be rendered or logged; if it does not, how does Call work? Contracts lane to confirm.
