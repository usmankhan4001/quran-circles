import * as Font from 'expo-font';
import type { Locale } from '@qc/contracts';
import type { FontLoadResult } from '@qc/ui/font-sources';
import { loadAppFonts } from './appFonts';

/**
 * iOS and Android: the fonts are in the app binary and load in a moment, so the first frame
 * waits for all of them (never longer than a few seconds). The web has its own version,
 * `loadFonts.web.ts`, which waits for the language's face only.
 */
export function loadFirstFonts(_locale: Locale): Promise<FontLoadResult> {
  return loadAppFonts(Font.loadAsync);
}

/** The web starts some downloads early (`loadFonts.web.ts`); a phone has nothing to start. */
export function startFonts(_locale: Locale): void {}
