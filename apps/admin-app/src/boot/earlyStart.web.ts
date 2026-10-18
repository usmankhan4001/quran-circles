/**
 * Runs first, before the bulk of the app's code (`src/entry.ts` imports it straight after the
 * runtime), so these requests go out while the rest of the scripts are still being run:
 *
 * - who is signed in (`startEarlyMe`), from the saved sign-in in this tab's session store;
 * - the first screen's fonts (`startFonts`), in the page's language;
 * - the words of the page's language (`@qc/i18n` loads one language at a time on the web).
 *
 * It imports nothing heavy, so it runs early. Nothing here throws.
 */
// `expo` installs the loader that `import()` chunks need (`__loadBundleAsync`, Expo.fx). The
// router imports it later; without it here the first language download throws "Requiring
// unknown module" because this file runs before the router.
import 'expo';
import { startEarlyMe } from '../auth/earlyMe';
import { TOKENS_KEY } from '../auth/keys';
import { config } from '../config';
import { pageLocale, startFonts } from '../fonts/loadFonts';
import { prefetchLanguage } from '../i18n/languageLoader';
import { languages } from '../i18n/languages';

function savedTokens(): string | null {
  try {
    return window.sessionStorage.getItem(TOKENS_KEY);
  } catch {
    return null;
  }
}

if (typeof document !== 'undefined') {
  startEarlyMe({
    baseUrl: config.apiBaseUrl,
    savedTokens: savedTokens(),
    locale: pageLocale(document),
  });
  startFonts(document);
  prefetchLanguage(languages, pageLocale(document));
}
