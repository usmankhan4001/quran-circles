# Status: console

Updated: 2026-10-17
Branch: claude/peaceful-archimedes-ain95k (orchestrator commits; nothing committed by this lane)

## Done

WP7 Wave 2 items only (reports, templates and content editing are WP15/WP19 and not started).

- Scaffold: Vite 8, React 19, React Router 7, strict TypeScript. `pnpm --filter @qc/console dev` serves on :5180 and proxies `/v1` and `/health` to the contract mock (`CONSOLE_API_PROXY_TARGET`, default `http://localhost:4010`; run `pnpm --filter @qc/contracts mock`). The only env value is the public `VITE_API_BASE_URL`. Checked by hand: proxy reaches the mock.
- Sign-in with the phone code (`auth.requestCode` / `verifyCode`), Pakistan number helper (accepts `0300 1234567`, `+92...`, Urdu digits; E.164 out). Access token in memory, refresh token in `sessionStorage`, one refresh and one retry on `token_expired`. An account with no console role is told it has no access and signed out.
- Role and scope aware shell: the menu and every page guard come from `can(...)` in `@qc/contracts`. Venue coordinator sees Sessions, Venues, Exports. City coordinator adds Coordinators, Import, Audit log. National admin adds Settings. The server stays the authority.
- Pages: Sessions (city, venue, status filters), Venues (city filter, archived toggle), Registrations per session (totals, filters, CSV export), Exports (city or venue, with dates), Coordinators (invites list/create/cancel/resend with a status filter, current role holders, handover to a role holder or a phone number, remove access), Audit log (city, venue, record type, date range in Pakistan time), Settings (Hijri offset, season, WhatsApp cap, alert threshold, reminder lead times; national admin only), Bulk import (venues, coordinator invites, sessions).
- Bulk import (rc.2): the console parses the file (RFC 4180) and builds `VenueCreate`, `InviteBody`, `SessionCreate` rows as a first pass, then Check sends them to `adminImport.<kind>` with `dryRun: true`; the server's per-row answer (created, duplicate, invalid with issues) is the authority and is shown by line and column, never with cell contents. Downloadable problem list. Import sends `dryRun: false` once, only after confirmation, and shows the all-or-nothing result: written (with skipped duplicates), or refused with the rows to fix and nothing saved. No per-row create loop.
- Export (rc.2): venue and city exports are one `adminRegistrations.export` call (one audit row) with optional From and To dates; a venue export sends only `venueId`, so a venue coordinator stays in scope. UTF-8 byte order mark added when saving. An empty result is reported, not saved; `too_many_rows` and refused dates are shown at the field or page. A single session's export stays on its Registrations page.
- All text through `@qc/i18n`, English and Urdu with `lang`/`dir` switching (persisted), light/dark/system, four text sizes (root font size), skip link, labelled fields, real tables with captions and row headers, dialogs that trap focus and return it, logical CSS properties only.
- i18n: 342 `console.*` keys now exist in `en.json` and `ur.json`; I added about 290 of them (`console.shell/nav/roles/scope/phone/signIn/sessions/venues/audit/settings.*` plus more under `console.invites/import/exports.*`). Nothing existing was changed or reordered. Urdu values are drafts under the existing `_meta.status`.
- Tests: 229 passing in 13 files (199 before the rc.2 work, 166 before the redesign), no skips. CSV parser (valid, quotes, BOM, delimiters, malformed, limits), phone/E.164, venue/coordinator/session validators (valid, malformed, duplicate phones, bad E.164, out of scope, duplicates of existing records), server dry run merge and all-or-nothing import, nav for each of the three roles (plus none), per-action scope checks, all 24 error codes map to an existing `errors.*` key in both languages, sign-in and refresh flows, forms (invite, sign-in, settings, handover), and render tests of every page against `createMockHandler` in LTR and RTL. A guard test fails on non-logical CSS and on undefined CSS variables.
- Checks run (package scoped): `pnpm --filter @qc/console typecheck`, `test`, `build`; `pnpm exec eslint apps/console`; `pnpm exec prettier --check apps/console docs/agents/status/console.md` all clean.
- Decision record: `docs/engineering/decisions/0006-console-web-tooling.md`.

## Redesign (layout C2) applied, 2026-10-17

The whole console is restyled: sign-in, shell and navigation, Sessions, Venues, Registrations (phone numbers stay visible, per the owner decision of 2026-10-17), Exports, Coordinators and invites and handover, Audit log, Settings, and the bulk import dry run.

- Green sidebar with the eight-point pattern at the start edge (moves to the right in Urdu with no separate rules), light content area, display settings in a bar above the page. Sign-in is one card with a green top.
- Colours, fonts (Figtree, Jameel Noori Nastaleeq, KFGQPC, by name only, no font files), radii, shadows, type roles and line heights are CSS variables generated from the shared tokens in `src/theme/index.tsx`. `src/styles.css` has no raw colour. `src/lib/ui-tokens.ts` re-exports the new token groups (`elevation`, `fontFallbacks`, `contrastRatio`).
- Buttons (primary, secondary, outline, danger, ghost, on-green; loading is the turning eight-point star), outlined fields with the label inside, rounded-square checkboxes, banners with icons, tables, status tags, step indicator on the import, and green-topped dialogs. A careful dialog (remove access, cancel an invite) has the star badge and the safe action first, with the terracotta outline action under it.
- Focus order is skip link, menu, who is signed in, display settings, page. Focus ring is 2px with a 3px gap, white on green.
- Four i18n keys added to `en.json` and `ur.json` together (Urdu draft): `console.shell.brandSub`, `console.shell.toolsLabel`, `console.import.steps.label`, `console.import.step.current`.
- New tests in `src/theme/redesign.test.tsx`: no raw colour outside `lib/ui-tokens.ts` (hex, colour functions, named colours; comments ignored), stricter logical-property check, token variables for both modes, sidebar text contrast on the gradient (light and dark), initials, sidebar and focus order and icon hiding in LTR and RTL, every restyled page in LTR and RTL, import step indicator, careful dialog. 199 tests in 13 files, no skips. Typecheck, eslint, prettier and build clean.

