# Status: admin-app

Updated: 2026-10-16
Branch: claude/peaceful-archimedes-ain95k (orchestrator commits; nothing committed by this lane)

## Done

WP6 Wave 2 items. Expo SDK 58 + expo-router app in `apps/admin-app`, provable on the web target. Decision record: `docs/engineering/decisions/0010-admin-app-stack.md`.

- Sign-in: phone code (WhatsApp channel) as a coordinator; a person with no staff role sees a "not invited" page and nothing is called. Tokens in the keychain on phones, session storage on the web; one refresh on `token_expired`, sign-out when it fails.
- Scope switcher for people with several roles; a plain line for one role. Lists narrow to the working role. Hide/disable by `can(principal, ...)` from `me.roles`; the server stays the authority.
- Today (sessions in scope) and a session page.
- Registrants of a session's date: names, numbers, party sizes, section, waiting-list tab, search by name, tap-to-call and WhatsApp (`tel:`, `wa.me`; WhatsApp only for people who agreed). No bulk export anywhere; a guard test fails if the source mentions it.
- Post an update: scope from role (venue / city / national), approved template (blanks filled in the text), free text, bilingual, notify toggle, preview of the audience, confirm sheet, real recipient count shown after sending. Updates tab lists what was posted.
- Change a session time (`adminSessions.changeSchedule`): time, length, days, `effectiveFrom`, `notify`; sends only what changed.
- Set portion / recap and cancel or restore one date (`adminOccurrences.update`).
- Attendance tick list: headcount, `Checkbox` ticks that add the party size, "mark everyone present" and "clear all", drop-in names, saves with `adminAttendance.put`.
- Venue editor (create / edit) with the five-item facilities checklist (`Checkbox`) and entrance notes; edit sends only changes. Venue coordinators can edit only their own venue and cannot create.
- Circle editor with the approval flow: a venue coordinator's new circle is pending; city coordinators and admins approve or reject (with a note) via `adminCircles.decide`; `circle_not_pending` is mapped. Places tab lists venues and circles, pending first with a count.
- Account tab: language, text size, colours, sign out.
- Every string through `@qc/i18n` (en and ur added together; Urdu is a draft). LTR/RTL, light/dark and four text sizes covered by the screen tests. Only `@qc/ui` components and tokens; one local `Stepper` marked TODO.
- Tests: 435 passing in 33 files (Vitest + testing-library, react-native-web in jsdom). Unit tests for forms, scope rules per role, error-code mapping (every contract code has an `errors.*` key in both languages), refresh, storage, time, phone, templates. Render tests per screen against an in-memory backend built on `createMockHandler` (no network), in four language/colour/size combinations, with the role matrix (venue, city, admin, multi-role) and the 403 path. Three consecutive full runs were stable.
- Checks run: `pnpm --filter @qc/admin-app typecheck`, `pnpm --filter @qc/admin-app test`, `pnpm exec eslint apps/admin-app`, `pnpm exec prettier --check apps/admin-app` all pass. `expo export --platform web` bundles (output to a scratch folder, not the repo). No native or store build was made.
- Fixed along the way: Places showed another venue's row when a person with two venue roles worked as one of them (now narrowed to the working venue); the attendance form could be overwritten by its own late load (now starts from the loaded data).

## In progress

- Nothing.

## Blocked

- Nothing blocking. Items below work around gaps and wait on the change requests.

## Questions for the orchestrator

- Registrants and numbers: the brief asks for numbers beside call and WhatsApp; `docs/design/screens/admin-todays-registrants.md` says the number is never shown. The build shows it (as a left-to-right run, never logged). Which wins? If hidden, it is a one-line change.
- Extra i18n namespaces beyond the six assigned: `admin.signIn`, `admin.home`, `admin.scope`, `admin.account`, `admin.common`, `admin.places`, `admin.updates`, `admin.tabs`, `admin.occurrence`; plus `admin.registrants.noMatch`. Appended to `en.json` and `ur.json` together, nothing reordered or removed. Please confirm they are acceptable (a new namespace counts as a contract change).
- Sign-in sends the code over `whatsapp`. Is that the intended default channel for coordinators?
- Design specs (written by the ui lane at the same time) ask for things the build does not do yet: offline queue for attendance and a cached registrants list, a session picker and offline note on registrants, "Present" text on ticked rows, recap and portion fields on the attendance screen (they live on the occurrence screen, per the contract), cancelling a whole session from the schedule screen, a map pin picker and "Archive this venue", "Save draft" for circles. None is in the assigned item list. Which should be next?
- `admin.schedule.scope.one` ends in `.one` but is not a plural form ("This session only"); it makes the plural-key type think it is. Unused by this app. Owner of the key should rename it.

## Contract change requests

- `docs/engineering/change-requests/2026-10-16-admin-app-kit-needs.md`: `Stepper`, date and time pickers, phone/chat/search icons.
- `docs/engineering/change-requests/2026-10-16-admin-app-contract-notes.md`: `adminSessions.get` and `adminCircles.get`, a recipient count before sending, server-side template blanks, optional `en` in `LocalizedInput`, export the `Attendance` type, confirm phone fields and where recap/portion live, new i18n namespaces.
