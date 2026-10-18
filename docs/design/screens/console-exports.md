# Screen: Exports

App: Console (city lead and super admin). Priority: P0. Written by the ui lane; a human reviews it with the catalog (`docs/design/catalog.md`).

## Purpose

Get registrations or attendance out as a CSV file for a city, venue and date range, for reports and for people who work in spreadsheets. Exports contain personal data, so the screen is plain about that, only offers what the person's scope allows, and keeps a short history of what was downloaded. The console is a desktop web app for city and super admins. It shares the kit's tokens, colour modes, type scale, direction helper and `ThemeProvider`; it does not use the phone-first components for tables or wide forms. Where this spec says "form field", "button" or "toast", the console uses the kit's `TextField`, `Button` and `Toast` unchanged, and builds its tables and page shell from tokens only.

## Layout

1. Page header "Export data".
2. **What to export** (`SegmentedControl`): Registrations | Attendance.
3. Filters: City (`Select`), Venue (`Select`, "All venues" by default), Date range (two date `TextField`s). Format: CSV (a single read-only chip; there is no other format).
4. A privacy `Card` (warning-subtle, with the Info icon): "This file has people's names and numbers. Keep it safe and delete it when you have finished."
5. Primary "Make the file". After it runs: "Your file is ready." and a primary "Download" button.
6. **Recent exports** table: Kind, Filters, Created, Created by, and a Download action while the file is still available.

## States

| State         | What the person sees                                                                                                              |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Loading       | Filters load first; the button is disabled until cities and venues are in.                                                        |
| Empty         | Nothing to export for the chosen filters: "There is nothing to export for these choices." and the Download button is not offered. |
| Empty history | "No exports yet."                                                                                                                 |
| Generating    | Button replaced by "Making your file..." and a status region; the filters are read only.                                          |
| Ready         | "Your file is ready." with Download.                                                                                              |
| Error         | `ErrorState` with the reason and Try again; the filters stay.                                                                     |
| Offline       | Make and Download disabled with the reason; history is kept.                                                                      |
| Not allowed   | Scope limits what the selects offer; a request outside scope returns the standard not-allowed `ErrorState`.                       |

## Translation keys

English below; Urdu drafts are in `packages/i18n/src/ur/<part>.json` (the part `partOf(key)` names; see `docs/engineering/i18n-keys.md`) under the same keys and carry the draft marker.

| Key                                  | English                                                                | Used for          |
| ------------------------------------ | ---------------------------------------------------------------------- | ----------------- |
| `console.exports.title`              | Exports                                                                | Page header       |
| `console.exports.kind.registrations` | Registrations                                                          | Kind option       |
| `console.exports.kind.attendance`    | Attendance                                                             | Kind option       |
| `console.exports.filter.city`        | City                                                                   | Filter label      |
| `console.exports.filter.venue`       | Venue                                                                  | Filter label      |
| `console.exports.filter.dates`       | Dates                                                                  | Filter label      |
| `console.exports.format.csv`         | CSV file                                                               | Format chip       |
| `console.exports.generate`           | Create export                                                          | Make button       |
| `console.exports.generating`         | Creating your file                                                     | Progress text     |
| `console.exports.ready`              | Your file is ready                                                     | Ready message     |
| `console.exports.download`           | Download                                                               | Download button   |
| `console.exports.privacy`            | This file has personal details. Share it only with people who need it. | Privacy notice    |
| `console.exports.empty`              | Nothing to export for these filters.                                   | Nothing to export |
| `console.exports.history.title`      | Recent exports                                                         | History title     |
| `console.exports.history.empty`      | No exports yet.                                                        | History empty     |

Also uses, already defined elsewhere: `ui.*`, `errors.*`.

## Urdu and right-to-left notes

- The table and filters mirror in Urdu; the date fields keep their native direction and Western digits.
- The CSV file itself is UTF-8 with a byte order mark so spreadsheets open Urdu names correctly; column headers are English ids.
- The privacy notice is one of the first things read in Urdu; its wording is flagged for the native reviewer.
- Filter chips with the chosen venue use `direction="auto"`.

## Accessibility notes

- Generating and ready are announced in a status region.
- The privacy notice is not a toast: it is part of the page and read in order, before the Make button.
- The Download button is a real link/button with the file kind and date in its name.
- Date fields use native pickers and have text labels.

## Components used

- SegmentedControl
- Select
- TextField
- Chip
- Card
- Button
- Toast
- ErrorState
- EmptyState
- Skeleton
- Text
- Table (console-only, from tokens)

## Data

- `registrations.export` (registrations). Attendance export is not in the P0 contract list; open question.
- Files are generated server-side; the download link is short-lived; the API records who exported what (audit), and the history reads from that.

## Open questions

- Is there an attendance export call? If not, remove the Attendance option for P0.
- How long is an exported file kept? Proposal: 24 hours.
