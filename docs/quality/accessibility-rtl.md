# Accessibility and right-to-left pass (deliverable 5)

Quality lane, WP12. Run on 2026-10-18 against the local stack, so the results are **provisional**. There is no staging yet, and nothing here was checked on a phone or with a screen reader.

## How it was run

```sh
pnpm install
QC_QUALITY=1 pnpm --filter @qc/e2e exec playwright test --project=quality accessibility-rtl
```

The `quality` Playwright project is opt-in. It exists only when `QC_QUALITY=1` is set, so the default e2e run never includes it. Global setup starts the local stack: Postgres with the synthetic seed, the real API and worker, the user and admin web exports, and the console dev server. Each screen then signs in a fresh synthetic account and runs every combination below in one tab. Raw results go to `tests/e2e/node_modules/.cache/qc-e2e/quality/` (`a11y/<screen>.json`, `a11y-summary.json`, `screens/`). Set `QC_QUALITY_STRICT=1` to make serious or critical WCAG violations fail the run. The code is in `tests/e2e/src/quality/` (`accessibility-rtl.spec.ts`, `a11y.ts`, `screens.ts`).

For each screen, the run covers:

- **Language, colour and text size**: English and Urdu × light and dark × text sizes 0 to 3 (16 combinations).
- **High contrast**: the app's own high-contrast mode at text sizes 0 and 3, in both languages. User and admin apps only, because the console has no such mode.
- **Forced colours**: the browser's forced-colours mode (Windows high contrast) at text size 0, in both languages.
- **Reflow at 320 px**: the largest text size at 320 px wide, in both languages. This pass checks layout only.
- **Viewports**: 360 × 800 for the user and admin apps, and 1280 × 800 for the console.
- **Checks**: [axe-core](https://github.com/dequelabs/axe-core) 4.11 with the WCAG 2.0/2.1/2.2 A and AA rules plus best-practice, and the layout and right-to-left probe in `a11y.ts`:
  - `dir` and `lang` on `<html>` and on the content
  - sideways overflow outside a horizontal scroller
  - text clipped by its own box
  - 48 dp targets (checklist O1)
  - mirroring of every kit icon against the guide's flip list
  - arrow characters typed into text
  - Urdu text aligned left
  - the first tab, or the console sidebar, on the start side

Feature flags for memorisation, ayah of the day and the other rc.4 screens were switched on in the throwaway database for the run, and put back afterwards. All data is the synthetic seed: sample venues and sessions, "Quality Attendee" and "Quality Coordinator".

**Coverage:** 17 screens, 392 combinations and 358 axe runs. Every screen rendered in every combination.

| App       | Screens                                                                              |
| --------- | ------------------------------------------------------------------------------------ |
| User app  | Home, Nearby, Session, Registration, My Journey, Quran reader, Profile, Memorisation |
| Admin app | Today (home), Session, Attendance, Daily ayah, Posters                               |
| Console   | Sessions, Bulk import, Daily ayahs, Posters                                          |

## Summary

**axe-core violations.** Each row counts rules per screen. "Elements" is the most elements that failed in any one combination.

| Severity                  | Rules (on screens) | Elements | Lanes                                                |
| ------------------------- | ------------------ | -------- | ---------------------------------------------------- |
| Critical                  | 0                  | 0        | none                                                 |
| Serious (WCAG)            | 3                  | 11       | user-app 3                                           |
| Moderate (best practice)  | 17                 | 132      | user-app 7, admin-app 5, console 4, content 1        |
| Minor                     | 0                  | 0        | none                                                 |
| Colour contrast undecided | 17 screens         | 2–17     | all; axe cannot judge text over gradients and photos |

**Findings from the layout and right-to-left probe and the screenshots** (axe cannot see these):

| ID   | Severity | Owner                   | Finding                                                                                                   |
| ---- | -------- | ----------------------- | --------------------------------------------------------------------------------------------------------- |
| A-01 | Serious  | admin-app               | `<html>` has no `dir` attribute, and `lang` stays `en` in Urdu, on every admin screen                     |
| A-02 | Serious  | user-app                | Stat tiles and the facilities list put `aria-label` on a plain `div`; screen readers skip it              |
| A-03 | Serious  | console                 | At text sizes 2–3, content is wider than a 1280 px window (EN: off the right; UR: off the left)           |
| A-04 | Moderate | console                 | Every console page overflows at 320 px with the largest text (WCAG 1.4.10 Reflow)                         |
| A-05 | Moderate | console                 | Selects are 28 px tall, a checkbox is 24 px and table links are 24 px (project rule: 48 dp)               |
| A-06 | Moderate | user-app (ui)           | The Nearby search field overflows at 320 px with the largest text; the placeholder is cut                 |
| A-07 | Moderate | ui                      | In forced colours, kit icons drawn from boxes lose their shape or vanish                                  |
| A-08 | Moderate | ui, user-app, admin-app | The screens have no landmarks (no `main` or `navigation`), so landmark navigation is impossible           |
| A-09 | Minor    | user-app, admin-app     | Urdu times show a Latin "PM" ("ہر روز 9:00PM بجے"), against guide §5                                      |
| A-10 | Minor    | user-app                | Home in Urdu at the largest size: "PM" wraps to its own line, and the badges cover the bell and tab label |

**What passed automatically**, in all 392 combinations:

- The user app and console set `dir` and `lang` correctly in both languages, and the content direction follows the language in all three apps.
- Every kit icon is mirrored exactly when the guide says so: `chevron-*`, `arrow-*` and `back` flip in Urdu only, and the others never flip.
- No arrow characters are typed into Urdu text, and no Urdu text is aligned left.
- The first tab is on the right in Urdu (Home in the user app, Today in the admin app), and the console sidebar moves to the right.
- No text is clipped by a fixed box (`height` in place of `minHeight`) at any text size.
- At 360 px, the user and admin apps never overflow sideways, even at the largest text size.
- Every control in the user and admin apps meets the 48 dp target.
- axe found no colour-contrast failure. The undecided cases still need a human (see below).

## Findings by screen and owner lane

### user-app

| Screen        | Rule or check                 | Severity                | Elements | Where                          | Detail                                                                                                                                                                                             |
| ------------- | ----------------------------- | ----------------------- | -------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Session       | `aria-prohibited-attr` (A-02) | Serious, WCAG           | 5        | every combination              | `FacilitiesChecklist.tsx`: `aria-label="Women's section: Available"` on a generic `div`, with decorative children. Screen readers ignore the label, so the facilities are silent.                  |
| My Journey    | `aria-prohibited-attr` (A-02) | Serious, WCAG           | 3        | every combination              | Summary stat tiles (`aria-label="Upcoming: 0"`); the numbers and captions are `decorative`.                                                                                                        |
| Memorisation  | `aria-prohibited-attr` (A-02) | Serious, WCAG           | 3        | every combination              | Same stat-tile pattern ("Learning: 0", "Memorised: 0", "Revising").                                                                                                                                |
| Nearby        | overflow at 320 px (A-06)     | Moderate (P3/P4)        | 1        | text size 3, 320 px, EN and UR | `searchbox#nearby-search` spans x 60..338 (EN) and -26..260 (UR) of 320. The placeholder is cut off. See `screens/user-nearby-ur-largest-320.png`.                                                 |
| All 8 screens | `region` (A-08)               | Moderate, best practice | 5–16     | every combination              | No landmark: the screen frame (`components/ScreenFrame.tsx`) has no `main` role, and the tab bar no `navigation` role.                                                                             |
| Home, Session | Urdu time format (A-09, A-10) | Minor                   | n/a      | Urdu                           | "4:30 PM" and "9:00PM" in Latin inside Urdu, plus a doubled "بجے". At size 3, "PM" wraps under the time on Home. See `screens/user-home-ur-largest.png` and `screens/user-session-ur-largest.png`. |

**Suggested fix for A-02:** give the tile a role that carries a name, such as `role="group"` with the label. Or drop `aria-label` and stop marking the visible number and caption `decorative`, so they are read as text. Add the axe check to the app's own render tests.

### admin-app

| Screen        | Rule or check           | Severity                 | Elements | Where             | Detail                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------- | ----------------------- | ------------------------ | -------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| All 5 screens | `dir` and `lang` (A-01) | Serious (WCAG 3.1.1, P7) | page     | every combination | `<html dir="">` in both languages, and `<html lang="en">` in Urdu. The kit wrapper sets the direction, so the layout mirrors correctly, but a screen reader on the web reads Urdu with the English voice. The user app does this right in `AppProviders.tsx` (`ThemeFromPreferences` sets `document.documentElement.lang` and `.dir`); the admin app's `AppearanceProvider` needs the same. |
| All 5 screens | `region` (A-08)         | Moderate, best practice  | 2–12     | every combination | No landmarks.                                                                                                                                                                                                                                                                                                                                                                               |
| Today, all    | forced colours (A-07)   | Moderate                 | n/a      | forced colours    | The bell icon becomes an arch, the Post update icon a "∩", and the tab icons lose their shape. See `screens/admin-home-forced-colours.png`.                                                                                                                                                                                                                                                 |

### console

| Screen                        | Rule or check             | Severity                                                         | Where                                  | Detail                                                                                                                                                                                                                                  |
| ----------------------------- | ------------------------- | ---------------------------------------------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sessions                      | overflow (A-03)           | Serious (project rule P3)                                        | text sizes 2–3 at 1280 px, EN; UR at 3 | Stat tiles ("Waiting for approval" at x 1162..1383 of 1280), the search field and "Add sessions" run past the window. In Urdu at size 3 the first stat tile is cut off at the left edge. See `screens/console-sessions-ur-largest.png`. |
| Sessions, Import, Daily ayahs | overflow at 320 px (A-04) | Moderate (WCAG 1.4.10)                                           | text size 3, 320 px                    | For example, `h1 "Bulk import"` spans x 24..410 of 320, and in Urdu `h1 "آج کی آیت"` spans x -15..296. See `screens/console-import-ur-largest-320.png`.                                                                                 |
| All 4                         | target size (A-05)        | Moderate (passes WCAG 2.5.8 at 24 px; fails the project's 48 dp) | every combination                      | The Language, Colours and Text size selects are 118×28 inside a 64 px box that does not open them. Filter selects are 28 px tall. Table links ("Registrations", "Posters") are about 24 px. A checkbox on Posters is 24×24.             |
| All 4                         | `region` (A-08)           | Moderate, best practice                                          | every combination                      | `.brand-text` and `.shell-user-text` sit outside any landmark.                                                                                                                                                                          |
| All 4                         | forced colours            | Pass                                                             | forced colours                         | Borders, focus and icons stay visible.                                                                                                                                                                                                  |

The probe also reported "nav is not at the left of main" at 320 px. That is not a finding: at that width the sidebar stacks above the content.

### ui (kit)

- **A-07, forced colours.** `Icon` draws its shapes from `View` borders and backgrounds, which forced colours repaint as the canvas.
  - On Home the filled filter button disappears completely.
  - The tab icons, the bell and the "Get directions" icon break up, and the search field loses its border.
  - `HeroHeader`'s decorative pattern turns into a grid of grey shapes.

  Android Chrome has no forced colours, so phones are not affected, but the PWA and the admin app on Windows are. Possible fixes: `forcedColorAdjust: 'none'` on icon art with system colours (`CanvasText`, `ButtonText`), or SVG icons with `currentColor`, plus a check in the catalog. See `screens/user-home-forced-colours.png`.

- **A-08, landmarks.** The `TabBar` could expose `role="navigation"`, and the screen scaffolds `role="main"`. The apps own the frames (`ScreenFrame` in the user app, the shell in the admin app).

### content

| Screen       | Rule            | Severity                | Detail                                                                                                                                                                                                                 |
| ------------ | --------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Quran reader | `region` (A-08) | Moderate, best practice | No landmark around the verse list. Placeholder text stood in for the Quran source during the run (the run has no internet), so line height and stacking marks with real AlMushaf or KFGQPC text need the device check. |

## After fixes (2026-10-18)

The same audit (`QC_QUALITY=1 pnpm --filter @qc/e2e exec playwright test --project=quality accessibility-rtl`) was run again after the fix pass, on a fresh stack with fresh web exports. It covered all 17 screens, 392 combinations (all rendered) and 358 axe runs.

| Measure                                            | Before                                  | After                        |
| -------------------------------------------------- | --------------------------------------- | ---------------------------- |
| Serious axe rules (WCAG)                           | 3 rules, 11 elements (user-app)         | 0                            |
| Moderate axe rules (`region`)                      | 17 rules, 132 elements (all four lanes) | 0                            |
| Any other axe rule (including `landmark-*`)        | 0                                       | 0                            |
| Console target size (combination × element)        | 663                                     | 0                            |
| Console overflow, 1280 px and 320 px               | 74                                      | 0                            |
| User-app overflow (Nearby at 320 px)               | 2                                       | 0                            |
| Admin `dir` and `lang` (A-01, not in this pass)    | 180                                     | 180                          |
| Console "nav is not at the left of main" at 320 px | 4 (not a finding, see above)            | 4 (unchanged, not a finding) |

| ID   | State | Fix                                                                                                                                                                                                                                   |
| ---- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A-01 | Open  | Not in this pass (admin-app `FontGate`, root layout and web template).                                                                                                                                                                |
| A-02 | Fixed | No `aria-label` on role-less tiles and rows; the number and caption are read as text (`FacilitiesChecklist.tsx`, `JourneyScreen.tsx`, `MemorisationScreen.tsx`).                                                                      |
| A-03 | Fixed | Console page is one `minmax(0, 1fr)` column, fixed minimum widths became `min(Xrem, 100%)`, and the split layouts stay one column at text sizes 2 and 3 until the window is wide enough.                                              |
| A-04 | Fixed | Same rules, plus long words break and the shell user block wraps.                                                                                                                                                                     |
| A-05 | Fixed | The whole outlined field box is the control; tick boxes are 48×48 with the box drawn inside; row links, session tabs, credit links, small buttons and segments are at least 48×48.                                                    |
| A-06 | Fixed | The kit `SearchField` input can shrink (`minWidth: 0`).                                                                                                                                                                               |
| A-07 | Fixed | Kit `useForcedColors()`: icons and the admin and user-app glyphs draw in `CanvasText` with `forced-color-adjust: none`, the hero pattern is left out, and the search field and Home filter button have a border forced colours paint. |
| A-08 | Fixed | `main` in the user-app `ScreenFrame` (a sheet is a named modal `dialog`) and the admin `Screen`; `navigation` around the kit `TabBar`; console sidebar is a `<header>` and the tools a named `<section>`. Covers the Quran reader.    |
| A-09 | Open  | Change request with the exact fix in `docs/agents/status/i18n.md` (new `time.period.*` keys, Urdu period before the figures in the three formatters).                                                                                 |
| A-10 | Fixed | Home's time is laid out as figures plus a separate day period on one row (`features/home/clock.ts`); the bell badge and the chosen tab's label sit clear of each other.                                                               |

Notes on the run:

- One screen, admin-attendance, comes from a narrowed run on the same stack and the same admin build (02:21). Its slot in the final full run failed in the harness: a Playwright trace file vanished from the shared `test-results` folder. A retry was refused by the API's per-phone daily sign-in code cap on that stack's database. No admin code changed between the two runs.
- The console is served by its dev server, so a commit made during the run briefly served the old stylesheet. The console screens were measured again after the dev server picked the file up again; the numbers above are from that measurement.
- Still for a person: the device checks above, and the two forced-colours screens (`user-home`, `admin-home`) looked at on a real Windows machine.

## Colour contrast that needs a human

axe left text it could not decide on every screen, because the text sits over a gradient, pattern or photo: the hero headers, the session photo and the console sidebar gradient. The most undecided elements in one combination were 2–10 per user-app screen, 3–6 per admin screen and 15–17 per console screen. A person should check these in light, dark and high contrast, in daylight and in a dim room (ui checklist, device check 3).

## Limits of this pass

- **Not a screen-reader test.** axe and the probe read the DOM of the web exports. TalkBack and VoiceOver on native builds, focus order and focus return after a sheet still need a person.
- **Forced colours is a Windows desktop feature.** Android's own high-contrast-text setting was not emulated.
- **Fonts are the real bundled ones, the text is not.** The Quran text is placeholder text, so real Gulzar or Mehr line height with real Urdu paragraphs needs a device check.

## Checks a human must still do

From the ui lane's checklist, "Checks that need a device":

1. TalkBack (Android) and VoiceOver (iOS) through: browse Nearby, open a venue, register with the code step, open My Journey, change text size in Profile. Do this in both languages, and confirm A-01 and A-02 after their fixes.
2. Text size 1.5x in Urdu on a 5-inch phone: no clipped line, no overlapped button, the key action still reachable. Check Home's time and badges (A-10).
3. Dark and high contrast in daylight and in a dim room, including the undecided contrast above.
4. One-handed thumb use with an elder.
5. Reduce motion on: sheets appear without sliding.
6. Keyboard on the PWA and the console: tab through Register and the console forms. The focus ring must always be visible, and Escape must close a sheet.
7. System font scale at its largest, on top of the app's largest size.
8. Windows high contrast on the console and the PWA (A-07).

## Screenshots

These are small PNGs of the worst cases, all with synthetic data, in `docs/quality/screens/`:

| File                                | Shows                                                                   |
| ----------------------------------- | ----------------------------------------------------------------------- |
| `user-home-ur-largest.png`          | Home, Urdu, largest text: "PM" wraps, badges overlap (A-10)             |
| `user-session-ur-largest.png`       | Session, Urdu, largest text: mirrored back and chevron, Latin PM (A-09) |
| `user-nearby-ur-largest-320.png`    | Nearby at 320 px: search field cut (A-06)                               |
| `user-home-forced-colours.png`      | Home in forced colours: icons and filter button lost (A-07)             |
| `admin-home-forced-colours.png`     | Today in forced colours (A-07)                                          |
| `console-sessions-ur-largest.png`   | Console Sessions, Urdu, largest text: tiles off the left edge (A-03)    |
| `console-import-ur-largest-320.png` | Console Bulk import at 320 px (A-04)                                    |
