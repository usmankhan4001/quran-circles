import type { FontFamilyDefinition } from 'expo-font';
import type { Locale } from '@qc/contracts';
import {
  firstPaintFace,
  fonts,
  installWebFonts,
  waitForWebFont,
  urduDisplayFace,
  warmWebFonts,
  webFacesOf,
} from '@qc/ui/web-fonts';

/** The page's language: `public/boot.js` sets it from the saved appearance before any script. */
export function pageLocale(doc: Document): Locale {
  return doc.documentElement.lang === 'ur' ? 'ur' : 'en';
}

/**
 * The Figtree weights the first screens set text in besides the language's own face: headings,
 * buttons and labels in English, numbers in Urdu.
 */
export const firstScreenWeights: Record<Locale, readonly number[]> = {
  en: [500, 600, 700],
  ur: [700],
};

/**
 * Declares the faces and starts the first screen's other weights downloading, without waiting.
 * The root layout calls it while the scripts still run, when the connection is otherwise idle.
 */
export function startFonts(doc: Document): void {
  installWebFonts(doc);
  const locale = pageLocale(doc);
  warmWebFonts(doc, webFacesOf(fonts.sans, firstScreenWeights[locale]));
  // The large Urdu face is asked for ahead only when the page is in Urdu.
  if (locale === 'ur') warmWebFonts(doc, [urduDisplayFace()]);
}

/**
 * What `FontGate` loads with on the web. Instead of downloading every bundled TTF and OTF file
 * before the first frame (about 330 KB), it declares the web faces (`@qc/ui/web-fonts`: WOFF2
 * copies, `font-display: swap`, each downloaded only when text uses it) and waits for the face
 * of the page's language only: Figtree 400 in English, Mehr Nastaliq Web in Urdu.
 * `public/index.html` and `public/boot.js` have already started that download alongside the
 * scripts. `FontGate` stops waiting after a few seconds and a failure means the fallback font.
 */
export function loadFonts(
  _families: FontFamilyDefinition[],
  doc: Document = document,
): Promise<void> {
  installWebFonts(doc);
  return waitForWebFont(doc, firstPaintFace(pageLocale(doc))).then((result) => {
    if (result === 'failed') throw new Error('The first font did not load');
  });
}
