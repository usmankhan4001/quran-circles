import type { Locale } from '@qc/contracts';
import {
  firstPaintFace,
  fonts,
  installWebFonts,
  waitForWebFont,
  warmWebFonts,
  webFacesOf,
  type FontLoadResult,
} from '@qc/ui/web-fonts';

/**
 * The Figtree weights the first screens set text in besides the language's own face: headings,
 * buttons and labels. English Home uses 500, 600 and 700; Urdu Home uses 700 for numbers.
 */
export const firstScreenWeights: Record<Locale, readonly number[]> = {
  en: [500, 600, 700],
  ur: [700],
};

/**
 * Declares the faces and starts the first screen's other weights downloading, without waiting.
 * The root layout calls it as soon as the saved language is known, while the scripts still run,
 * so those fonts have arrived before the first screen asks for its data.
 */
export function startFonts(locale: Locale, doc: Document = document): void {
  installWebFonts(doc);
  warmWebFonts(doc, webFacesOf(fonts.sans, firstScreenWeights[locale]));
}

/**
 * The web: declares every face (the browser downloads a face only when text uses it) and holds
 * the first frame for the language's face only, Figtree 400 in English and Mehr Nastaliq Web in
 * Urdu. `public/index.html` and `public/boot.js` have already started that download alongside
 * the scripts, so the wait is usually over at once. The other Figtree weights swap in as the
 * screen uses them, and the Quran font loads only when Quran text is shown.
 */
export function loadFirstFonts(
  locale: Locale,
  doc: Document = document,
  timeoutMs?: number,
): Promise<FontLoadResult> {
  installWebFonts(doc);
  return waitForWebFont(doc, firstPaintFace(locale), timeoutMs);
}
