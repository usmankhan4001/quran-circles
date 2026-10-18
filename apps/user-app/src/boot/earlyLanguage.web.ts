/**
 * Runs straight after the runtime, before the rest of the app's code (`src/entry.ts`), and starts
 * downloading the words of the page's language. `public/boot.js` has already put the saved
 * language (or the device's, as `defaultPreferences` does) on `<html lang>`, so the file arrives
 * while the main bundle is still running. The root layout waits for it before the first screen.
 */
// `expo` installs the loader that `import()` chunks need (`__loadBundleAsync`, Expo.fx). The
// router imports it later; without it here the first language download throws "Requiring
// unknown module" because this file runs before the router.
import 'expo';
import { languages } from '../i18n/languages';
import { prefetchLanguage } from '../i18n/languageLoader';

if (typeof document !== 'undefined') {
  prefetchLanguage(languages, document.documentElement.lang === 'ur' ? 'ur' : 'en');
}
