# Screen: My Journey

App: User app (tab 3: My Journey). Priority: P0. Written by the ui lane; a human reviews it with the catalog (`docs/design/catalog.md`).

## Purpose

One place for what the person has signed up for and follows: their registrations, the venues and circles they follow, per-session reminders, circle progress and the session companion (the portion of the session, a read-ahead link and the coordinator's recap). Browsing needs no account, but this tab does: signed-out visitors see a short sign-in prompt.

## Layout

1. `Header` (large): "My Journey".
2. **Your registrations** (section title, level 2): upcoming first. Each is a `Card` (pressable) with the session name, venue, date and time, the status (`Chip`-like label: Registered, Waiting list, Cancelled), and the party size. Inside a registered card: the **session companion**: today's portion with "Read ahead" (opens the Quran reader at that portion) and, after the session, the coordinator's recap. A `Switch` "Remind me before this session". A tertiary danger-text button "Cancel registration".
3. **Circle progress**: for each circle the person follows or attends, one `ListItem`: circle name and "Reached: Para 12" (Para, Surah or lesson title). Their own reading position is a separate line pointing to the reader.
4. **Venues and circles you follow** (`ListItem` rows with a chevron): each opens the venue page. A trailing `Switch` is not placed inside a pressable row; alert settings live in Profile.
5. Past registrations are collapsed under a "Show past registrations" tertiary button, newest first.
6. `TabBar` (My Journey selected).

**Cancel confirmation** (`Sheet`): title "Cancel your registration?", text "You can register again later if there is room.", primary danger button "Yes, cancel", tertiary "Keep it".

## States

| State                        | What the person sees                                                                                                                                                                         |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Signed out                   | `EmptyState` with the sign-in title and text, and one primary button "Sign in". The tab bar still works.                                                                                     |
| Loading                      | Skeleton cards (2) and skeleton rows. Announced once.                                                                                                                                        |
| Empty: nothing registered    | `EmptyState`: "You have not registered yet" / "Find a session near you and register in a tap." with the action "Find a session" (goes to Nearby).                                            |
| Empty: nothing followed      | One quiet line: "You are not following anything yet."                                                                                                                                        |
| Empty: no recap              | "No recap yet." inside the companion, only after the session has passed.                                                                                                                     |
| Error                        | `ErrorState` with Try again. A failed cancel shows a `Toast` (danger) with the API message and leaves the card unchanged.                                                                    |
| Offline                      | Registrations and companions that were loaded stay visible with an offline notice. Cancel and reminder changes are disabled with the reason; the reminder state is saved locally and synced. |
| Session changed or cancelled | The card shows the same status line as the session page (changed time in warning-subtle, cancelled in danger-subtle) and the cancel button is replaced by "Remove from list".                |

## Translation keys

English below; Urdu drafts are in `packages/i18n/src/ur/<part>.json` (the part `partOf(key)` names; see `docs/engineering/i18n-keys.md`) under the same keys and carry the draft marker.

| Key                                  | English                                                            | Used for                     |
| ------------------------------------ | ------------------------------------------------------------------ | ---------------------------- |
| `journey.title`                      | My Journey                                                         | Header                       |
| `journey.signIn.title`               | Sign in to see your journey                                        | Signed-out title             |
| `journey.signIn.body`                | You can browse without an account. Sign in to register and follow. | Signed-out text              |
| `journey.signIn.action`              | Sign in                                                            | Signed-out button            |
| `journey.registrations.title`        | Your registrations                                                 | Section title                |
| `journey.registrations.empty.title`  | You have not registered yet                                        | Empty title                  |
| `journey.registrations.empty.body`   | Find a session near you and register in a tap.                     | Empty text                   |
| `journey.registrations.empty.action` | Find a session                                                     | Empty action                 |
| `journey.status.confirmed`           | Registered                                                         | Status label                 |
| `journey.status.waitlisted`          | Waiting list                                                       | Status label                 |
| `journey.status.cancelled`           | Cancelled                                                          | Status label                 |
| `journey.reminder.label`             | Remind me before this session                                      | Reminder switch              |
| `journey.cancel`                     | Cancel registration                                                | Cancel button                |
| `journey.cancel.title`               | Cancel your registration?                                          | Cancel sheet title           |
| `journey.cancel.body`                | You can register again later if there is room.                     | Cancel sheet text            |
| `journey.cancel.confirm`             | Yes, cancel                                                        | Cancel sheet danger button   |
| `journey.cancel.keep`                | Keep it                                                            | Cancel sheet tertiary button |
| `journey.followed.title`             | Venues and circles you follow                                      | Followed section title       |
| `journey.followed.empty`             | You are not following anything yet.                                | Followed empty line          |
| `journey.progress.title`             | Circle progress                                                    | Progress section title       |
| `journey.progress.reached`           | Reached: {portion}                                                 | Progress line                |
| `journey.companion.title`            | Session companion                                                  | Companion title              |
| `journey.companion.recap`            | Recap from the coordinator                                         | Recap title                  |
| `journey.companion.noRecap`          | No recap yet.                                                      | No recap line                |

Also uses, already defined elsewhere: `session.portion.title`, `session.portion.readAhead`, `session.changed`, `session.cancelled`, `quran.continue`, `ui.*`, `errors.*`.

## Urdu and right-to-left notes

- Cards mirror. Status labels sit at the end of the card header (left in Urdu).
- A recap written by the coordinator may be Urdu or English: render with `direction="auto"`; Urdu recaps use Gulzar with the Urdu line height.
- Para, Surah and ayah ranges follow the content package's Urdu names; numbers are Western.
- The danger text button's colour is not the only cue: the word "Cancel" is the cue.

## Accessibility notes

- Each registration card is a group with a name ("Al-Noor Masjid, Friday 9:30 pm, Registered"). Its inner controls (companion link, reminder switch, cancel) remain separate focus stops.
- The cancel dialog moves focus to its title, the danger action is not the default focus ("Keep it" is first in focus order after the title), and Escape or the back action closes it without cancelling.
- The reminder switch says its state in words.
- Past registrations are behind an explicit button so the main list stays short for screen readers.

## Components used

- Header (large)
- Card
- ListItem
- Switch
- Button
- Sheet
- EmptyState
- ErrorState
- Skeleton
- Toast
- TabBar
- Text

## Data

- `registrations.listMine`, `registrations.cancel`, `follows.list`, `follows.update` (reminders and alerts).
- Circle progress and recaps: part of the session and circle data (WP17); read-ahead links use the content package.
- Browser bookmarks import once at first login (separate prompt, owned by the user-app lane).
