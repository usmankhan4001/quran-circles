/**
 * Asks for Today's sessions as soon as the early `me` answer (boot/earlyStart.web.ts) is in,
 * instead of after Today's first render (`startEarlyToday` says when it does and does not).
 * Only when the page opens on Today itself; a link to another screen asks for nothing extra.
 * Imported by `src/entry.ts` after the app's code, so the contract's schemas and client are in.
 */
import { peekEarlyMe } from '../auth/earlyMe';
import { config } from '../config';
import { startEarlyToday } from '../features/home/earlyToday';
import { pageLocale } from '../fonts/loadFonts';
import { WORKING_SCOPE_KEY } from '../scope/WorkingScopeProvider';

/** The saved working scope, from the same place `WorkingScopeProvider` reads it (`local`). */
function savedScopeId(): string | null {
  try {
    return window.localStorage.getItem(WORKING_SCOPE_KEY);
  } catch {
    return null;
  }
}

/** Today is the root route, `(tabs)/index`. */
export const isTodayPath = (pathname: string): boolean => pathname === '/' || pathname === '';

if (typeof document !== 'undefined' && isTodayPath(window.location.pathname)) {
  startEarlyToday({
    baseUrl: config.apiBaseUrl,
    me: peekEarlyMe(),
    savedScopeId: savedScopeId(),
    locale: pageLocale(document),
  });
}
