# Status: ui

Updated: 2026-10-16
Branch: lane/ui/wp21 (orchestrator commits; nothing committed by this lane)

## Done

All eleven brief deliverables, in order.

- Tokens and theme: `docs/design/principles.md`; `src/tokens.ts`, `src/semantic-colors.ts` (light, dark, high contrast); `ThemeProvider` and `useTheme` carry colour mode, text size (four steps), direction, reduce motion. RTL helper `src/direction.ts`. Contrast tests cover every text and background pair (135 pairs across three modes) at 4.5:1 (7:1 in high contrast); gold is decoration only.
- Components (20 plus `Icon`), all from `packages/ui/src/index.ts`: Text, Button, TextField, Chip, Card, ListItem, TabBar, Badge, Sheet, IconButton, Select, Switch, SegmentedControl, EmptyState, ErrorState, Skeleton, Toast, Avatar, Header, and Checkbox (added beyond the brief; the facilities list and the attendance tick list need it).
- Tests: 546 passing in 8 files (tokens and contrast, direction, theme, source conventions, first-release and kit components across the 24-combination matrix of 3 modes x 2 locales x 4 text sizes, axe-core a11y checks, catalog build).
- Catalog: `pnpm --filter @qc/ui catalog` writes `packages/ui/build/catalog/index.html` (static, all components in six mode and direction cells, four text sizes, contrast tables). Guide: `docs/design/catalog.md`.
- Decision record: `docs/engineering/decisions/0003-ui-tooling.md` (react-native-web alias, jsdom, testing-library, esbuild catalog, axe-core).
- Docs: `docs/design/` principles, catalog, rtl-urdu-guide, accessibility (checklist with results), poster-direction, microcopy, README index, and 15 screen specs in `docs/design/screens/`.
- i18n: 17 `ui.*` keys and 372 screen keys added to `en.json` and `ur.json` together (no existing key changed or reordered); parity and placeholder tests pass.

## In progress

- Redesign from scratch with the product owner, run as a design conversation. Decisions are recorded in `docs/design/redesign-decisions.md`. The kit and the apps are unchanged until the owner agrees the direction.

## Blocked

- Nothing blocking. Environment note: during the session `/dev/null` was replaced by a regular file (a mistaken `mv ... /dev/null`). Repair attempts were refused by the auto-mode guard, so I stopped. A human or the orchestrator should run `rm /dev/null && mknod -m 666 /dev/null c 1 3` as root (or recreate the container). Nothing in the repo depends on it.

## What a human must review

- Tokens: the palette and the contrast margins (lowest: `borderStrong` on `background` 4.63 against a non-text minimum of 3; `textMuted` on `surfaceMuted` 5.65 against 4.5). `docs/design/principles.md`.
- The catalog: open `packages/ui/build/catalog/index.html` in light, dark, high contrast, at the largest text size, and in Urdu. Fonts are named only (DM Sans, Gulzar, AlMushaf); no font files are committed, so the catalog shows fallback fonts until the apps bundle them.
- All Urdu strings are drafts and carry the draft marker. The native reviewer's questions are in `docs/design/microcopy.md`.
- Poster direction is a proposal.

## Questions for the orchestrator

- Key namespaces `sections.*`, `days.*`, `facilities.*` were added to i18n by this lane; the contracts lane may also define these vocabularies. Confirm there is no collision and who owns them.
- Kit gaps not built (the screens need them): map picker, search field with a clear button, `CodeField` (one-time code entry), `Stepper`, `DateTimeField`, `Table` for the console, `List` virtualisation. Proposed: user-app lane builds the map and code field on top of kit primitives; ui lane adds `Table` and `DateTimeField` in the next pass.
- Checkbox was added beyond the brief; confirm it is wanted in the shared kit.
- Contract questions raised by the screen specs: whether `registrations.forSession` returns phone numbers to coordinators, bulk import dry run and commit calls, attendance export, resend invite, whether cancelling an occurrence is `adminOccurrences.update`, the message length limit.
- The catalog could be published as an Artifact for review if wanted; not done.

## Contract change requests

- None filed yet. The bulk import calls and an attendance export are candidates; see the console specs' open questions. I did not edit contracts.
