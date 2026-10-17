# Fonts bundled with the poster renderer

The renderer embeds these files into every poster it makes (PNG images and PDF files). Each one
keeps its own licence; none is covered by the Quran Circles code licence. They are copies of the
files described in `packages/ui/assets/fonts/LICENSES.md`, unmodified. Typeface decision: D4 in
`docs/design/redesign-decisions.md`; renderer go-ahead: `docs/engineering/decisions/0012-poster-urdu-rendering.md`.

| Role  | Family            | File                                                                       | Licence                   |
| ----- | ----------------- | -------------------------------------------------------------------------- | ------------------------- |
| Latin | Figtree           | `Figtree_400Regular.ttf`, `Figtree_600SemiBold.ttf`, `Figtree_700Bold.ttf` | SIL Open Font License 1.1 |
| Urdu  | Mehr Nastaliq Web | `MehrNastaliqWeb-Regular.ttf`                                              | CC BY-SA 4.0              |

The Quran face (KFGQPC HAFS) is not bundled here: the V2 templates carry no Quran text.

## Figtree

- Copyright 2022 The Figtree Project Authors (https://github.com/erikdkennedy/figtree).
- SIL Open Font License, Version 1.1. Full text in [`Figtree-OFL.txt`](./Figtree-OFL.txt) (copied
  from `packages/ui/assets/fonts/`) and at https://openfontlicense.org.
- Files: byte-for-byte copies from npm `@expo-google-fonts/figtree@0.4.1` (folders `400Regular`,
  `600SemiBold`, `700Bold`). Upright only.

## Mehr Nastaliq Web

- Mehr Nastaliq Web, Version 2.00 (February 14, 2022). © Mehr Type, in collaboration with the Center
  for Speech and Language Technologies (CSaLT), Information Technology University of the Punjab,
  Lahore, Pakistan. Calligraphy by Nasrullah Mehr, font design by Muhammad Zeeshan Nasar.
  https://mehrtype.com/product/mehr-nastaliq-web/
- Licence: Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0),
  https://creativecommons.org/licenses/by-sa/4.0/
- **Unmodified**: byte-for-byte the file in `packages/ui/assets/fonts/` (itself `mehr.ttf` from npm
  `mehr@2.0.1`). Not subset or converted. `src/fonts.test.ts` fails if a checksum below changes.
- Attribution on posters: the font is embedded, not redistributed as a font product; the credit
  above and the in-app credits page (`credits.*` keys) cover it.

## Checksums (SHA-256)

| File                          | Bytes   | SHA-256                                                            |
| ----------------------------- | ------- | ------------------------------------------------------------------ |
| `MehrNastaliqWeb-Regular.ttf` | 132,816 | `1339f7fbf3531908048a0b2965d3c79deb7d41a98614c77ac1d2f691cd6aa373` |
| `Figtree_400Regular.ttf`      | 40,140  | `4e2e9876c4a908c2cbe410ceb648e4724464a84492bd49cb2d6e7b0d3f769a66` |
| `Figtree_600SemiBold.ttf`     | 40,360  | `1b76aae525b51758fc0c9c5096f33d90831657d3ad2fe3c34fb7e666d76f8960` |
| `Figtree_700Bold.ttf`         | 40,324  | `183bf1a8523731738c72be9aa8236453a21d6a3ed70bd8e5266723b212331dc4` |
