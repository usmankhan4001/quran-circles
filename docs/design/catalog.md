# The component catalog

A single static page that shows every component in light, dark and high contrast, in English (left to right) and Urdu (right to left), plus the four text sizes and the tokens with every contrast ratio. A human reviews the kit by opening it.

## Build and open it

From the repository root:

```sh
pnpm install
pnpm --filter @qc/ui catalog
```

This writes `packages/ui/build/catalog/index.html` (about 1 MB). Open it in any browser: double-click the file, or run `open packages/ui/build/catalog/index.html` on macOS, `xdg-open` on Linux. It is a plain file with no server and no script. `build/` is ignored by git, so each person builds their own copy.

Fonts load from Google Fonts when you are online (DM Sans and Gulzar). Offline, or for AlMushaf (which is not on Google Fonts), the browser uses a fallback font, so judge the line height and layout, not the exact letter shapes. The real fonts are loaded by the apps from their own files.

## What is on the page

- **Tokens.** Every semantic colour in the three modes, and a table of every text and background pair with its contrast ratio and the minimum it must reach. A row turns red and says FAIL if one ever drops below its minimum. The type scale for Latin, Urdu and Quran text with the line height of each. Spacing and radii.
- **Four text sizes.** Text, Button, TextField, Switch, ListItem, Chip and TabBar at all four sizes, in English and Urdu.
- **Every component.** One section each. Each case is drawn in a grid of six cells: light, dark and high contrast, each in English and Urdu. Cases cover the states: default, selected, disabled, loading, error, and the empty and offline states.

## How it is built

`scripts/catalog.mjs` bundles `scripts/catalog-entry.tsx` with esbuild, with `react-native` aliased to `react-native-web`, runs the bundle in Node and renders the whole page with `react-dom/server`. The decision is in `docs/engineering/decisions/0003-ui-tooling.md`. A test (`src/catalog.test.ts`) builds the page on every `pnpm test` and checks it contains every component and no failing contrast row.

When you add or change a component, add a section or a case to `catalog-entry.tsx` in the same pull request.

## What the catalog cannot show

It is a web render. It does not show native text rendering, the real AlMushaf font, touch feedback, the keyboard, screen-reader behaviour or low-end device speed. Those need a phone (`docs/design/accessibility.md`, "Checks that need a device").
