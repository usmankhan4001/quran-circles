import type { FontDisplay, FontFamilyDefinition } from 'expo-font';
import { bundledFonts, loadFontsWithFallback, type FontLoadResult } from '@qc/ui/font-sources';

/**
 * On the web, text shows at once in the fallback font and changes when the bundled font has
 * arrived, instead of staying invisible. Native platforms ignore it.
 */
const SWAP = 'swap' as FontDisplay;

/**
 * The fonts the app loads (D4): Figtree in the weights the type roles use, Mehr Nastaliq Web for
 * Urdu and KFGQPC Uthmanic Script HAFS for Quran text, each registered under its `fonts` token
 * name. The files and their licences come from `@qc/ui/font-sources`.
 */
export const appFontFamilies: FontFamilyDefinition[] = bundledFonts.map((family) => ({
  fontFamily: family.fontFamily,
  fontDefinitions: family.fontDefinitions.map((face) => ({ ...face, display: SWAP })),
}));

/**
 * Loads the fonts with `expo-font` (`Font.loadAsync`, passed in so tests need no device). It
 * never rejects and gives up waiting after a few seconds, so a font that fails or is slow only
 * means the fallback font shows (the system font on a phone, the next font in the stack on the
 * web).
 */
export function loadAppFonts(
  load: (families: FontFamilyDefinition[]) => Promise<void>,
  timeoutMs?: number,
): Promise<FontLoadResult> {
  return loadFontsWithFallback(() => load(appFontFamilies), timeoutMs);
}
