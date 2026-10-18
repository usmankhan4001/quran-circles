# Status: ui

Updated: 2026-10-18
Branch: lane/ui/wp21 (orchestrator commits; nothing committed by this lane)

## Web fonts for the low-end start (2026-10-18, low-end budgets)

Font assets and loading only; no component changed.

- **WOFF2 copies** in `assets/fonts/web/`: Figtree 400 to 800 (OFL, no Reserved Font Name) and Mehr Nastaliq Web (CC BY-SA 4.0), written by `scripts/web-fonts.py` (fontTools + brotli; the same fonts in a compressed container, nothing subset). The script refuses the KFGQPC font: its licence forbids conversion, so the web keeps the original OTF. `assets/fonts/LICENSES.md` has a "Web copies (WOFF2)" section with the licence notes and sha256 of each file. Figtree goes from about 24 KB to 17 KB a weight, Mehr from 73 KB to 56 KB.
- **`@qc/ui/web-fonts`** (new entry, `src/web-fonts.ts`): `webFontFaces` (the faces under the `fonts` token names), `fontFaceCss` and `installWebFonts` (one `@font-face` rule per face, `font-display: swap`, so the browser downloads a face only when text uses it), `firstPaintFace(locale)` (Figtree 400 in English, Mehr in Urdu: the only face worth holding the first frame for), `waitForWebFont` (through `doc.fonts.load`, never rejects, 3 s timeout), `webFacesOf(family, weights)` and `warmWebFonts` (a `<link rel="preload" as="font" crossorigin>` per face, once each). It re-exports `fonts` so a page's earliest script can name faces without loading the kit.
- `src/font-loading.ts` now holds `fontLoadTimeoutMs`, `FontLoadResult` and `loadFontsWithFallback` (moved out of `font-sources.ts`, which re-exports them), so `web-fonts` does not pull in the TTF files. `font-assets.d.ts` declares `*.woff2`.
- iOS and Android keep `@qc/ui/font-sources` and the TTF/OTF files, unchanged.
- Tests: new `src/web-fonts.test.ts` (12: faces and formats, no converted KFGQPC file, checksums match `LICENSES.md`, CSS escaping, install once, wait loaded/failed/empty/timeout/no font set, preload links). `pnpm --filter @qc/ui test` 934 passing; typecheck, eslint and prettier clean on the changed files.
- The user app and admin app use it (their status files). The bundler names the files by content hash; both apps' `bootPage.test.ts` check that the hard-coded preload URLs in their `public/` pages match these files, so re-running the script means updating those two URLs.

## Accessibility fix pass (2026-10-18, `docs/quality/accessibility-rtl.md`)

- **A-07 (forced colours).** New `src/forcedColors.ts`, exported from the index: `useForcedColors()` (web only, follows the media query), `forcedColorsActive()`, `systemColors.text` (`var(--qc-system-text, CanvasText)`, because react-native-web drops colour names it does not know) and `keepColorsInForcedMode` (`forced-color-adjust: none`). `Icon` draws in the system text colour and keeps its drawing while forced colours are on; `HeroHeader` leaves out its pattern; `SearchField` always has a 1 px border (transparent in light mode) that forced colours can paint.
- **A-06.** The `SearchField` input can shrink below the browser's default width (`minWidth: 0`), so Nearby fits at 320 px at the largest text.
- **A-08.** `TabBar` sits in a `navigation` landmark (`<nav>` on the web); the tab list keeps its name.
- **A-10.** With a badge on the chosen tab, the label starts clear of the badge.
- Tests: new `components/a11y-fixes.test.tsx` (22). Font loading not touched.

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

- Redesign approved by the owner on 2026-10-17 (`docs/design/redesign-decisions.md`, D1 to D16). The kit is rebuilt on it: tokens (Tanzeem green, night green, Figtree / Mehr Nastaliq Web / KFGQPC (fonts now bundled, see below), corners, shadows, type scale), Button (new `outline`, `secondary` is the leaf tint), IconButton (`onHero`), TextField (label inside), Chip and SegmentedControl (solid green choice), Card (raised, radius 22), Sheet (green-topped), Toast (solid green), TabBar (floating). New semantic colours `hero`, `textOnHero`, `heroGlass`, `heroGlassPressed`. Kit tests 553 pass; user-app, admin-app and console tests and typechecks pass unchanged. Screen changes are for the app lanes: `docs/design/redesign-handoff.md`. Added HeroHeader (the green header), SearchField, CodeField, Tag, Banner, SeatMeter, DateStrip, PrayerStrip, SessionCard and ConfirmSheet, with tests across the 24-combination matrix, axe checks and catalog entries (kit tests 825). Keys added in English and draft Urdu: `ui.clearSearch`, `ui.seatsLeft`, `ui.seatsLeftOne`, `ui.seatsFull`, `ui.seatsNoLimit`. Still to build from D7: Stepper (people counter) and the map pieces (MapPin, MapCluster), which depend on the user-app's map view.
- Drawing comparison (owner: "the UI should be like the one in the showcases"). Ran the three apps against the mock and compared them with the drawings. Kit fixes: `HeroHeader` fades into the page with the eight-point pattern (`shape`, `pattern` props, new colour `heroEnd`); `Icon` gains the drawings' line set (home, pin, book, calendar, clock, bell, people, user, filter, route, prayer, share, bookmark, star) so the user app's `Glyph` can go; new `StarNumber`; `TabBar` no longer cuts the chosen label and keeps badges off the label; `Badge` digits use the Latin font in Urdu. Kit tests 880; `pnpm check` passes. The per-screen gap list for the app lanes is in `docs/design/redesign-handoff.md` ("Gap list").

