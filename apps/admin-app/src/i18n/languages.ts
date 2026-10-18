import { bundledLanguages, type LanguageLoader } from './languageLoader';

/**
 * iOS and Android: the binary has the whole catalogue (`@qc/i18n`), so every language is always
 * there. The web downloads one at a time instead (`languages.web.ts`).
 */
export const languages: LanguageLoader = bundledLanguages;
