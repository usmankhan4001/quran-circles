# Font and translation licences: Quran Circles v2

Researched 2026-10-17. The app is free and non-commercial, ships on iOS, Android and as a PWA (Expo), and has a public web console. "Bundling" here means shipping the font file inside the app binary and serving it from our own website.

Container note: from this container, only registry.npmjs.org was reachable. fonts.qurancomplex.gov.sa, tanzil.net, mehrtype.com and api.alquran.cloud all returned a proxy 403. So every font file below was fetched with `npm pack --ignore-scripts`, and each file's name table was read to check its embedded licence. Scratch copies are in `/tmp/claude-0/-home-claude-nearby-dora-quran/9b306def-c151-568f-a936-51668de62b06/scratchpad/fonts/`.

---

## 1. Figtree (Latin UI)

- **Publisher:** Erik Kennedy / "The Figtree Project Authors" (https://github.com/erikdkennedy/figtree), distributed through Google Fonts (https://fonts.google.com/specimen/Figtree).
- **Licence:** SIL Open Font License 1.1 (https://openfontlicense.org). Key clause (OFL condition 2): *"Original or Modified Versions of the Font Software may be bundled, redistributed and/or sold with any software, provided that each copy contains the above copyright notice and this license."* Condition 1 says the font may not be "sold by itself".
- **Bundling in app and website:** Allowed.
- **Notice:** Ship the OFL text and the line `Copyright 2022 The Figtree Project Authors (https://github.com/erikdkennedy/figtree)`. A licences or credits screen counts, and so does the LICENSE file next to the font.
- **npm (checked):**
  - `@expo-google-fonts/figtree@0.4.1`: licence "MIT AND OFL-1.1" (MIT covers Expo's JS loader; `LICENSE_FONT` is the full OFL with the copyright above). Ships static TTFs for 300 to 900 weights plus italics, each about 40 KB, font "Version 2.002". **Use this for the Expo app.**
  - `@fontsource/figtree@5.3.0`: licence OFL-1.1, with matching LICENSE. Ships WOFF/WOFF2 subsets (latin, latin-ext). **Use this for the web console.**
  - Both licences match the publisher's terms.
- **Recommendation:** Allowed. Install the two packages above and add the OFL notice to the in-app licences screen.

---

## 2. Jameel Noori Nastaleeq (Urdu Nastaliq)

- **Publisher / creator:** No authoritative source found. Download sites attribute it to "Jameel Publications, Lahore" (https://www.urdu-nigaar.com/urdu-fonts/jameel-noori-nastaleeq/), and that page itself says *"Confirm the license with Jameel Publications or your download source before commercial use."* There is no official website, no licence file and no embedded licence text.
- **Provenance problem:** Wikimedia rejected the font after a statement from the editor of COMPUTING Karachi that it reuses Noori Nastaliq ligatures: *"Noori Nastaleeq is own by Concept Software Private Limited, India and they have never authorized used of their ligatures in any other fonts."* He concluded it was "not suitable for use" (https://phabricator.wikimedia.org/T62685). Noori Nastaliq itself came from Ahmed Mirza Jamil and Monotype, and was licensed to Concept Software / InPage (https://en.wikipedia.org/wiki/Noori_Nastaliq).
- **Bundling:** **No redistribution licence could be found.** It circulates as "freeware for personal use", which does not grant the right to embed it in a distributed app or serve it from a public website. The ownership of the underlying glyphs is also disputed.
- **npm:** None (`jameel-noori-nastaleeq` and `@fontsource/jameel-noori-nastaleeq` both return 404).
- **Recommendation:** **Do not bundle.** Use one of the open alternatives below. Users who have Jameel Noori installed can still get it through a CSS fallback stack on the web, without us shipping it.

### 2a. Mehr Nastaliq Web (Lahori-style Nastaliq): recommended replacement

- **Publisher:** Mehr Type (Pvt) Ltd with the Center for Speech and Language Technologies (CSaLT), Information Technology University of the Punjab, Lahore. Calligraphy by Nasrullah Mehr, font design by Muhammad Zeeshan Nasar (https://mehrtype.com/product/mehr-nastaliq-web/).
- **Licence:** CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/). Embedded in the font file (name ID 13): *"Your use of the Mehr Nastaliq Web Font is subject to our Creative Commons License, which lets you remix, tweak, and build upon our work even for commercial purposes, as long as you credit us and license your new creations under the identical terms."*
- **Bundling:** Allowed. Shipping the unmodified font in an app or on a site is distribution, which is permitted with attribution. ShareAlike only applies if we *modify the font itself*; it does not apply to our app code.
- **Notice:** Credit "Mehr Nastaliq Web, © Mehr Type, in collaboration with CSaLT, Information Technology University of the Punjab, Lahore", link to the CC BY-SA 4.0 licence, and state any changes (for example "converted to WOFF2" if we convert it).
- **npm (checked):** `mehr@2.0.1` (by Abbas Siddiqi, published 2023-11-15). Ships `mehr.ttf` (133 KB, "Version 2.00 February 14, 2022", copyright Mehr Type) and `mehr.woff`. The package's stated licence is "MIT", but its LICENSE says *"applies to the code in this project, not the font file itself"*. The README states the font is CC BY-SA 4.0, which matches the publisher. Note that the npm `license` field alone does not reflect the font's terms.
- **Recommendation:** Allowed. Use `mehr@2.0.1` for the Lahori look, with the CC BY-SA credit shown in the app.

### 2b. Noto Nastaliq Urdu

- **Publisher:** Google Noto project (Monotype design, updated by Simon Cozens), https://github.com/notofonts/nastaliq.
- **Licence:** SIL OFL 1.1. Same clause and notice duty as Figtree. Copyright line: `Copyright 2022 The Noto Project Authors (https://github.com/notofonts/nastaliq)`. "Noto" is a Google trademark: keep the name if the font is unmodified, and rename it under the OFL's Reserved Font Name rules if it is modified.
- **Bundling:** Allowed.
- **npm (checked):** `@expo-google-fonts/noto-nastaliq-urdu@0.4.2` ("MIT AND OFL-1.1"; TTF 400/500/600/700, about 530 KB each, v3.007) and `@fontsource/noto-nastaliq-urdu@5.3.0` (OFL-1.1, WOFF/WOFF2 arabic and latin subsets). Both licences match the publisher's.
- **Recommendation:** Allowed. This is the safest option legally, and a good fallback or second weight. It is heavier than Mehr (about 530 KB vs 133 KB per weight).

---

## 3. KFGQPC Uthmanic Script HAFS (Quran Arabic)

- **Publisher:** King Fahd Glorious Qur'an Printing Complex, Madinah (https://fonts.qurancomplex.gov.sa/wp02/en/?p=19).
- **Official terms:**
  - The font page states it is free of charge and that *"The Complex reserves the full right to own the aforementioned font, and to reproduce its letters and components. No other individual or party has the right to reprogram or modify its structures or any part of its components, or sell it for a fee, whatever the reason."* The same page says version 2.2 is the latest.
  - The EULA embedded in the font itself (name ID 13, read from the file) says: *"Permission is hereby granted, Free of Cost, to any person obtaining a copy of this Font accompanying this license, the rights to Use, Copy, Distribute, subject to the following conditions: 1. The Font Software cannot be Sold, Modified, Altered, Translated, Reverse Engineered, Decompiled, Disassembled, Reproduced or Attempted to discover the Source Code of this Font in no means. 2. The Font Software is provided "AS IS" …"*
  - Copyright (name ID 0): *"This Font is the property of King Fahd Glorious Quran Printing Complex, and may not be reproduced, modified without the express written approval of King Fahd Glorious Quran Printing Complex."* The same text is catalogued by ScanCode as "Proprietary Free" (https://scancode-licensedb.aboutcode.org/kfgqpc-uthmanic-script-hafs.html).
  - The Complex's general digital-products page says its Mus'haf materials "can be used also in websites, software, and other similar intermediates" (https://dm.qurancomplex.gov.sa/en/?p=138).
- **Bundling in app and website:** **Allowed, with conditions.** The licence grants Use, Copy and Distribute for free, as long as we (a) do not sell the font, (b) ship it **byte-for-byte unmodified**, and (c) keep the embedded EULA, which travels inside the file. Subsetting, glyph edits, renaming, and arguably TTF→WOFF2 conversion count as "modified/altered". So serve the original OTF/TTF on the web as well, and do not run it through a font subsetter or optimiser.
- **Notice:** The licence does not formally require attribution. As a courtesy, and to make it clear that the font is not covered by our app licence, add: "KFGQPC Uthmanic Script HAFS © King Fahd Glorious Qur'an Printing Complex, Madinah. Used unmodified under its free-use licence (fonts.qurancomplex.gov.sa)."
- **Versions and text pairing:**
  - The classic **"KFGQPC Uthmanic Script HAFS" v0.09 (2010)** covers the Arabic Unicode block and is the version widely used with Tanzil's `quran-uthmani` text.
  - The newer "UthmanicHafs1 Ver18/v20/v22" fonts (the official site points to v2.2) are designed for the Complex's own QPC-Hafs text encoding. Quran Foundation pairs `UthmanicHafs1Ver18` with `text_qpc_hafs`, not `text_uthmani` (https://api-docs.quran.foundation/docs/tutorials/fonts/font-rendering/).
  - Our text comes from alquran.cloud `quran-uthmani` (Tanzil Uthmani). With it, use v0.09 or v2.2 and **visually check** marks such as small high/low meem (U+06E2/U+06ED), the waqf signs (U+06D6–U+06DC) and sequential tanween. Tanzil notes that Unicode has no codepoint for sequential tanween, so its standard text encodes them as ordinary tanween (https://tanzil.net/docs/uthmani).
- **npm (checked):** `kfgqpc-uthmanic-script-hafs-regular@1.0.0` ships `arabic.otf` (246 KB). Its name table confirms "KFGQPC Uthmanic Script HAFS", "Version 0.09", designer Ashfaq Ahmad Niazi, with the full KFGQPC EULA embedded (sha256 `59e20b24…bb31`). **However, the package declares licence "ISC". That does not match the publisher's terms and does not apply to the font.** The file is renamed and comes from a third-party mirror (arabicfonts.net), not the Complex. There is no npm package carrying the official v2.2.
- **Recommendation:** Allowed if the file is unmodified. The best option is for the owner to download the official v2.2 (or v0.09) zip from fonts.qurancomplex.gov.sa on a normal machine and commit it as-is. If that is not possible, the npm `arabic.otf` (v0.09) is the genuine KFGQPC file and can be used unmodified (renaming the file on disk is fine; the font data must not change). Either way, record the font's own EULA in our licences file, not "ISC".

---

## 4. Maududi translations and the Arabic text (alquran.cloud / Tanzil)

- **English edition:** alquran.cloud offers **`en.maududi`** (name "Maududi", englishName "Abul Ala Maududi", type translation, format text, ltr) (https://api.alquran.cloud/v1/edition?language=en). A sample ayah 2:2 reads: "This is the Book of Allah: there is no doubt about it. It is guidance to Godfearing people," (https://api.alquran.cloud/v1/ayah/2:2/editions/quran-uthmani,en.maududi,ur.maududi). The same text is Tanzil's `en.maududi` (https://tanzil.net/trans/en.maududi).
  - **Which English work it is:** The wording of Al-Fatiha matches word for word *Towards Understanding the Qur'an*, Zafar Ishaq Ansari's English rendering of Tafhim al-Qur'an (https://islamicstudies.info/quran/towards.php). That book is published by The Islamic Foundation, UK, now Kube Publishing (https://kubepublishing.com/en-ie/collections/quran/products/towards-understanding-the-quran-3). It is **not** Muhammad Akbar's *The Meaning of the Qur'an* (Islamic Publications, Lahore). If the owner specifically wants "The Meaning of the Qur'an", that text is not available on alquran.cloud.
- **Urdu edition:** **`ur.maududi`** (name "ابوالاعلی مودودی", englishName "Abul A'ala Maududi") (https://api.alquran.cloud/v1/edition?language=ur), also sourced from Tanzil (https://tanzil.net/trans/ur.maududi). Original rights: Idara Tarjuman-ul-Quran, Lahore (https://en.wikipedia.org/wiki/Tafhim-ul-Quran).
- **Rights notes:**
  - alquran.cloud gives no per-edition source or rights field (the edition objects have no `source`). Its terms say translations are *"contributed by their rights-holders or sourced from public-domain editions"* and that republishers should credit the translator by name (https://alquran.cloud/terms-and-conditions).
  - Tanzil's translations page says: *"The translations provided at this page are for non-commercial purposes only. If used otherwise, you need to obtain necessary permission from the translator or the publisher. If you are using more than three of the following translations in a website or application, we require you to put a link back to this page"* (quoted via https://opus.nlpl.eu/Tanzil/corpus/version/Tanzil; tanzil.net/trans itself errored when fetched).
  - **Both Maududi texts are still in copyright** (Maududi died in 1979; Ansari's rendering dates from 1988 on). Our free, non-commercial app fits Tanzil's non-commercial permission, but that permission comes from Tanzil, not from Kube or Idara Tarjuman-ul-Quran. Any monetisation (ads, paid tier, donations gating content) would need permission from the publishers.
- **Arabic `quran-uthmani`:** This is Tanzil's Uthmani text. alquran.cloud credits Tanzil: Quran text is *"sourced from various sources, including Tanzil.net and Quran Academy"* (https://alquran.cloud/terms-and-conditions). Tanzil's licence block, which ships inside every Tanzil text file (seen in a mirror at https://raw.githubusercontent.com/OpenITI/0025AH/master/data/0001Quran/0001Quran.Mushaf/0001Quran.Mushaf.Tanzil001-ara1.mARkdown), reads:
  > Tanzil Quran Text … Copyright (C) 2007-… Tanzil Project — License: Creative Commons Attribution 3.0
  > - Permission is granted to copy and distribute verbatim copies of this text, but CHANGING IT IS NOT ALLOWED.
  > - This Quran text can be used in any website or application, provided that its source (Tanzil Project) is clearly indicated, and a link is made to tanzil.net to enable users to keep track of changes.
  > - This copyright notice shall be included in all verbatim copies of the text, and shall be reproduced appropriately in all files derived from or containing substantial portion of this text.
- **Recommendation:** Allowed while the app stays non-commercial.
  - Show the credit line "Quran text: Tanzil Project (tanzil.net), CC BY 3.0, used unmodified" with a live link to https://tanzil.net.
  - Add "English translation: Abul A'la Maududi, *Towards Understanding the Qur'an*, English rendering by Zafar Ishaq Ansari (The Islamic Foundation), via Tanzil.net" and "Urdu translation: Abul A'la Maududi, *Tafhim al-Qur'an* (Idara Tarjuman-ul-Quran), via Tanzil.net".
  - Keep Tanzil's copyright block in any bundled or cached text file, and never alter the Arabic.

---

## Suggested credits / licences screen (all items)

```
Quran text — Tanzil Project (https://tanzil.net), CC BY 3.0. Used verbatim.
English translation — Abul A'la Maududi, "Towards Understanding the Qur'an",
  tr. Zafar Ishaq Ansari (The Islamic Foundation), via Tanzil.net. Non-commercial use.
Urdu translation — Abul A'la Maududi, "Tafhim al-Qur'an" (Idara Tarjuman-ul-Quran),
  via Tanzil.net. Non-commercial use.
KFGQPC Uthmanic Script HAFS — © King Fahd Glorious Qur'an Printing Complex, Madinah.
  Free-use licence; distributed unmodified.
Mehr Nastaliq Web — © Mehr Type with CSaLT, ITU Punjab, Lahore. CC BY-SA 4.0
  (https://creativecommons.org/licenses/by-sa/4.0/).
Figtree — © 2022 The Figtree Project Authors. SIL Open Font License 1.1.
Noto Nastaliq Urdu (if used) — © 2022 The Noto Project Authors. SIL OFL 1.1.
```
Include the full OFL 1.1 text once, next to the fonts and in the licences screen.
