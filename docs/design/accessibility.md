# Accessibility checklist

For the kit and for every screen. It has two parts: the checklist (what must be true), and the results of running it against the kit on 2026-10-16. Screens are checked by the ui lane's design review of each front-end pull request.

Standard: WCAG 2.2 level AA, with the project's stricter rules (48 dp targets, four text sizes, 7:1 in high contrast).

## How the kit is checked

| Method                            | What it covers                                                                                                 | Where                                                          |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Contrast tests on tokens          | Every text, filled and outline pair in light, dark and high contrast                                           | `packages/ui/src/tokens.test.ts`                               |
| Render tests, 24 combinations     | Role, accessible name, state and target size of each component in 3 modes x 2 languages x 4 text sizes         | `components/first-release.test.tsx`, `components/kit.test.tsx` |
| axe-core in jsdom                 | WCAG rules that need only the DOM (names, roles, required attributes, landmarks), on the whole kit and a sheet | `components/a11y.test.tsx`                                     |
| Source scan                       | No left/right layout, no raw colours, no `any`, no hard-coded sentences, every `ui.*` key in both languages    | `src/conventions.test.ts`                                      |
| Catalog                           | A human sees every component in every mode                                                                     | `pnpm --filter @qc/ui catalog`                                 |
| Device checks (not run by agents) | Screen readers, focus, text rendering, real fonts, speed                                                       | See "Checks that need a device"                                |

jsdom has no layout, so axe's colour-contrast rule is off in tests; contrast is proved from the token pairs instead. That is sound because the kit uses only token colours (the source scan fails on a raw colour).

## The checklist

### Perceivable

- [ ] **P1 Contrast.** Text is at least 4.5:1 against its background (7:1 in high contrast). Outlines of inputs, the focus ring and the filled accent are at least 3:1. Disabled text is at least 3:1.
- [ ] **P2 Not colour alone.** Selected, error, success, warning and on/off each have a second cue: an icon, a check, a bar, bold text or words.
- [ ] **P3 Text size.** All four steps work for the whole screen. Nothing clips, overlaps or needs horizontal scrolling at 1.5x. Boxes use `minHeight`, not `height`.
- [ ] **P4 Reflow.** Content works at a 320 dp width.
- [ ] **P5 Images.** Informative images have a text alternative. Decorative ones are hidden from screen readers.
- [ ] **P6 Dark and high contrast.** Nothing disappears: borders, dividers and icons remain visible.
- [ ] **P7 Language.** Text in a different language than the screen has `lang` set (`<Text lang="en">`). Direction is correct in both languages.

### Operable

- [ ] **O1 Touch targets.** Every control is at least 48 dp tall and wide, with space between neighbours.
- [ ] **O2 Keyboard and switch access.** Everything works with a keyboard (web) or switch access (native). Focus is visible (3 dp ring). Focus order follows reading order in both directions.
- [ ] **O3 No gesture-only actions.** Anything done by swipe or long press also has a button.
- [ ] **O4 Time.** Nothing times out while someone is reading it. Toasts with an action do not disappear. Registration has no countdown.
- [ ] **O5 Motion.** Animations are small. With reduced motion on there is none (`reduceMotion`).
- [ ] **O6 Target of an action is clear.** A button's label says what happens. Icon-only buttons have a name.

### Understandable

- [ ] **U1 Plain words.** Short sentences, common words, one word per thing (`docs/design/microcopy.md`).
- [ ] **U2 Labels.** Every field has a visible label above it; a placeholder is never the label. Required and optional are both written.
- [ ] **U3 Errors.** An error says what is wrong and what to do, sits next to the field, has an icon or words (not just red), and is announced.
- [ ] **U4 Confirm the irreversible only.** Cancel registration, delete account, send to many people.
- [ ] **U5 Consistent.** Same component, same place, same wording across screens.
- [ ] **U6 Predictable.** Opening a sheet, changing a filter or typing never moves focus or navigates unexpectedly.

### Robust (screen readers)

- [ ] **R1 Roles.** Buttons are buttons, switches are switches, tabs are tabs in a tablist, radio groups are radiogroups, headings are headings (with level).
- [ ] **R2 Names.** Every interactive element has an accessible name. The name includes what the visible label says.
- [ ] **R3 States.** Disabled, busy, selected, checked and expanded are exposed (`aria-disabled`, `aria-busy`, `aria-selected`, `aria-checked`, `aria-expanded`).
- [ ] **R4 Live changes.** Errors and toasts are announced (`alert` for errors, `status` for the rest). Loading is announced once.
- [ ] **R5 Dialogs.** A sheet is a named dialog, closes with its button, the backdrop and the system back action; focus returns to the control that opened it.
- [ ] **R6 Grouping.** A badge count is read as part of its tab or row, once. Decorative text and icons are hidden.

## Results for the kit, 2026-10-16

Run by the ui lane against `packages/ui` at its first full release. "Pass (auto)" means a test proves it and fails if it regresses. "Manual needed" means it needs a device or a human.

