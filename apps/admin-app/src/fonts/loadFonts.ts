import * as Font from 'expo-font';
import type { FontFamilyDefinition } from 'expo-font';
import type { Locale } from '@qc/contracts';

/**
 * What `FontGate` loads with. iOS and Android: `expo-font`, which loads the bundled TTF and OTF
 * files from the app binary in a moment. The web has its own version, `loadFonts.web.ts`.
 */
export function loadFonts(families: FontFamilyDefinition[]): Promise<void> {
  return Font.loadAsync(families);
}

/** The page's language. Only the web has a page; elsewhere this is never asked. */
export function pageLocale(_doc: Document): Locale {
  return 'en';
}

/** The web starts some downloads early (`loadFonts.web.ts`); a phone has nothing to start. */
export function startFonts(_doc: Document): void {}
