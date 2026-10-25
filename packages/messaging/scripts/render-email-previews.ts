/**
 * Renders every email template in both languages to HTML and text files for a visual check.
 * Run: pnpm --filter @qc/messaging email:previews [outDir]   (default: packages/messaging/.email-previews)
 */
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LOCALES, type Locale } from '@qc/contracts';
import { render, type EmailTemplateData, type EmailTemplateName } from '../src/email';

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(process.argv[2] ?? join(here, '..', '.email-previews'));
mkdirSync(out, { recursive: true });
copyFileSync(join(here, '..', 'assets', 'email', 'logo.png'), join(out, 'logo.png'));

const samples: { [K in EmailTemplateName]: Record<Locale, EmailTemplateData[K]> } = {
  sign_in_code: {
    en: { code: '482916', minutes: 5 },
    ur: { code: '482916', minutes: 5 },
  },
  welcome: { en: { name: 'Ayesha' }, ur: { name: 'عائشہ' } },
  join_confirmation: {
    en: {
      name: 'Ayesha',
      sessionTitle: 'Saturday Tafseer Circle',
      venueName: 'Masjid Al-Noor, Gulberg, Lahore',
      when: 'Saturday 31 October, 7:30 pm',
      link: 'https://qurancircle.doraquran.pk/session/example',
    },
    ur: {
      name: 'عائشہ',
      sessionTitle: 'ہفتہ وار تفسیر سرکل',
      venueName: 'مسجد النور، گلبرگ، لاہور',
      when: 'ہفتہ 31 اکتوبر، شام 7:30 بجے',
      link: 'https://qurancircle.doraquran.pk/session/example',
    },
  },
  session_reminder: {
    en: {
      name: 'Ayesha',
      sessionTitle: 'Saturday Tafseer Circle',
      venueName: 'Masjid Al-Noor, Gulberg, Lahore',
      when: 'Tomorrow, 7:30 pm',
      link: 'https://qurancircle.doraquran.pk/session/example',
    },
    ur: {
      name: 'عائشہ',
      sessionTitle: 'ہفتہ وار تفسیر سرکل',
      venueName: 'مسجد النور، گلبرگ، لاہور',
      when: 'کل، شام 7:30 بجے',
      link: 'https://qurancircle.doraquran.pk/session/example',
    },
  },
  account_deleted: { en: { name: 'Ayesha' }, ur: { name: 'عائشہ' } },
};

const rows: string[] = [];
for (const name of Object.keys(samples) as EmailTemplateName[]) {
  for (const locale of LOCALES) {
    const data = samples[name][locale] as never;
    const email = render(name, locale, data, { assetBaseUrl: '.' });
    writeFileSync(join(out, `${name}.${locale}.html`), email.html);
    writeFileSync(join(out, `${name}.${locale}.txt`), email.text);
    rows.push(
      `<li><a href="${name}.${locale}.html">${name} (${locale})</a> · <a href="${name}.${locale}.txt">text</a> — ${email.subject.replace(/</g, '&lt;')}</li>`,
    );
  }
}
writeFileSync(
  join(out, 'index.html'),
  `<!doctype html><meta charset="utf-8"><title>Email previews</title><body style="font-family:sans-serif;background:#fff;color:#111827"><h1>Email previews</h1><ul>${rows.join('')}</ul>`,
);
console.log(`Wrote ${rows.length} previews to ${out}`);
