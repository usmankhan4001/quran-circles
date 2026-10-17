# Bundled fonts and their licences

These fonts ship inside the user app, the admin app and the console (the binaries and the web
pages). Each one keeps its own licence. None of them is covered by the Quran Circles code licence.
The apps show the same credits on screen (user app: Profile, About and credits; console: the
sidebar footer). The redesign's type decision is D4 in `docs/design/redesign-decisions.md`.

| Role  | Family (as used in `fonts` tokens) | File                                                                                 | Licence                        |
| ----- | ---------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------ |
| Latin | Figtree                            | npm `@expo-google-fonts/figtree@0.4.1` (apps), `@fontsource/figtree@5.3.0` (console) | SIL Open Font License 1.1      |
| Urdu  | Mehr Nastaliq Web                  | `MehrNastaliqWeb-Regular.ttf` (this folder)                                          | CC BY-SA 4.0                   |
| Quran | KFGQPC Uthmanic Script HAFS        | `KFGQPCUthmanicScriptHAFS-Regular.otf` (this folder)                                 | KFGQPC free-use licence (EULA) |

## Figtree

- Copyright 2022 The Figtree Project Authors (https://github.com/erikdkennedy/figtree).
- Licensed under the SIL Open Font License, Version 1.1. The full licence text is in
  [`Figtree-OFL.txt`](./Figtree-OFL.txt) (copied from the package's `LICENSE_FONT`) and at
  https://openfontlicense.org.
- Weights shipped: 400, 500, 600, 700 and 800 (the weights the kit's type roles use), upright only.
  The Expo apps load the unmodified TTFs from the npm package; the console loads the Fontsource
  WOFF2/WOFF files for the same weights.

## Mehr Nastaliq Web

- Mehr Nastaliq Web, Version 2.00 (February 14, 2022). © Mehr Type, in collaboration with the Center
  for Speech and Language Technologies (CSaLT), Information Technology University of the Punjab,
  Lahore, Pakistan. Calligraphy by Nasrullah Mehr, font design by Muhammad Zeeshan Nasar.
  https://mehrtype.com/product/mehr-nastaliq-web/
- Licence: Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0),
  https://creativecommons.org/licenses/by-sa/4.0/
- Embedded notice (name ID 13): "Copyright (c) 2022 by Mehr Type in collaboration with Center for
  Speech and Language Technologies (CSaLT), Information Technology University of the Punjab,
  Lahore, Pakistan. Your use of the Mehr Nastaliq Web Font is subject to our Creative Commons
  License, which lets you remix, tweak, and build upon our work even for commercial purposes, as
  long as you credit us and license your new creations under the identical terms."
- **Unmodified.** The file is byte-for-byte `mehr.ttf` from npm `mehr@2.0.1`; only the file name on
  disk changed. The npm package's MIT licence covers that package's code, not the font.
- Replaces Jameel Noori Nastaleeq, which is **not bundled**: no redistribution licence for it could
  be found and the ownership of its glyphs is disputed. Fallbacks when Mehr cannot load: Noto
  Nastaliq Urdu (if the device has it), then the system serif.

## KFGQPC Uthmanic Script HAFS

- KFGQPC Uthmanic Script HAFS, Version 0.09. © 2010 King Fahd Glorious Qur'an Printing Complex
  (KFGQPC), Al-Madinah Al-Munawwarah. Designer: Ashfaq Ahmad Niazi. http://fonts.qurancomplex.gov.sa
- Licence: the KFGQPC end-user licence embedded in the font, reproduced verbatim in
  [`KFGQPC-EULA.txt`](./KFGQPC-EULA.txt). In short: free to **use, copy and distribute**; it may not
  be **sold**, and it may not be **modified, altered, translated or reverse engineered**.
- **Not ISC.** The npm package `kfgqpc-uthmanic-script-hafs-regular@1.0.0` (file `arabic.otf`,
  mirrored from arabicfonts.net) declares "ISC". That is wrong for the font and does not apply.
- **Never modify this file.** No subsetting, no conversion to WOFF/WOFF2, no renaming of internal
  names, no optimising. Every app and the console serve the original OTF. A test in `@qc/ui`
  (`src/fonts.test.ts`) fails if its SHA-256 changes.

## Checksums (SHA-256)

Recorded when the files were copied from the npm tarballs on 2026-10-17 and verified identical to
the tarball contents.

| File                                   | Bytes   | SHA-256                                                            |
| -------------------------------------- | ------- | ------------------------------------------------------------------ |
| `KFGQPCUthmanicScriptHAFS-Regular.otf` | 246,428 | `59e20b2403687a67854fd199861abed3528068c035d2689898465d5faf39bb31` |
| `MehrNastaliqWeb-Regular.ttf`          | 132,816 | `1339f7fbf3531908048a0b2965d3c79deb7d41a98614c77ac1d2f691cd6aa373` |
