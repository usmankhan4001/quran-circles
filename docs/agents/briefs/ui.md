# Brief: ui

Lane: ui (the UI agent)
Work packages: WP21
Wave: 2, and it starts first
Priority: P0
Approval: human design review of the tokens and the component kit

## Goal

Own the visual and interaction design for all three front ends: the design tokens, the shared component kit, the screen specs and flows, and a design review of every front-end pull request. The user app, admin app and content lanes wait on your first component release, so publish early and extend afterwards.

## You own

`packages/ui/` and `docs/design/`.

## You must not touch

`apps/`, `packages/contracts/`, `packages/db/`, `packages/messaging/`. You review front-end work in other lanes but never edit it; you send findings to the lane.

## Read first

`docs/product/experience.md`, `docs/product/features.md`, `docs/product/decisions.md`, `packages/ui/src/tokens.ts` (the starting tokens from V1), and the screens in the V1 app at the repository root for reference.

## Deliverables

1. **Principles.** `docs/design/principles.md`: warm, calm and respectful; plain wording; elders as a design target; right-to-left thought through from the start.
2. **Tokens.** Extend `tokens.ts`: semantic colours (surface, text, accent, success, danger) for light, dark and high contrast; type scale including Urdu (Gulzar needs more line height); the four text sizes; spacing, radii, elevation and motion; 48 dp minimum touch target. Contrast tests for every text and background pair at 4.5:1 or better.
3. **First release (publish before anything else).** `Text`, `Button`, `TextField`, `Chip`, `Card`, `ListItem`, `TabBar`, `Badge` (unread dot and count), `Sheet`. Merge this to the integration branch so the other front-end lanes can start.
4. **Rest of the kit.** `IconButton`, `Select`, `Switch`, `SegmentedControl`, `EmptyState`, `ErrorState`, `Skeleton`, `Toast`, `Avatar`, `Header`.
5. **Modes.** Every component works in light, dark and high contrast, left-to-right and right-to-left, at four text sizes, with loading, disabled and error states, and correct accessibility roles and labels. Render tests prove it.
6. **Catalog.** A page or app that shows every component in every mode, so a human can review the kit. Choose the tool in a decision record.
7. **Screen specs.** `docs/design/screens/<screen>.md` for each P0 screen. User app: Home, Nearby (map, list, filters), venue and session page with facilities, registration with the code step, My Journey, Quran & Prayer, Profile. Admin app: today's registrants, post an update, change a session time, venue and circle editor, attendance tick list. Console: coordinator invites, bulk import with dry run, exports. Each spec states purpose, layout, states (loading, empty, error, offline), translation keys, Urdu and right-to-left notes, accessibility notes, and the components used.
8. **Urdu and right-to-left guide.** Mirroring rules, which icons flip, numerals decision (propose Western or Eastern Arabic digits for Urdu), mixed-direction strings, line heights, and the Quran font used only for Quran text.
9. **Accessibility checklist.** `docs/design/accessibility.md`, run against the kit.
10. **Microcopy.** Review the wording of English text and Urdu drafts in `packages/i18n/` for plainness. Urdu stays marked as draft until a native speaker reviews it.
11. **Poster direction (Wave 4).** Colours, type and layout rules for the renderer lane's templates.
12. **Design review.** For every front-end pull request, check use of tokens and components, states, right-to-left, text sizes and accessibility, and report findings to the author.

Useful skills when available: design-system, design-handoff, accessibility-review, ux-copy, design-critique.

## Definition of done

The first release is published and consumed by at least one lane. The full kit is documented and tested in every mode. A human has reviewed the catalog. P0 screen specs are written. Contrast tests pass. The accessibility checklist has been run. This is part of Gate 2.

## Commands that must pass

```sh
pnpm check
pnpm --filter @qc/ui test
```

## Decisions to respect

Brand: emerald `#064e3b`, gold `#d4af37`, parchment `#fdfcf6`, slate `#0f172a`. Fonts: DM Sans for English, Gulzar for Urdu, AlMushaf for Quran text. Gold is decoration, never body text. Styling is React Native `StyleSheet` with the tokens, with no styling library (proposal; change it only by decision record). No new UI framework without a decision record. The console shares tokens, not components.

## Stand-ins

No device available: render on web and use screenshots. No native Urdu reviewer yet: mark Urdu values as draft.