| #   | Result                        | Evidence and notes                                                                                                                                                                                                                                          |
| --- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1  | Pass (auto)                   | 135 token pairs checked (45 per mode); none under its minimum. Lowest margins: `borderStrong` on background 4.63:1 (needs 3), `textMuted` on `surfaceMuted` 5.65:1 (needs 4.5), disabled text 6.15:1 in high contrast (needs 3). Gold is not used for text. |
| P2  | Pass (auto)                   | Chip shows a check when selected; TabBar has a top bar and bold text; Switch writes On or Off; Toast and ErrorState use different icons per kind; Avatar and Badge carry text. Tests: Chip, Toast, Switch.                                                  |
| P3  | Pass (auto) and manual needed | Every component renders at all four sizes with sizes read from the type scale; line height clears 1.3x the font size for all roles and scripts. No component uses a fixed height for text. Overlap at 1.5x on a 320 dp screen needs a device check.         |
| P4  | Manual needed                 | Layout uses flex with wrapping; checked in the catalog only at desktop widths.                                                                                                                                                                              |
| P5  | Pass (auto)                   | Icons are hidden unless labelled; Avatar is an `img` named by the person; Skeleton is hidden except the one announced group.                                                                                                                                |
| P6  | Pass (auto)                   | `highContrast` uses black text, white surfaces and black outlines; Card draws a strong border; Sheet draws a strong top border. Dark mode uses lighter raised surfaces. Visual check by a human in the catalog.                                             |
| P7  | Pass (auto)                   | `Text` takes `lang` and sets the font, direction and alignment; tested for English inside Urdu and Quran text.                                                                                                                                              |
| O1  | Pass (auto)                   | Every Button, IconButton, Chip, ListItem, Switch, SegmentedControl segment, Tab, TextField and Select has `minHeight` of at least 48 in the 24-combination matrix. `Touchable` applies the minimum for every pressable.                                     |
| O2  | Partly                        | Focus ring (3 dp, 2 dp offset) is drawn by `Touchable` on focus; `TextField` shows a focus border. Real keyboard order and switch access need a device or browser check.                                                                                    |
| O3  | Pass (by design)              | The kit has no swipe-only or long-press-only control.                                                                                                                                                                                                       |
| O4  | Pass (auto)                   | Toast with an action, or with `durationMs` 0, never dismisses itself (tested with fake timers). Default 6 s for plain toasts.                                                                                                                               |
| O5  | Pass (auto)                   | `reduceMotion` makes Sheet use no animation. Skeleton is static. The kit has no other animation.                                                                                                                                                            |
| O6  | Pass (auto)                   | `IconButton` requires `accessibilityLabel` by type. Header back button, Sheet close, Toast dismiss and Chip remove have translated names.                                                                                                                   |
| U1  | Reviewed                      | Kit strings reviewed in `docs/design/microcopy.md`. Urdu is a draft.                                                                                                                                                                                        |
| U2  | Pass (auto)                   | TextField and Select always render a visible label and "Required" or "Optional". Tested.                                                                                                                                                                    |
| U3  | Pass (auto)                   | TextField and Select errors use `role="alert"`, `aria-invalid`, `aria-describedby` (web) and the danger text colour; ErrorState is an alert with an icon.                                                                                                   |
| U4  | Not applicable to the kit     | Applies to screens; each screen spec lists its confirmations.                                                                                                                                                                                               |
| U5  | Pass                          | One `Touchable` and one `Text` underlie every control.                                                                                                                                                                                                      |
| U6  | Pass (auto)                   | Select opens a sheet only on press; choosing closes it. No component moves focus by itself.                                                                                                                                                                 |
| R1  | Pass (auto)                   | Roles used: button, checkbox, radio, radiogroup, switch, tab, tablist, dialog, alert, status, heading (with level), img, progressbar (Skeleton only).                                                                                                       |
| R2  | Pass (auto)                   | axe finds no unnamed controls across the whole kit in 12 combinations plus an open sheet. Select's name is "label, current value".                                                                                                                          |
| R3  | Pass (auto)                   | `aria-disabled`, `aria-busy`, `aria-selected`, `aria-checked`, `aria-expanded` asserted in tests.                                                                                                                                                           |
| R4  | Pass (auto)                   | Alerts and status regions asserted; Skeleton group is announced as "Loading" once and repeats are hidden.                                                                                                                                                   |
| R5  | Partly                        | The web dialog is named and closes by button, backdrop and Escape. Returning focus to the opener, and the native back action, need a device check.                                                                                                          |
| R6  | Pass (auto)                   | TabBar folds the badge words into the tab name and hides the badge itself ("Home, 5 unread").                                                                                                                                                               |

Two real problems were found and fixed by running axe: a progress spinner without a name inside loading buttons, and a second unnamed dialog around the sheet on the web. A third (a banner role on the in-screen Header, a list role around loose rows, and a combobox without `aria-controls`) was removed in the design.

## Known gaps

- jsdom cannot test layout. Overlap, clipping and wrapping at 1.5x text, in Urdu, on a 320 dp screen must be looked at in the catalog and on a device.
- The real fonts are not loaded in tests. Gulzar line height and AlMushaf stacking diacritics need a device check.
- Focus return after closing a sheet is not asserted.
- Voice control and switch access are untested.

## Checks that need a device

Run on one low-end Android phone and one iPhone before each release (release lane), and by the owner or a volunteer with the target users:

1. **TalkBack (Android) and VoiceOver (iOS)** through: browse Nearby, open a venue, register with the code step, open My Journey, change text size in Profile. Names and order must make sense in both languages.
2. **Text size 1.5x in Urdu** on a 5-inch phone: no clipped line, no overlapped button, the key action still reachable.
3. **Dark mode and high contrast** in daylight and in a dim room.
4. **Large touch targets** with one hand and a thumb, with an elder who has used few apps.
5. **Reduce motion** on in system settings: sheets appear without sliding.
6. **Keyboard on web (PWA)**: tab through the whole Register flow; the focus ring is always visible; Escape closes a sheet.
7. **System font scale** at the largest setting on top of the app's own: nothing breaks.

## For screens

In a front-end pull request the author ticks P1-P7, O1-O6, U1-U6 and R1-R6 for the screen in the pull request description. The ui lane's review checks the same list and the four states (loading, empty, error, offline).
