# @qc/ui

The design tokens, the theme and the shared component kit used by the user app and the admin app, plus the bundled fonts. The console uses the same tokens through CSS variables.

Owned by the **ui** lane (WP21, [brief](../../docs/agents/briefs/ui.md)). Design rules and screen specs are in [`docs/design/`](../../docs/design/README.md). Changes to tokens and the kit need a design review.

## What is where

| Path                     | What it is                                                                                                 |
| ------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `src/tokens.ts`          | Colour, spacing, radius and type tokens                                                                    |
| `src/semantic-colors.ts` | Semantic colours for light, dark and high contrast                                                         |
| `src/theme.tsx`          | `ThemeProvider` and `useTheme`: mode, direction (LTR or RTL), text size, locale                            |
| `src/components/`        | The kit: Button, Card, SessionCard, TextField, Sheet, TabBar, PrayerStrip and more                         |
| `src/credits.ts`         | The credits list shown on the apps' About screens                                                          |
| `assets/fonts/`          | Figtree, Mehr Nastaliq Web and KFGQPC Uthmanic Script HAFS with their [licences](assets/fonts/LICENSES.md) |

## Rules the kit enforces

- Layout uses logical properties only, so every component mirrors for Urdu. A test fails on `left`, `right`, `marginLeft` and raw colours in components ([decision 0003](../../docs/engineering/decisions/0003-ui-tooling.md)).
- Every component works in light, dark and high contrast, at four text sizes, in English and Urdu.
- The KFGQPC font file is never modified; a test checks its checksum.

## Commands

```sh
pnpm --filter @qc/ui test
pnpm --filter @qc/ui catalog           # writes build/catalog/index.html, every component in every mode
```
