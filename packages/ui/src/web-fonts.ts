// The reference carries the font file typings with it, as in `font-sources.ts`.
// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="./font-assets.d.ts" />
/**
 * The fonts as the web pages load them (the PWA, the admin app's web target). Import it from
 * `@qc/ui/web-fonts`. iOS and Android keep `@qc/ui/font-sources`, which loads the TTF and OTF
 * files from the app binary.
 *
 * On the web every face is declared with `@font-face` and `font-display: swap`, and the browser
 * downloads a face only when text on screen uses it. A page waits only for the face its
 * language's text is set in (`firstPaintFace`): Plus Jakarta Sans 400 in English, Mehr Nastaliq Web in
 * Urdu, which Jameel Noori Nastaleeq replaces when its larger file has arrived. The other Latin weights follow as the screen uses them, and the Quran font only when
 * Quran text is shown.
 *
 * - Plus Jakarta Sans and Mehr Nastaliq Web: WOFF2 copies in `assets/fonts/web`, written by
 *   `scripts/web-fonts.py` (the same fonts in a compressed container, nothing subset).
 * - KFGQPC Uthmanic Script HAFS: the original OTF. Its licence forbids converting it.
 *
 * Licences and checksums: `assets/fonts/LICENSES.md`.
 */
import kfgqpcHafs from '../assets/fonts/KFGQPCUthmanicScriptHAFS-Regular.otf';
import jakarta400 from '../assets/fonts/web/PlusJakartaSans-400.woff2';
import jakarta500 from '../assets/fonts/web/PlusJakartaSans-500.woff2';
import jakarta600 from '../assets/fonts/web/PlusJakartaSans-600.woff2';
import jakarta700 from '../assets/fonts/web/PlusJakartaSans-700.woff2';
import jakarta800 from '../assets/fonts/web/PlusJakartaSans-800.woff2';
import jameelNoori from '../assets/fonts/web/JameelNooriNastaleeq-Subset.woff2';
import mehrNastaliq from '../assets/fonts/web/MehrNastaliqWeb-Regular.woff2';
import type { Locale } from './direction';
import { fontLoadTimeoutMs, loadFontsWithFallback, type FontLoadResult } from './font-loading';
import { fonts, urduFallbackFont, type SansWeight } from './tokens';

export type { FontLoadResult } from './font-loading';
// The family names, so a page's earliest script can name faces without loading the whole kit.
export { fonts } from './tokens';

export interface WebFontFace {
  /** The family name, the same as the `fonts` token. */
  family: string;
  weight: number;
  /** The file's URL as the bundler serves it. */
  src: string;
  format: 'woff2' | 'opentype';
}

const sansFiles: Record<SansWeight, string | number> = {
  '400': jakarta400,
  '500': jakarta500,
  '600': jakarta600,
  '700': jakarta700,
  '800': jakarta800,
};

export const webFontFaces: readonly WebFontFace[] = [
  ...(Object.keys(sansFiles) as SansWeight[]).map((weight) => ({
    family: fonts.sans,
    weight: Number(weight),
    src: String(sansFiles[weight]),
    format: 'woff2' as const,
  })),
  { family: fonts.urdu, weight: 400, src: String(jameelNoori), format: 'woff2' },
  { family: urduFallbackFont, weight: 400, src: String(mehrNastaliq), format: 'woff2' },
  { family: fonts.quran, weight: 400, src: String(kfgqpcHafs), format: 'opentype' },
];

function face(family: string, weight: number): WebFontFace {
  const found = webFontFaces.find((f) => f.family === family && f.weight === weight);
  if (!found) throw new Error(`No web font face ${family} ${weight}`);
  return found;
}

/** The face a language's first screen is set in: the only one worth holding the first frame for. */
export function firstPaintFace(locale: Locale): WebFontFace {
  // Urdu holds the first frame only for the small fallback face; Jameel Noori (about 6.8 MB)
  // swaps in when it arrives.
  return locale === 'ur' ? face(urduFallbackFont, 400) : face(fonts.sans, 400);
}

/** The Urdu display face, a large file: asked for ahead only on Urdu screens. */
export function urduDisplayFace(): WebFontFace {
  return face(fonts.urdu, 400);
}

const cssString = (value: string) => `"${value.replace(/["\\]/g, '\\$&')}"`;

/** `@font-face` rules for the faces, each with `font-display: swap`. */
export function fontFaceCss(faces: readonly WebFontFace[] = webFontFaces): string {
  return faces
    .map(
      (f) =>
        `@font-face{font-family:${cssString(f.family)};src:url(${cssString(f.src)}) format(${cssString(
          f.format,
        )});font-weight:${f.weight};font-style:normal;font-display:swap}`,
    )
    .join('\n');
}

export const WEB_FONT_STYLE_ID = 'qc-web-fonts';

/**
 * Declares every face on the page once. Declaring downloads nothing: the browser fetches a face
 * when text uses it.
 */
export function installWebFonts(doc: Document, faces: readonly WebFontFace[] = webFontFaces): void {
  if (doc.getElementById(WEB_FONT_STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = WEB_FONT_STYLE_ID;
  style.textContent = fontFaceCss(faces);
  doc.head.appendChild(style);
}

/** The faces of one family at the given weights, in that order; unknown weights are skipped. */
export function webFacesOf(family: string, weights: readonly number[]): WebFontFace[] {
  return weights.flatMap((weight) =>
    webFontFaces.filter((f) => f.family === family && f.weight === weight),
  );
}

/**
 * Starts downloading faces the first screen is about to use, without waiting: one
 * `<link rel="preload" as="font">` per face, which the browser starts at once, even while a
 * script is still running. The `@font-face` rules from `installWebFonts` then use the download.
 * A face already asked for is not asked for again; one that fails is left to the fallback.
 */
export function warmWebFonts(doc: Document, faces: readonly WebFontFace[]): void {
  for (const f of faces) {
    if (doc.head.querySelector(`link[rel="preload"][href=${cssString(f.src)}]`)) continue;
    const link = doc.createElement('link');
    link.setAttribute('rel', 'preload');
    link.setAttribute('as', 'font');
    link.setAttribute('type', f.format === 'woff2' ? 'font/woff2' : 'font/otf');
    // Fonts are always fetched in CORS mode; the preload has to match to be used.
    link.setAttribute('crossorigin', 'anonymous');
    link.setAttribute('href', f.src);
    doc.head.appendChild(link);
  }
}

/**
 * Waits for one face to be ready, never longer than `timeoutMs` and never rejecting: a face that
 * fails or is slow means the fallback in the font stack shows until it arrives.
 */
export function waitForWebFont(
  doc: Document,
  target: WebFontFace,
  timeoutMs: number = fontLoadTimeoutMs,
): Promise<FontLoadResult> {
  return loadFontsWithFallback(() => {
    const set = doc.fonts as FontFaceSet | undefined;
    if (!set || typeof set.load !== 'function') return Promise.resolve();
    return set.load(`${target.weight} 1em ${cssString(target.family)}`).then((loaded) => {
      if (loaded.length === 0) throw new Error(`${target.family} did not load`);
    });
  }, timeoutMs);
}
