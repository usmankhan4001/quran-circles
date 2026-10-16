# Change request: icons and language control the Quran reader needs in the UI kit

Requested by: content
Contract: `@qc/ui` (`Icon`, `ListItem`)
What I need:

1. More icon names: `bookmark`, `bookmark-filled`, `share`, `text-size` (an "Aa"), `search` and `settings`.
2. A `lang` option (`'en' | 'ur' | 'ar'`) on `ListItem` for its `title` and `subtitle`, as `Text` already has.

Why: `docs/design/screens/quran-and-prayer.md` puts a bookmark `IconButton` and a text-size `IconButton` in the reader header, and a bookmark toggle and share on each verse. The kit has 11 icons and none of these, so the reader uses labelled `Button`s ("Add bookmark", "Share", "Reading settings") instead. They work and are accessible, but take more room than icon buttons at large text sizes. The surah list shows the Latin name ("Al-Baqarah") in `ListItem`, which on an Urdu screen is set in the Urdu font, where Latin letters fall back to a system font.

Proposed change: add the six icons to `iconNames` (and mirror none: they do not point). Add `lang` to `ListItem` and pass it to the title and subtitle `Text`.

Affected lanes: ui (owns the kit), user-app (uses the screens), content (I will swap the labelled buttons for `IconButton`s with the same accessibility labels, a small change).

Workaround meanwhile: labelled `Button`s and Latin names in the Urdu font. Nothing is blocked.
