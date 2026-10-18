import type { MessageKey } from '@qc/i18n';

/**
 * What the apps credit on their "About and credits" screens: the bundled fonts, the Quran text
 * and the translations. One list, so the user app and the console say the same thing. The words
 * are `credits.*` keys in `@qc/i18n`; the licence notes behind them are in
 * `assets/fonts/LICENSES.md` and `docs/agents/status/ui.md`.
 */
export type CreditKey = Extract<MessageKey, `credits.${string}`>;

export interface CreditLink {
  label: CreditKey;
  url: string;
}

export interface CreditEntry {
  id: 'jakarta' | 'mehr' | 'kfgqpc' | 'tanzil' | 'translationUr' | 'translationEn';
  name: CreditKey;
  body: CreditKey;
  link?: CreditLink;
}

export interface CreditGroup {
  id: 'fonts' | 'text';
  heading: CreditKey;
  entries: readonly CreditEntry[];
}

export const creditLinks = {
  ofl: 'https://openfontlicense.org',
  ccBySa: 'https://creativecommons.org/licenses/by-sa/4.0/',
  kfgqpc: 'https://fonts.qurancomplex.gov.sa',
  tanzil: 'https://tanzil.net',
} as const;

export const creditGroups: readonly CreditGroup[] = [
  {
    id: 'fonts',
    heading: 'credits.fonts.heading',
    entries: [
      {
        id: 'jakarta',
        name: 'credits.jakarta.name',
        body: 'credits.jakarta.body',
        link: { label: 'credits.jakarta.link', url: creditLinks.ofl },
      },
      {
        id: 'mehr',
        name: 'credits.mehr.name',
        body: 'credits.mehr.body',
        link: { label: 'credits.mehr.link', url: creditLinks.ccBySa },
      },
      {
        id: 'kfgqpc',
        name: 'credits.kfgqpc.name',
        body: 'credits.kfgqpc.body',
        link: { label: 'credits.kfgqpc.link', url: creditLinks.kfgqpc },
      },
    ],
  },
  {
    id: 'text',
    heading: 'credits.text.heading',
    entries: [
      {
        id: 'tanzil',
        name: 'credits.tanzil.name',
        body: 'credits.tanzil.body',
        link: { label: 'credits.tanzil.link', url: creditLinks.tanzil },
      },
      {
        id: 'translationUr',
        name: 'credits.translationUr.name',
        body: 'credits.translationUr.body',
      },
      {
        id: 'translationEn',
        name: 'credits.translationEn.name',
        body: 'credits.translationEn.body',
      },
    ],
  },
];
