# Screen: Bulk import with dry run

App: Console (city lead and super admin). Priority: P0. Written by the ui lane; a human reviews it with the catalog (`docs/design/catalog.md`).

## Purpose

Load many venues, circles or sessions from a spreadsheet at once, safely. The person uploads a file, runs a **dry run** that checks every row and changes nothing, reads a plain list of problems by row, fixes the file, and only then imports. It must be impossible to import by accident. The console is a desktop web app for city and super admins. It shares the kit's tokens, colour modes, type scale, direction helper and `ThemeProvider`; it does not use the phone-first components for tables or wide forms. Where this spec says "form field", "button" or "toast", the console uses the kit's `TextField`, `Button` and `Toast` unchanged, and builds its tables and page shell from tokens only.

## Layout

A three-step flow with a step indicator (text and numbers: "1 Upload", "2 Check", "3 Import"). Only the current step's content is shown.

**Step 1: Upload**

1. Page header "Import venues and circles".
2. "Download the template" tertiary button.
3. File chooser (`Button` secondary "Choose a file") and a drop area; help "Use the template. CSV files only, up to 5 MB."
4. The chosen file name and size; "Remove" tertiary.
5. Primary "Check the file" (starts the dry run).

**Step 2: Check (dry run)**

1. Title "Check before you import" and help "Nothing is saved yet."
2. While running: progress and "Checking...".
3. Result summary: "{count} rows are ready" and "{count} rows have problems" (plural forms) in two `Card`s; the second is warning-subtle if above zero.
4. If there are problems: a table of problems with the columns Row, Column, Problem ("Row {row}: {problem}"); "Download the list of problems" tertiary button; "Start again" tertiary.
5. If no problems: primary "Import {count} rows".

**Step 3: Import**

1. Progress while importing, then "Done. {count} rows imported." with a link to the venue list and "Start again".

## States

| State                 | What the person sees                                                                                        |
| --------------------- | ----------------------------------------------------------------------------------------------------------- |
| Loading               | Template and permissions load first; the chooser is enabled when ready.                                     |
| Empty                 | No file chosen: the Check button is disabled and the help text explains why.                                |
| Validation            | Wrong file type or too big: field-level error at the chooser ("Choose a CSV file under 5 MB.").             |
| Dry run running       | Progress text, the controls disabled, a Cancel button.                                                      |
| Dry run with problems | Problem list shown; Import is not offered. The first problem is focused.                                    |
| Dry run clean         | Ready count and Import button.                                                                              |
| Importing             | The Import button is replaced by progress; leaving the page asks for confirmation.                          |
| Done                  | Success summary; the uploaded file is cleared from memory.                                                  |
| Error                 | `ErrorState` with the API's reason and Try again; nothing is half-imported (the import is one transaction). |
| Offline               | Upload and import disabled with the reason.                                                                 |

## Translation keys

English below; Urdu drafts are in `packages/i18n/src/ur/<part>.json` (the part `partOf(key)` names; see `docs/engineering/i18n-keys.md`) under the same keys and carry the draft marker.

| Key                                  | English                                   | Used for                 |
| ------------------------------------ | ----------------------------------------- | ------------------------ |
| `console.import.title`               | Bulk import                               | Page header              |
| `console.import.step.upload`         | Choose file                               | Step label               |
| `console.import.step.check`          | Check                                     | Step label               |
| `console.import.step.import`         | Import                                    | Step label               |
| `console.import.file.choose`         | Choose a CSV file                         | File button              |
| `console.import.file.help`           | Use the template. One row for each venue. | File help                |
| `console.import.template.download`   | Download the template                     | Template button          |
| `console.import.dryRun.title`        | Check the file first                      | Check step title         |
| `console.import.dryRun.help`         | Nothing is saved until you confirm.       | Check step help          |
| `console.import.dryRun.run`          | Check file                                | Check button             |
| `console.import.dryRun.running`      | Checking the file                         | Check progress           |
| `console.import.result.ready.one`    | 1 row is ready                            | Ready count, singular    |
| `console.import.result.ready.other`  | {count} rows are ready                    | Ready count, plural      |
| `console.import.result.errors.one`   | 1 row needs fixing                        | Problem count, singular  |
| `console.import.result.errors.other` | {count} rows need fixing                  | Problem count, plural    |
| `console.import.row.error`           | Row {row}: {message}                      | Problem line             |
| `console.import.errors.download`     | Download the problems as a file           | Download problems button |
| `console.import.confirm`             | Import {count} rows                       | Import button            |
| `console.import.done`                | Import finished. {count} rows added.      | Done message             |
| `console.import.startAgain`          | Start again                               | Start again button       |
| `console.import.empty`               | Choose a file to begin.                   | No file chosen text      |

Also uses, already defined elsewhere: `ui.*`, `errors.*`.

## Urdu and right-to-left notes

- The step indicator reads in the page direction (step 1 at the start side); the arrows between steps are mirrored.
- Problem lines may quote spreadsheet cells in Urdu or English: each cell is isolated so the sentence around it keeps its direction.
- The template is the same in both languages (column ids in English); help text in the console is translated.
- Row numbers use Western digits and match the spreadsheet's row numbers.

## Accessibility notes

- The drop area is optional; the "Choose a file" button does the same and is always the first way in.
- Progress is a `progressbar` with a text value; completion and failure are announced.
- The problem list is a real table; keyboard users can move through rows; "Download the list" gives the same data as a file.
- The step indicator marks the current step with text ("Step 2 of 3, Check"), not colour alone.
- A destructive action does not exist here, but Import is guarded: it appears only after a clean dry run, and its label states the count.

## Components used

- Button
- Card
- TextField (read-only file name)
- Toast
- ErrorState
- EmptyState
- Skeleton
- Text
- Table (console-only, from tokens)

## Data

- Bulk import is **not in the P0 API contract.** The screen needs two calls: a dry run that validates and returns per-row problems, and a commit that imports in one transaction. Recorded as a contract change request question for the orchestrator (see the ui status file).
- The file is parsed and validated on the server with the contracts' Zod schemas; the console never trusts its own parse.
- No file content is logged.

## Open questions

- Add `adminImport.dryRun` and `adminImport.commit` to the contract? Owner: contracts lane. Until then this screen is specification only.
- Which entities are in the first import: venues and circles only?
