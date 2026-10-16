# 0003: UI tooling (styling, test renderer, catalog)

Status: accepted
Date: 2026-10-16
Lane: ui

## Context

The ui lane builds the component kit once for the user app and the admin app (Expo, React Native) and also has to prove it works in light, dark and high contrast, left-to-right and right-to-left, at four text sizes. No phone or simulator is available to agents, so the proof has to run in Node. Other lanes need a way to see the whole kit without a device.

## Options

Styling:

1. React Native `StyleSheet` with the tokens (the brief's proposal).
2. A styling library such as NativeWind, Tamagui or styled-components.

Test renderer:

1. `react-native-web` in `jsdom`, with `@testing-library/react`.
2. `react-test-renderer` with `@testing-library/react-native` and the React Native Jest preset.
3. `happy-dom` instead of `jsdom`.

Catalog:

1. Storybook for React Native or Storybook on web.
2. Expo-based catalog app.
3. A script that renders every component to one static HTML page with `react-native-web` and `react-dom/server`.

## Decision

- **Styling:** option 1. `StyleSheet.create` for fixed layout and plain style objects built from `useTheme()` for anything that depends on mode, direction or text size. No styling library. Layout uses only logical properties (`marginStart`, `paddingEnd`, `flexDirection: 'row'`), and `ThemeProvider` sets `direction`, so the same code mirrors on iOS, Android and web. A source scan test fails on `left`, `right`, `marginLeft` and similar, and on raw colours in components.
- **Test renderer:** option 1 with `jsdom` 29.1.1 (jsdom 30 needs Node 22.22.2 or later, and the repository pins Node 22). Vitest aliases `react-native` to `react-native-web` in `packages/ui/vitest.config.ts`. Tests query by role and accessible name, which is also what a screen reader uses, and read the style that react-native-web applies. It runs inside the existing `pnpm test` with no Jest, Babel or native preset.
- **Catalog:** option 3. `pnpm --filter @qc/ui catalog` bundles `scripts/catalog-entry.tsx` with esbuild (already in the workspace through Vite), runs it in Node and writes `packages/ui/build/catalog/index.html`, a single static page. It shows the tokens with every contrast ratio, the four text sizes, and every component in every mode in English (left to right) and Urdu (right to left). A test builds it on every run, so it cannot rot. `build/` is already git-ignored.
- **Icons:** drawn with views (`Icon`), because an icon font or SVG library would be a new dependency. The set is small on purpose. A decision record is needed to add a library.
- **Internal strings:** the few words the kit says itself (Close, Back, Try again, Loading, "5 unread") are `ui.*` keys in `@qc/i18n`, looked up through the theme's locale. Screens pass their own translated strings as props.

## Consequences

- Easier: the kit is tested on every `pnpm check` with real DOM roles and attributes; reviewers open one HTML file; apps get one `ThemeProvider` and one `useTheme`.
- Harder: jsdom does not measure layout, so mirroring is proved by the logical-properties rule, the `dir` and `direction` settings and the icon flip tests, not by pixel positions. Real-device checks on a low-end Android phone and an iPhone are still required before release (docs/design/accessibility.md).
- Not covered: react-native-web differs from native in small ways (focus ring, hover, text rendering of Nastaliq). The catalog and the tests do not replace a device check.
- Revisit: if a device lab or a Maestro suite arrives (integration lane), add screenshot checks of the catalog. If Expo SDK changes the React Native version, update the `react-native` dev dependency used for types.
- The `peerDependencies` of `@qc/ui` are `react >= 19.3` and `react-native >= 0.88`. The apps pick the exact versions.
