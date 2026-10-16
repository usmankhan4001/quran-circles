# Change request: pressable avatar and font loading in the UI kit

Requested by: user-app
Contract: `@qc/ui` (`Avatar`, fonts)
What I need:

1. A pressable `Avatar` (an `onPress` and an `accessibilityLabel`, with the 48 px touch target), or an `AvatarButton`.
2. A way to load the three font families the theme names (DM Sans, Gulzar, AlMushaf): the font files in the package and one call or hook the app runs at start (`useKitFonts()` returning `ready`).

Why: (1) every tab has the person's avatar at the top right, which opens Profile. Today `apps/user-app/src/components/ProfileButton.tsx` wraps `Avatar` in a `Pressable` (marked TODO). (2) The kit sets text in those families, but no font files ship, so Urdu falls back to a system font and Latin to the system sans. Urdu is the main language for many users, so this is visible.

Proposed change: (1) add `onPress` to `Avatar` or export `AvatarButton`; (2) commit the font files with their licences and export a loader that works with `expo-font` on phones and `@font-face` on the web.

Affected lanes: ui (owns the kit), user-app (deletes its wrapper and calls the loader), console (the same web fonts).

Workaround meanwhile: the local `ProfileButton` wrapper; system fonts.