Not matched to the drawn screens (data or endpoints are not in the P0 contract): no KPI row or search on Sessions, no nav count badge, invites stay in a (restyled) dialog and not a side panel, exports have no Attendance kind or history. The gold privacy banner is used. Gilt is not used (Quran moments only). The import now has a three-step indicator driven by its phase, which replaces difference (1) below. Urdu and Figtree fonts are not installed on the build machine, so the Urdu look was checked with a serif fallback only.

Still open: a real-browser pass for keyboard order and Urdu line heights with the real fonts at the largest size; native Urdu review of the four new strings.

## Contract 1.0.0-rc.2 applied, 2026-10-17

- Bulk import on `adminImport.venues | coordinators | sessions` (`src/import/server.ts`, `run.ts`); `import/apply.ts` removed. A file with a broken header or no usable rows is not sent.
- Exports on `adminRegistrations.export` with a date range; the per-session fan-out and `mergeCsvParts` are removed (`csvDataRowCount` added).
- Coordinators: handover dialog chooses "someone who already has a role" (`adminRoles.assign`) or "a phone number" (`adminRoles.invite` with `replacesAssignmentId`). Resend on waiting and expired invites sends a new invite for the same number, role and place. An invite status filter (all, or one of the four contract statuses) replaces the past-invites checkbox.
- `ApiClientError.issues` points server rejections at the field (`fieldIssues` in `src/lib/errors.ts`) on the invite, handover, settings and export forms.
- `StaffRoleAssignment`, `AuditEntry`, `ImportKind`, `ImportResult`, `ValidationIssue` come from `@qc/contracts`; `src/api/types.ts` is removed. The console has no attendance screen, so `Attendance` is not used.
- Settings: reminder lead time for Dora and Circles (5 to 1440 minutes, national admin only), sending only the changed program; the test harness SETTINGS has `reminderLeadMinutes`.
- i18n: 39 keys added to `en.json` and `ur.json` together (Urdu draft): `console.import.issue.invalidReference/areaNotInCity/alreadyThere`, `console.import.refused.*`, `failed.nothingSaved`, `serverChecked`, `importing`, `confirm.allOrNothing`; `console.exports.intro.scoped`, `allVenues`, `filter.from/to`, `dates.*`, `venue.required`, `tooMany`, `sessionHint`, `savedRows.*`; `console.invites.resent`, `filter.*`, `form.rejected`, `handover.mode.*`, `handover.person.hintExisting`, `handover.nobodyYet`, `handover.inviteWarning`, `handover.sendInvite`, `handoverInvited`; `console.settings.lead.*`.
- 229 tests in 13 files, no skips. Typecheck, eslint, prettier and build clean (build has Vite's existing chunk size warning).

## In progress

- Nothing.

## Blocked

- Nothing blocking. Gaps that need the contract are in the change requests below; each has a working fallback.

## Questions for the orchestrator

- Remaining differences from `docs/design/screens/console-*.md`: (1) invites open in a dialog, not a side panel; (2) exports have no Attendance kind or history table (not in the contract); (3) circles are not importable (no circle create endpoint); (4) the drawn import check quotes cell values, the console does not (no personal data in errors); (5) the Exports page has no single-session target (that file is on the session's Registrations page). Say if the ui lane wants any of these changed.
- A resent invite that was a handover does not carry `replacesAssignmentId`: the `Invite` schema does not return it, so the console cannot copy it. Should `Invite` expose it?
- The mock's coordinators import never reports duplicates, so that path is only tested with the console's own check and a stubbed server answer.
- Is the extra `console.*` namespace use fine? I used the three namespaces from the brief and also `console.shell`, `nav`, `roles`, `scope`, `phone`, `signIn`, `sessions`, `venues`, `audit`, `settings`.
- The ui lane's `console.import.confirm` ("Import {count} rows") has no singular form, so the console uses its own `console.import.apply.one/other`. Unused ui-lane keys: `console.import.confirm`, `console.import.file.help`, `console.import.row.error`, `console.import.dryRun.run`, `console.import.step.import`, `console.exports.kind.*`, `console.exports.history.*`, `console.exports.ready`, `console.exports.download`, `console.exports.format.csv`, `console.invites.title`, `console.invites.role.city`, `console.invites.role.venue`.
- Urdu: the new strings need the native reviewer, especially the handover warnings, import refusal messages, reminder lead times and the privacy line.
- A real browser pass (keyboard order, Urdu line heights at the largest text size) has not been done; only jsdom.

## Contract change requests

- Applied in rc.2 and in the console: `2026-10-16-console-bulk-import.md`, `2026-10-16-console-export-scope.md` (Attendance export and history still open), `2026-10-16-console-user-lookup-handover.md`, `2026-10-16-console-contract-ergonomics.md`.
- Open: `docs/engineering/change-requests/2026-10-16-console-ui-tokens-entry.md` (`@qc/ui/tokens` web-safe entry; console imports by relative path until then).
