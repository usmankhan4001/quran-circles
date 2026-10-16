import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { Locale, Localized } from '@qc/contracts';
import { createTranslator, type TFunction } from './translate';
import { pickLocalized, type LocalizedText } from './localized';

export interface I18n {
  locale: Locale;
  t: TFunction;
  /** Picks the person's language from a server text, falling back to English. */
  l: (value: Localized) => LocalizedText;
}

const I18nContext = createContext<I18n | null>(null);

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const value = useMemo<I18n>(
    () => ({ locale, t: createTranslator(locale), l: (v) => pickLocalized(v, locale) }),
    [locale],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n needs an I18nProvider');
  return value;
}
