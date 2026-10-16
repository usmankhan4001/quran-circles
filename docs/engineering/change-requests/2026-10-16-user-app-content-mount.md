# Change request: three small things the content package could export for the user app

Requested by: user-app
Contract: `@qc/content` (`ui`)
What I need:

1. Export `useViewState` (or `usePrayerPlace`) from the package index.
2. Let `QuranPrayerTab` take an optional `headerActions` node, shown at the right of its large header.
3. Say which of the package's keys the app may rely on being in both languages (all `quran.*`, `prayer.*` and `home.reading.*` are, today).

Why: (1) the Home card needs the city chosen in the prayer view. The package keeps it in its own saved state, so `src/features/content/contentPackage.tsx` re-reads it every two seconds. (2) Every tab in the app shows the profile avatar at the top right. The app puts its own small header (title and avatar) above the tab, and the tab then shows its own large "Quran" header under it, so there are two headers. With `headerActions` the app would drop its own and pass the avatar in.

Proposed change: add the export and the prop; no change to behaviour when they are not used.

Affected lanes: content, user-app.

Workaround meanwhile: polling in `contentPackage.tsx`; the double header.
