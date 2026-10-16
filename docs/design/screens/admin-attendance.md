# Screen: Attendance tick list

App: Admin app. Priority: P0. Written by the ui lane; a human reviews it with the catalog (`docs/design/catalog.md`).

## Purpose

After a session the coordinator records who came. Fast and forgiving: one tap per person, a total headcount for people who did not register, and a short recap and the portion covered, so that registered people can see them in My Journey. It must work with a poor connection: ticks are saved on the phone and sent when possible.

## Layout

1. `Header`: "Attendance" with the session name and date under it.
2. **Headcount** `TextField` (number): "How many people came?" with the help "Include people who did not register."
3. Help line: "Tap a name to tick it."
4. A summary line "{count} ticked" in a status region, and two tertiary buttons: "Tick everyone" and "Clear all".
5. List of `Checkbox` rows (48 dp, whole row tappable): the registrant's name and party size, then a trailing text "Present" when ticked (words, not only a tick).
6. **Recap** (`TextField`, multiline, optional): "Short recap for the class".
7. **Portion covered** (`TextField`): "Portion covered (for example Para 3)".
8. Sticky primary button "Save attendance".

## States

| State         | What the person sees                                                                                                                                                 |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Loading       | Headcount field enabled at once; list shows five skeleton rows.                                                                                                      |
| Empty         | `EmptyState`: "No one has registered for this session." The headcount, recap and portion fields still work.                                                          |
| Saving        | Save busy; checkboxes read only.                                                                                                                                     |
| Success       | `Toast` "Attendance saved.".                                                                                                                                         |
| Saved offline | `Toast` (info): "Saved on this phone. It will be sent when you are online."; the header shows an "Not sent yet" badge until it syncs. The same screen keeps working. |
| Error         | Danger `Toast` with the reason; ticks stay. A failed sync keeps the "Not sent yet" badge and a Try again button.                                                     |
| Conflict      | If someone else saved a different list, the API's 409 message appears with Reload; the coordinator's ticks are not lost until they choose.                           |
| Offline       | As Saved offline; the screen needs no connection once the list has loaded.                                                                                           |

## Translation keys

English below; Urdu drafts are in `packages/i18n/src/ur.json` under the same keys and carry the draft marker.

| Key                                | English                                                                 | Used for                 |
| ---------------------------------- | ----------------------------------------------------------------------- | ------------------------ |
| `admin.attendance.title`           | Attendance                                                              | Header                   |
| `admin.attendance.headcount.label` | Headcount                                                               | Headcount field          |
| `admin.attendance.headcount.help`  | How many people came.                                                   | Headcount help           |
| `admin.attendance.tick.help`       | Tick the people you know. The headcount can be higher.                  | Help line above the list |
| `admin.attendance.present`         | Present                                                                 | Row text when ticked     |
| `admin.attendance.markAll`         | Mark everyone present                                                   | Tick everyone            |
| `admin.attendance.clear`           | Clear all                                                               | Clear all                |
| `admin.attendance.ticked`          | {present} of {total} ticked                                             | Ticked count             |
| `admin.attendance.recap.label`     | Recap note (optional)                                                   | Recap field              |
| `admin.attendance.portion.label`   | Portion read                                                            | Portion field            |
| `admin.attendance.save`            | Save attendance                                                         | Save button              |
| `admin.attendance.saved`           | Attendance saved.                                                       | Saved toast              |
| `admin.attendance.savedOffline`    | Saved on this phone. We will send it when you are online.               | Saved-offline toast      |
| `admin.attendance.empty`           | No one is registered for this session. You can still enter a headcount. | Empty text               |

Also uses, already defined elsewhere: `admin.registrants.party`, `ui.optional`, `errors.*`.

## Urdu and right-to-left notes

- The checkbox sits at the start side of the row; in Urdu it is on the right, by the name.
- "Present" sits at the end side.
- The portion field accepts a Para, Surah or lesson reference typed in either script; it is stored as text and shown with `direction="auto"`.
- The tick mark does not flip. The count uses Western digits.

## Accessibility notes

- Checkboxes use `role="checkbox"` with the person's name; checked state is announced as "checked" (and "Present" is visible text).
- "Tick everyone" and "Clear all" announce the new count; the focus stays on the pressed button.
- The ticked count is a polite status region, updated at most once per second.
- Each row is a 48 dp target and the gap between rows is at least 8 dp so a missed tap does not tick the neighbour.
- Saved-offline state is stated in words, never only a badge colour.

## Components used

- Header
- TextField
- Checkbox
- Button
- Badge
- EmptyState
- Toast
- Skeleton
- Text

## Data

- `adminAttendance.get`, `adminAttendance.put` (replaces the whole list for the session, so retrying is safe).
- Offline queue: ticks and recap stored on the phone, keyed by session, deleted after a successful send and on sign-out.

## Open questions

- Does `adminAttendance.put` accept the recap and portion, or are they a separate call? Contracts lane to confirm.
