# Poster direction

Visual direction for the renderer lane's templates (WP16, Wave 4). It covers the three formats: story (9:16), print (A4 and A3 PDF) and the link preview image. Posters are bilingual and carry a QR code. Posters are made by the same renderer as invite share cards.

> Superseded in part on 2026-10-17: colours and type now follow `redesign-decisions.md` D3 and D4 (Tanzeem green `#226836`, gilt `#b8913a` for decoration only, Figtree for English, Jameel Noori Nastaleeq for Urdu, KFGQPC for Quran text). The layout, safe areas, QR and fit rules below still apply.

This is direction, not final art. A human approves the first templates after they render in Urdu Nastaliq (the renderer lane's test).

## Colour

- Base: parchment `#fdfcf6` for print and for light templates. Deep emerald `#064e3b` for the dark template. Text is slate `#0f172a` on parchment, parchment on emerald.
- Accent: emerald for the date and the call to action. Gold `#d4af37` for decoration only: a thin rule under the title, a border, an ornament, a corner motif. Never gold text.
- Every text and background pair has at least 4.5:1 contrast (7:1 for small print text). Use `contrastRatio` from `@qc/ui` in the renderer's tests.
- Colours are editable fields in a few templates (the brief says text, colours and language). Offer only a short, approved list of accent colours, each already checked against the template's text colour. The renderer must refuse a combination under 4.5:1.
- Print: design in RGB with an emerald that survives CMYK; avoid large flat dark fills on A3 (ink cost, drying).

## Type

- English: DM Sans. Urdu: Gulzar, set 10% larger than English at the same hierarchy and with a line height of 1.95 times the size. Quran text (an ayah on a poster): AlMushaf only, right to left, at least 2.2 times the size in line height.
- Hierarchy (story format, 1080 x 1920 px as the base):
  - Title (session or circle name): 96 px English, 106 px Urdu, bold English / regular Urdu.
  - Date and time: 72 px, emerald, the largest thing after the title.
  - Venue name and area: 56 px.
  - Details (language, section, teacher, portion): 40 px.
  - Footer (app name, link): 36 px.
  - Nothing below 32 px on the story; nothing below 11 pt in print.
- Never bold Urdu. Emphasise with size and colour.
- Digits: Western (0-9) in both languages, matching the app (`docs/design/rtl-urdu-guide.md`).

## Layout

- Bilingual: English block and Urdu block of equal weight. The poster's language field decides which comes first and which side it sits on: an Urdu-first poster puts Urdu on top or on the right; an English-first poster the opposite. Dividing line in gold.
- Safe margins: 96 px on a 1080 px wide story (9%), with an extra 220 px at the top and 280 px at the bottom of a 9:16 story for the status app's own interface. Print: 12 mm margin plus 3 mm bleed.
- Order, top to bottom: logo and "Quran Circles" mark; title; date and time; venue and address line; one line of details; the QR code with a short line ("Scan to register"); footer link.
- The QR code is at least 28 mm square in print and 280 px on the story, dark on a plain light square with a 4-module quiet zone, never on gold or a pattern. It encodes the session's deep link, which opens registration.
- Locked areas: logo, QR, footer, rule positions. Editable fields: title, date and time, venue, details line, language, accent colour from the approved list.
- Text must fit its box. If a title is too long, the template shrinks it down to a floor (72 px on the story), then wraps to two lines, then refuses and tells the editor to shorten it. It never clips.
- Out-of-date warning: when the session time or venue changes after a poster was made, the poster shows a visible "out of date" band in the preview and in the list, with a Regenerate action. The band is not drawn on exported files.
- The link preview image (1200 x 630) shows title, date, venue and the mark only. No QR.

## Imagery

- Ornament comes from a small set of geometric patterns (eight-point star, arabesque border) drawn in gold at low contrast, behind or around the text, never under body text.
- No photographs of people. No speaker photos (not in V2). No calligraphy of divine names or ayat for decoration; an ayah appears only as quoted Quran text in AlMushaf with its reference.

## Accessibility of images

- A shared poster needs alt text: the renderer returns a plain sentence ("Quran circle at Al-Noor Masjid, Friday 9:30 pm") for the share sheet and the preview tag.
- Print posters in large print: offer A3 so elders can read from a distance.

## Checks the renderer lane runs

1. Contrast of every text and background pair in every template at its largest and smallest allowed text.
2. Fit: longest allowed title, longest venue name, a three-line Urdu paragraph.
3. Urdu Nastaliq renders with joined letters and without clipped descenders in the headless browser.
4. The QR code decodes from the exported image at its smallest size.
