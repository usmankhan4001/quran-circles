/**
 * Runs first, before the bulk of the app's code (`src/entry.ts` imports it straight after the
 * runtime), so these requests go out while the rest of the scripts are still being run:
 *
 * - who is signed in (`startEarlyMe`), from the saved sign-in in this tab's session store;
 * - the first screen's fonts (`startFonts`), in the page's language.
 *
 * It imports nothing heavy, so it runs early. Nothing here throws.
 */
import { startEarlyMe } from '../auth/earlyMe';
import { TOKENS_KEY } from '../auth/keys';
import { config } from '../config';
import { pageLocale, startFonts } from '../fonts/loadFonts';

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
}
