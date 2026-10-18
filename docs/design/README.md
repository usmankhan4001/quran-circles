# Design

Written and kept by the ui lane (`docs/agents/briefs/ui.md`). Product context: `docs/product/experience.md`. Code: `packages/ui` (tokens in `src/tokens.ts` and `src/semantic-colors.ts`, components in `src/components`).

The current look is the owner's Iqraa redesign, D17 in `redesign-decisions.md`: deep emerald header, Plus Jakarta Sans, Phosphor icons, Mehr Nastaliq for Urdu and KFGQPC for Quran text. Where an older page below disagrees with D17, D17 wins. The owner's showcase is `apps/console/showcase.html` (source in `apps/console/src/showcase/`).

| File                    | What it is                                                                          |
| ----------------------- | ----------------------------------------------------------------------------------- |
| `redesign-decisions.md` | The redesign decisions D1 to D17, with links to the drawings                        |
| `redesign-handoff.md`   | What each app lane changed to match the redesign                                    |
| `archive/`              | Earlier design briefs kept for the record                                           |
| `principles.md`         | Design principles, tokens, colour modes, type scale, spacing, motion                |
| `catalog.md`            | How to build and read the static component catalog (`pnpm --filter @qc/ui catalog`) |
| `rtl-urdu-guide.md`     | Mirroring rules, icon flip list, numerals, mixed text, fonts, Urdu line height      |
| `accessibility.md`      | The accessibility checklist and the results of running it against the kit           |
| `microcopy.md`          | Wording rules, review of existing messages, questions for the native Urdu reviewer  |
| `poster-direction.md`   | Visual direction for the poster templates                                           |
| `screens/<screen>.md`   | One spec per P0 screen: purpose, layout, states, keys, right-to-left and a11y notes |

## Screen specs

User app: `home`, `nearby`, `venue-and-session`, `registration`, `my-journey`, `quran-and-prayer`, `profile`.

Admin app: `admin-todays-registrants`, `admin-post-update`, `admin-change-session-time`, `admin-venue-and-circle-editor`, `admin-attendance`.

Console: `console-coordinator-invites`, `console-bulk-import`, `console-exports`.

## What a human reviews

Tokens (colours, type scale, spacing), the catalog, and every Urdu string (all Urdu is draft). See `docs/agents/status/ui.md`.
