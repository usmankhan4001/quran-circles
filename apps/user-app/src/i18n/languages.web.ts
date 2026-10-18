import { hasMessages, installMessages } from '@qc/i18n/client';
import { createLanguageLoader, type LanguageLoader } from './languageLoader';

/**
 * The web: `@qc/i18n` is the live catalogue (`metro.redirects.cjs`), and each language's words
 * for this app are a file of their own, downloaded when first needed. Start-up loads only the
 * saved language (`boot/earlyLanguage.web.ts`, then the root layout waits for it); the other
 * one loads when the person switches, or quietly once the app has settled
 * (`usePrefetchOtherLanguage`), so the service worker has both files for an offline switch.
 */
export const languages: LanguageLoader = createLanguageLoader({
  tables: {
    en: () => import('@qc/i18n/tables/user-app/en'),
    ur: () => import('@qc/i18n/tables/user-app/ur'),
  },
  install: installMessages,
  has: hasMessages,
});
