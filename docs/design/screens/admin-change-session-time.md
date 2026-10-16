# Screen: Change a session time

App: Admin app. Priority: P0. Written by the ui lane; a human reviews it with the catalog (`docs/design/catalog.md`).

## Purpose

Change when a session happens, for one date or for every future date, and say whether to tell the people who have registered. The most common change is "this Friday we start 30 minutes later", so the fast path is: pick the date, change the time, send. A session can also be cancelled from here.

## Layout

1. `Header`: "Change the time" with the session name under it.
2. "Now: Friday 9:30 pm" (a `Card` with the current schedule).
3. **New date** (`TextField` of type date) and **New time** (`TextField` of type time); native pickers on phones.
4. **Which sessions** (`SegmentedControl`): "Only this date" | "All future dates".
5. **Tell people** `Switch` (default on), label "Tell registered people" and help "They will get a message with the new time."
6. **Reason** (`TextField`, optional): "Reason (optional)".
7. Primary button "Save the new time". Below, a tertiary danger text button "Cancel this session".

**Cancel this session** (`Sheet`): title "Cancel this session?", text "Registered people will be told. This cannot be undone.", danger "Yes, cancel session", tertiary "Keep the session".

## States

| State      | What the person sees                                                                                                                                                    |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Loading    | Current-schedule card skeleton; the form disabled until loaded.                                                                                                         |
| Validation | A date or time in the past: "Choose a time that has not passed." at the field.                                                                                          |
| Saving     | Save busy; fields read only.                                                                                                                                            |
| Success    | `Toast` "The new time is saved." and back to the previous screen. If "Tell registered people" was on, the toast adds how many were told (from the API response).        |
| Error      | Danger `Toast` with the reason; entered values stay.                                                                                                                    |
| Conflict   | If someone else changed the session first (409), an `ErrorState` section: "This session was changed by someone else. Reload to see the new time." with a Reload button. |
| Offline    | Save disabled with the reason; values are kept.                                                                                                                         |
| Cancelled  | After cancelling, the screen shows the session as cancelled (read only) and a link back.                                                                                |

## Translation keys

English below; Urdu drafts are in `packages/i18n/src/ur.json` under the same keys and carry the draft marker.

| Key                             | English                               | Used for                   |
| ------------------------------- | ------------------------------------- | -------------------------- |
| `admin.schedule.title`          | Change session time                   | Header                     |
| `admin.schedule.current`        | Now: {when}                           | Current schedule line      |
| `admin.schedule.date.label`     | New date                              | Date field                 |
| `admin.schedule.time.label`     | New time                              | Time field                 |
| `admin.schedule.scope.label`    | Apply to                              | Scope control label        |
| `admin.schedule.scope.one`      | This session only                     | Scope option               |
| `admin.schedule.scope.all`      | Every session from now on             | Scope option               |
| `admin.schedule.notify.label`   | Tell registered people                | Notify switch              |
| `admin.schedule.notify.help`    | They get a message with the new time. | Notify help                |
| `admin.schedule.reason.label`   | Reason (optional)                     | Reason field               |
| `admin.schedule.error.past`     | Choose a time that has not passed.    | Past date error            |
| `admin.schedule.submit`         | Save new time                         | Save button                |
| `admin.schedule.success`        | Time changed.                         | Success toast              |
| `admin.schedule.cancel.action`  | Cancel this session                   | Cancel session button      |
| `admin.schedule.cancel.title`   | Cancel this session?                  | Cancel sheet title         |
| `admin.schedule.cancel.body`    | Registered people will be told.       | Cancel sheet text          |
| `admin.schedule.cancel.confirm` | Yes, cancel it                        | Cancel sheet danger button |
| `admin.schedule.cancel.keep`    | Keep it                               | Cancel sheet tertiary      |

Also uses, already defined elsewhere: `ui.optional`, `errors.*`.

## Urdu and right-to-left notes

- Dates and times are shown as the person's locale formats them but always with Western digits; the time includes am or pm from the translation.
- Native date and time inputs are left to the operating system and follow the phone's direction; around them our labels mirror.
- The scope control puts its first option at the start side; order does not change in Urdu.
- The reason field uses `direction="auto"`.

## Accessibility notes

- The date and time fields have visible labels and use native input types so assistive technology can use the system pickers.
- The switch's help is tied to it so the consequence is read ("They will get a message with the new time").
- Danger action is last and separate. Both confirmations default focus to the safe option.
- A success or error toast is announced, and focus returns to the control that opened it.

## Components used

- Header
- Card
- TextField
- SegmentedControl
- Switch
- Button
- Sheet
- Toast
- ErrorState
- Skeleton
- Text

## Data

- `adminSessions.changeSchedule` (all future dates) and `adminOccurrences.update` (one date, including cancelling).
- The API computes who to notify; the screen sends only the `notify` flag.

## Open questions

- Is cancelling a session part of `adminOccurrences.update` (status) or a separate call? Contracts lane to confirm.
