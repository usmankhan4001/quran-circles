# Status: console

Updated: 2026-10-17
Branch: claude/peaceful-archimedes-ain95k (orchestrator commits; nothing committed by this lane)

## Done

WP7 Wave 2 items only (reports, templates and content editing are WP15/WP19 and not started).

- Scaffold: Vite 8, React 19, React Router 7, strict TypeScript. `pnpm --filter @qc/console dev` serves on :5180 and proxies `/v1` and `/health` to the contract mock (`CONSOLE_API_PROXY_TARGET`, default `http://localhost:4010`; run `pnpm --filter @qc/contracts mock`). The only env value is the public `VITE_API_BASE_URL`. Checked by hand: proxy reaches the mock.
- Sign-in with the phone code (`auth.requestCode` / `verifyCode`), Pakistan number helper (accepts `0300 1234567`, `+92...`, Urdu digits; E.164 out). Access token in memory, refresh token in `sessionStorage`, one refresh and one retry on `token_expired`. An account with no console role is told it has no access and signed out.
- Role and scope aware shell: the menu and every page guard come from `can(...)` in `@qc/contracts`. Venue coordinator sees Sessions, Venues, Exports. City coordinator adds Coordinators, Import, Audit log. National admin adds Settings. The server stays the authority.
- Pages: Sessions (city, venue, status filters), Venues (city filter, archived toggle), Registrations per session (totals, filters, CSV export), Exports (session, venue or city), Coordinators (invites list/create/cancel, current role holders, handover with `replacesAssignmentId`, remove access), Audit log (city, venue, record type, date range in Pakistan time), Settings (Hijri offset, season, WhatsApp cap, alert threshold; national admin only), Bulk import (venues, coordinator invites, sessions).
- Bulk import: client-side RFC 4180 parse, rows built with `VenueCreate`, `InviteBody`, `SessionCreate`, per-row report (line, column, plain message, never the cell contents), downloadable problem list. Nothing is sent until the person confirms. A file with any invalid row cannot be applied. Rows that already exist are skipped, so re-running a half-applied file is safe. Apply uses the single create endpoints in order and stops at the first failure.
- Export: audited per-session `registrations.export`; venue and city exports merge the per-session files with a leading `session_id` column and save nothing unless all succeed. UTF-8 byte order mark so Excel reads Urdu.
- All text through `@qc/i18n`, English and Urdu with `lang`/`dir` switching (persisted), light/dark/system, four text sizes (root font size), skip link, labelled fields, real tables with captions and row headers, dialogs that trap focus and return it, logical CSS properties only.
- i18n: 342 `console.*` keys now exist in `en.json` and `ur.json`; I added about 290 of them (`console.shell/nav/roles/scope/phone/signIn/sessions/venues/audit/settings.*` plus more under `console.invites/import/exports.*`). Nothing existing was changed or reordered. Urdu values are drafts under the existing `_meta.status`.
- Tests: 199 passing in 13 files (166 before the redesign), no skips. CSV parser (valid, quotes, BOM, delimiters, malformed, limits), phone/E.164, venue/coordinator/session validators (valid, malformed, duplicate phones, bad E.164, out of scope, duplicates of existing records), apply stops at first failure, nav for each of the three roles (plus none), per-action scope checks, all 24 error codes map to an existing `errors.*` key in both languages, sign-in and refresh flows, forms (invite, sign-in, settings, handover), and render tests of every page against `createMockHandler` in LTR and RTL. A guard test fails on non-logical CSS and on undefined CSS variables.
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

Not matched to the drawn screens (data or endpoints are not in the P0 contract): no KPI row or search on Sessions, no nav count badge, invites stay in a (restyled) dialog and not a side panel, exports have no Attendance kind, date filter or history. The gold privacy banner is used. Gilt is not used (Quran moments only). The import now has a three-step indicator driven by its phase, which replaces difference (1) below. Urdu and Figtree fonts are not installed on the build machine, so the Urdu look was checked with a serif fallback only.

Still open: a real-browser pass for keyboard order and Urdu line heights with the real fonts at the largest size; native Urdu review of the four new strings.

## In progress

- Nothing.

## Blocked

- Nothing blocking. Gaps that need the contract are in the change requests below; each has a working fallback.

## Questions for the orchestrator

- Reconciled with `docs/design/screens/console-*.md`. Deliberate differences from the ui lane's specs: (1) bulk import is one page with a report, not a three-step indicator; (2) the dry run is client-side because the contract has no bulk endpoint, and the spec's "one transaction" does not hold until it does; (3) invites open in a dialog, not a side panel, and there is no Resend action or status filter (no resend call; past invites sit behind a checkbox); (4) exports have no Attendance kind, date filter or history table (not in the P0 contract); (5) circles are not importable (no circle create endpoint). Say if the ui lane wants any of these changed.
- Is the extra `console.*` namespace use fine? I used the three namespaces from the brief and also `console.shell`, `nav`, `roles`, `scope`, `phone`, `signIn`, `sessions`, `venues`, `audit`, `settings`.
- The ui lane's `console.import.confirm` ("Import {count} rows") has no singular form, so the console uses its own `console.import.apply.one/other`. Unused ui-lane keys: `console.import.confirm`, `console.import.file.help`, `console.import.row.error`, `console.import.dryRun.run`, `console.import.step.import`, `console.exports.kind.*`, `console.exports.history.*`, `console.exports.ready`, `console.exports.download`, `console.exports.format.csv`, `console.invites.title`, `console.invites.resend`, `console.invites.role.city`, `console.invites.role.venue`.
- Urdu: the new strings need the native reviewer, especially the handover warning, import messages and the privacy line.
- A real browser pass (keyboard order, Urdu line heights at the largest text size) has not been done; only jsdom.

## Contract change requests

- `docs/engineering/change-requests/2026-10-16-console-bulk-import.md` (transactional import with dry run)
- `docs/engineering/change-requests/2026-10-16-console-export-scope.md` (venue/city/date export in one audited call)
- `docs/engineering/change-requests/2026-10-16-console-user-lookup-handover.md` (hand over to someone with no role yet)
- `docs/engineering/change-requests/2026-10-16-console-contract-ergonomics.md` (missing exported types, `ApiClientError.issues`, resend)
- `docs/engineering/change-requests/2026-10-16-console-ui-tokens-entry.md` (`@qc/ui/tokens` web-safe entry; console imports by relative path until then)
