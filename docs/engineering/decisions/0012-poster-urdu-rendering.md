# 0012: Poster renderer, Urdu Nastaliq in headless Chromium (go)

Status: proposed (go recommended; waiting for the orchestrator to accept)
Date: 2026-10-17
Lane: renderer

## Context

WP16 renders posters and share cards from locked HTML and CSS templates in a headless browser. Before
building anything the brief asks for a go or no-go: does Urdu Nastaliq, and English mixed with Urdu,
come out correctly? The faces are the bundled ones from D4 (`docs/design/redesign-decisions.md`):
Mehr Nastaliq Web (CC BY-SA 4.0, unmodified) for Urdu and Figtree (OFL) for Latin text and for
digits inside Urdu.

## Test

Headless Chromium from Playwright 1.56.1 (the version already in the lockfile, browser build 1194),
fonts embedded as `data:` URLs, no system Urdu font installed, 1080 px wide, device scale 1. Samples:

1. A 96 px Urdu title (ہفتہ وار درسِ قرآن).
2. A three-line Urdu paragraph at 44 px with digits, a time, brackets and Urdu punctuation.
3. Hard joins and descenders at 72 px: ٹھ, پیچھے, لڑکیاں, نئے, izafat zer and hamza (تنظیمِ, مطالعۂ).
4. An English sentence with Urdu inline, and an Urdu sentence with English names and a time inline.
5. The same title with no Nastaliq font (system fallback), as the failure case.
6. White Urdu on Tanzeem green at 120 px, and a bilingual poster stack.

The PNGs were looked at by eye against correct Nastaliq (letter joining, the diagonal cascade of
each word, nuqta placement, ascenders and descenders, word order).

Images (scratch, not committed; re-create with the renderer's sample script):

- `/tmp/claude-0/-home-claude/9b306def-c151-568f-a936-51668de62b06/scratchpad/renderer/urdu-nastaliq-and-mixed.png`
- `/tmp/claude-0/-home-claude/9b306def-c151-568f-a936-51668de62b06/scratchpad/renderer/urdu-mixed-fixed.png`
- `/tmp/claude-0/-home-claude/9b306def-c151-568f-a936-51668de62b06/scratchpad/renderer/urdu-fallback-and-green.png`

## Result

**Go.** HarfBuzz in Chromium shapes Mehr Nastaliq Web correctly: every letter joins, words cascade
on the Nastaliq slope, nuqtas, zer and hamza sit in place, ہ and ھ take their Urdu forms, ے and ی
take their final forms, and nothing is clipped at line-height 2.1. Digits come from Figtree as D4
asks. White on green is clean at large sizes. The fallback case shows what happens without the
bundled font (Naskh shapes and a broken final ہ), so the font must always be embedded and checked.

Three problems were found and each has a rule that fixes it (seen fixed in `urdu-mixed-fixed.png`):

1. **Latin runs inside Urdu reorder.** "9:30 pm" in an Urdu line showed as "pm 9:30". Rule: every
   field value and every Latin or numeric fragment inside an Urdu line is wrapped in an isolate
   (`<bdi dir="ltr">`, or `<bdi dir="rtl">` for Urdu inside English). The templates do this for
   every field; free text never decides direction on its own.
2. **Narrow spaces in Urdu set only in Mehr.** Mehr's space is narrow, so Urdu inline in an English
   line ran together. Rule: Urdu text uses the stack `Figtree, 'Mehr Nastaliq Web'`, so spaces and
   digits come from Figtree and Arabic letters from Mehr.
3. **Tall ascenders and deep descenders.** ط, ٹ and the zer reach the edge of the line box. Rule:
   Urdu line height at least 2.0 (2.1 on posters), no `overflow: hidden` on Urdu text, and fit is
   measured on the rendered box (the template shrinks the text to a floor, then refuses; it never
   clips). Urdu inside an English line is set 1.15 times larger so it reads at the same size.

## Options

- Headless Chromium with the bundled fonts (this test): one engine for PNG and PDF, full OpenType
  shaping, fonts embedded in the PDF.
- Server-side SVG or canvas (for example Satori or node-canvas): no browser, but weaker Nastaliq
  shaping and a second path for PDF.
- Simpler templates with pre-rendered Urdu images: avoids shaping at render time, but every edit
  needs a designer.

## Decision

Headless Chromium (Playwright 1.56.1, `chromium-headless-shell`) with Mehr Nastaliq Web and Figtree
embedded as `data:` URLs, under the three rules above. Fonts are copied unmodified into
`apps/poster-renderer/assets/fonts/` with their licences and checksums.

## Consequences

- The renderer needs a browser image (about 300 MB larger than the api image) with its own memory
  and concurrency limits; see `docs/agents/status/renderer.md` and `infra/docker/poster-renderer.Dockerfile`.
- The Urdu wording on posters is a draft that a native speaker reviews before release, like all
  Urdu in the apps.
- A human still approves the first templates by eye in Urdu, English and mixed (brief, definition
  of done).
- Revisit if the owner moves to a different Nastaliq face: re-run this test with that file.
