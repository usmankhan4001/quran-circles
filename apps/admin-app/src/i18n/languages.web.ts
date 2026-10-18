import { hasMessages, installMessages } from '@qc/i18n/client';
import { createLanguageLoader, type LanguageLoader } from './languageLoader';

/**
 * The web: `@qc/i18n` is the live catalogue (`metro.redirects.cjs`), and each language's words
 * for this app are a file of their own, downloaded when first needed. Start-up loads only the
 * page's language (`boot/earlyStart.web.ts`; `AppearanceProvider` waits for the saved one). The
 * other one loads when the person switches, or quietly once the app has settled, so a switch
 * later does not wait for the network (the browser keeps the file: its name has its content
 * hash and the server marks it immutable).
 */
export const languages: LanguageLoader = createLanguageLoader({
  tables: {
    en: () => import('@qc/i18n/tables/admin-app/en'),
    ur: () => import('@qc/i18n/tables/admin-app/ur'),
  },
  install: installMessages,
  has: hasMessages,
});