## Fonts bundled (2026-10-17)

Owner decision: bundle the fonts. The `fonts` tokens now name the real families and the apps load the files.

- **Latin: Figtree** (SIL OFL 1.1), weights 400, 500, 600, 700, 800 only (the type roles plus `strong`). Expo apps: unmodified TTFs from `@expo-google-fonts/figtree@0.4.1` (dependency of `@qc/ui`). Console: `@fontsource/figtree@5.3.0`.
- **Urdu: Mehr Nastaliq Web** v2.00 (Mehr Type with CSaLT, ITU Punjab; CC BY-SA 4.0), `packages/ui/assets/fonts/MehrNastaliqWeb-Regular.ttf`, byte-for-byte `mehr.ttf` from npm `mehr@2.0.1`. Fallback chain on the web: Noto Nastaliq Urdu, then serif; on phones the system font.
- **Jameel Noori Nastaleeq is not bundled**: no redistribution licence could be found (it circulates as personal-use freeware) and the ownership of its glyphs is disputed (licence findings in `/mnt/project-files/v2-waves/font-and-translation-licences.md`). It is no longer in any token or fallback chain.
- **Quran: KFGQPC Uthmanic Script HAFS** v0.09, `packages/ui/assets/fonts/KFGQPCUthmanicScriptHAFS-Regular.otf`, byte-for-byte `arabic.otf` from npm `kfgqpc-uthmanic-script-hafs-regular@1.0.0` (sha256 `59e20b24…bb31`). Its licence (KFGQPC EULA: use, copy, distribute free; no sale; no modification) is recorded, not the package's wrong "ISC". Never subset or convert it; `src/fonts.test.ts` fails if the file changes.
- Licences, credits and checksums: `packages/ui/assets/fonts/LICENSES.md`, with `Figtree-OFL.txt` and `KFGQPC-EULA.txt` beside the files.
- Kit API: `fonts` (family names), `fontFallbacks`, `fontStack(token)`, `fontTokenFor(script)`, `sansWeights`; `theme.type()` returns the CSS stack on the web and the family name on iOS and Android. New entry point `@qc/ui/font-sources` (`bundledFonts` in the `expo-font` family shape, `loadFontsWithFallback` with a 3 s cap). `creditGroups` (shared credits list, `credits.*` keys in en and draft ur).
- The catalog still links Figtree and Noto Nastaliq from Google Fonts; it does not load the bundled files.

## Blocked

- Nothing blocking. Environment note: during the session `/dev/null` was replaced by a regular file (a mistaken `mv ... /dev/null`). Repair attempts were refused by the auto-mode guard, so I stopped. A human or the orchestrator should run `rm /dev/null && mknod -m 666 /dev/null c 1 3` as root (or recreate the container). Nothing in the repo depends on it.

## What a human must review

- Tokens: the palette and the contrast margins (lowest: `borderStrong` on `background` 4.63 against a non-text minimum of 3; `textMuted` on `surfaceMuted` 5.65 against 4.5). `docs/design/principles.md`.
- The catalog: open `packages/ui/build/catalog/index.html` in light, dark, high contrast, at the largest text size, and in Urdu. The catalog loads Figtree and Noto Nastaliq Urdu from Google Fonts; the bundled Mehr Nastaliq Web and KFGQPC files are loaded by the apps, not by the catalog.
- All Urdu strings are drafts and carry the draft marker. The native reviewer's questions are in `docs/design/microcopy.md`.
- Poster direction is a proposal.

## Questions for the orchestrator

- Key namespaces `sections.*`, `days.*`, `facilities.*` were added to i18n by this lane; the contracts lane may also define these vocabularies. Confirm there is no collision and who owns them.
- Kit gaps not built (the screens need them): map picker, search field with a clear button, `CodeField` (one-time code entry), `Stepper`, `DateTimeField`, `Table` for the console, `List` virtualisation. Proposed: user-app lane builds the map and code field on top of kit primitives; ui lane adds `Table` and `DateTimeField` in the next pass.
- Checkbox was added beyond the brief; confirm it is wanted in the shared kit.
- The gap list in `docs/design/redesign-handoff.md` is ready for the app lanes. The owner approved the redesign for the apps. The app lanes need assigning to `docs/design/redesign-handoff.md` (user-app, admin-app, console, renderer); the ui lane does not edit `apps/`.
- Contract questions raised by the screen specs: whether `registrations.forSession` returns phone numbers to coordinators, bulk import dry run and commit calls, attendance export, resend invite, whether cancelling an occurrence is `adminOccurrences.update`, the message length limit.
- The catalog could be published as an Artifact for review if wanted; not done.

## Contract change requests

- None filed yet. The bulk import calls and an attendance export are candidates; see the console specs' open questions. I did not edit contracts.
