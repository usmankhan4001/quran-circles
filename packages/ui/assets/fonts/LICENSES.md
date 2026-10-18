# Bundled fonts and their licences

These fonts ship inside the user app, the admin app and the console (the binaries and the web
pages). Each one keeps its own licence. None of them is covered by the Quran Circles code licence.
The apps show the same credits on screen (user app: Profile, About and credits; console: the
sidebar footer). The redesign's type decision is D4 in `docs/design/redesign-decisions.md`.

| Role  | Family (as used in `fonts` tokens) | File                                                                            | Licence                        |
| ----- | ---------------------------------- | ------------------------------------------------------------------------------- | ------------------------------ |
| Latin | Plus Jakarta Sans                  | npm `@expo-google-fonts/plus-jakarta-sans@0.4.2` (apps), WOFF2 copies in `web/` | SIL Open Font License 1.1      |
| Urdu  | Mehr Nastaliq Web                  | `MehrNastaliqWeb-Regular.ttf` (this folder)                                     | CC BY-SA 4.0                   |
| Quran | KFGQPC Uthmanic Script HAFS        | `KFGQPCUthmanicScriptHAFS-Regular.otf` (this folder)                            | KFGQPC free-use licence (EULA) |

## Plus Jakarta Sans

- Copyright 2020 The Plus Jakarta Sans Project Authors (https://github.com/tokotype/PlusJakartaSans).
- Licensed under the SIL Open Font License, Version 1.1. The full licence text is in
  [`PlusJakartaSans-OFL.txt`](./PlusJakartaSans-OFL.txt) (copied from the package's
  `LICENSE_FONT`) and at https://openfontlicense.org.
- Weights shipped: 400, 500, 600, 700 and 800 (the weights the kit's type roles use), upright only.
  The Expo apps load the unmodified TTFs from the npm package; the web pages load the WOFF2 copies
  below.
- Replaced Figtree as the Latin face on 2026-10-18 (D17, the owner's Iqraa showcase). The Figtree
  licence text stays in [`Figtree-OFL.txt`](./Figtree-OFL.txt) for the record.

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
- **Unmodified** (the TTF). The file is byte-for-byte `mehr.ttf` from npm `mehr@2.0.1`; only the file name on
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

## Web copies (WOFF2)

The web pages (the PWA and the admin app's web target, through `@qc/ui/web-fonts`) load WOFF2
copies of Plus Jakarta Sans and Mehr Nastaliq Web from [`web/`](./web), because WOFF2 is about 40 to 60%
smaller over the network. iOS and Android keep the TTF and OTF files above.

- Written by `scripts/web-fonts.py` (fontTools 4.67.0, brotli 1.2.0) on 2026-10-18. WOFF2 is a
  compressed container for the same font: every table and glyph is kept, nothing is subset,
  renamed or redrawn.
- **Plus Jakarta Sans** (`PlusJakartaSans-400.woff2` to `PlusJakartaSans-800.woff2`): converted
  from the `@expo-google-fonts/plus-jakarta-sans@0.4.2` TTFs. The SIL OFL 1.1 allows this; the
  font declares no Reserved Font Name. The copies stay under the SIL OFL 1.1
  ([`PlusJakartaSans-OFL.txt`](./PlusJakartaSans-OFL.txt)).
- **Mehr Nastaliq Web** (`MehrNastaliqWeb-Regular.woff2`): converted from
  `MehrNastaliqWeb-Regular.ttf` above. A format conversion is an adaptation under CC BY-SA 4.0,
  so the copy is shared under the same licence, CC BY-SA 4.0
  (https://creativecommons.org/licenses/by-sa/4.0/), with the credit above: Mehr Nastaliq Web
  © Mehr Type in collaboration with CSaLT, ITU Punjab, converted to WOFF2 by Quran Circles.
- **KFGQPC Uthmanic Script HAFS is not converted.** Its licence forbids it, so the web pages serve
  the original OTF, and only when Quran text is on screen. `src/web-fonts.test.ts` fails if a
  KFGQPC file appears in `web/`.

| File                                | Bytes  | SHA-256                                                            |
| ----------------------------------- | ------ | ------------------------------------------------------------------ |
| `web/PlusJakartaSans-400.woff2`     | 29,916 | `2840bc540a9d19fd03d707003c00922d4f25fd7cd733e59ed66983c38c40ebb6` |
| `web/PlusJakartaSans-500.woff2`     | 30,936 | `32137504084aeb3f2824d152d5d13d452725af51928c02c2ef9897f309d6d2d0` |
| `web/PlusJakartaSans-600.woff2`     | 30,744 | `1f5332f0cfb1eb025feca2d03e0d61fc31f6dc4fddbd5025a9cb0e5312d0af6d` |
| `web/PlusJakartaSans-700.woff2`     | 30,924 | `44c2af85d93393c5a2d20f653ca503dfcf770b874901506ec91fdd9895b7f39d` |
| `web/PlusJakartaSans-800.woff2`     | 30,144 | `e518a764e20deb7a27a086413fbea6f7c121197cf3e55d88560ca8165376fb6b` |
| `web/MehrNastaliqWeb-Regular.woff2` | 55,996 | `94bc07b5c7408accf76def79d6d4736bbd4b8d0c5034c6239e25c8b7f15aef62` |
