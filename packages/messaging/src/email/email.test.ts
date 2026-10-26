import { LOCALES } from '@qc/contracts';
import { describe, expect, it } from 'vitest';
import { EMAIL_ADDRESSES, EMAIL_DOMAIN, EMAIL_FROM } from './config';
import { EmailTemplateError, render, renderTemplateSource } from './render';
import { EMAIL_TEMPLATE_NAMES, type EmailTemplateData, type EmailTemplateName } from './templates';

const session = {
  name: 'Ayesha',
  sessionTitle: 'Saturday Tafseer Circle',
  venueName: 'Masjid Al-Noor',
  when: 'Saturday, 7:30 pm',
  link: 'https://qurancircles.doraquran.pk/session/abc',
};
const data: { [K in EmailTemplateName]: EmailTemplateData[K] } = {
  sign_in_code: { code: '123456', minutes: 5 },
  welcome: { name: 'Ayesha' },
  join_confirmation: session,
  session_reminder: session,
  account_deleted: { name: 'Ayesha' },
};

const all = EMAIL_TEMPLATE_NAMES.flatMap((name) => LOCALES.map((locale) => ({ name, locale })));

describe('email addresses', () => {
  it('uses the qurancircles mail domain for every address', () => {
    expect(EMAIL_DOMAIN).toBe('qurancircles.doraquran.pk');
    expect(EMAIL_ADDRESSES.notifications).toBe('notifications@qurancircles.doraquran.pk');
    expect(EMAIL_ADDRESSES.support).toBe('support@qurancircles.doraquran.pk');
    expect(EMAIL_ADDRESSES.privacy).toBe('privacy@qurancircles.doraquran.pk');
    expect(EMAIL_FROM).toBe('Quran Circles <notifications@qurancircles.doraquran.pk>');
  });
});

describe.each(all)('$name ($locale)', ({ name, locale }) => {
  const email = render(name, locale, data[name] as never);

  it('has a subject, html and text', () => {
    expect(email.subject.length).toBeGreaterThan(3);
    expect(email.subject).not.toMatch(/[\r\n]/);
    expect(email.html.startsWith('<!doctype html>')).toBe(true);
    expect(email.text.length).toBeGreaterThan(40);
  });

  it(`sets lang and direction for ${locale}`, () => {
    expect(email.html).toContain(`<html lang="${locale}" dir="${locale === 'ur' ? 'rtl' : 'ltr'}"`);
    if (locale === 'ur') expect(email.html).toContain('Noori Nastaleeq');
    else expect(email.html).toContain('Plus Jakarta Sans');
  });

  it('is light only: no dark rules, colour scheme pinned', () => {
    expect(email.html).toContain('<meta name="color-scheme" content="light only">');
    expect(email.html).toContain('<meta name="supported-color-schemes" content="light only">');
    expect(email.html).not.toMatch(/prefers-color-scheme/i);
    expect(email.html).toContain('bgcolor="#FFFFFF"');
  });

  it('is email-safe: no scripts, no external CSS besides the font, hosted logo with alt text', () => {
    expect(email.html).not.toMatch(/<script/i);
    for (const [, href] of email.html.matchAll(/<link[^>]+href="([^"]+)"/g)) {
      expect(href).toMatch(/^https:\/\/fonts\.googleapis\.com\//);
    }
    expect(email.html).toMatch(
      /<img src="https:\/\/qurancircles.doraquran\.pk\/brand\/email-logo\.png"[^>]+alt="Quran Circles"/,
    );
    expect(email.html).not.toContain('data:image');
    expect(email.html).toContain('display:none'); // preheader
  });

  it('links support and privacy on the mail domain', () => {
    expect(email.html).toContain('mailto:support@qurancircles.doraquran.pk');
    expect(email.text).toContain('support@qurancircles.doraquran.pk');
    expect(email.text).not.toMatch(/<[a-z][^>]*>/i);
  });
});

describe('sign_in_code', () => {
  it('shows the code and its lifetime in both formats', () => {
    for (const locale of LOCALES) {
      const e = render('sign_in_code', locale, { code: '654321', minutes: 5 });
      expect(e.subject).toContain('654321');
      expect(e.html).toContain('654321');
      expect(e.html).toContain('dir="ltr"');
      expect(e.text).toContain('654321');
      expect(e.text).toContain('5');
    }
  });

  it('refuses a code that is not six digits', () => {
    expect(() => render('sign_in_code', 'en', { code: '12', minutes: 5 })).toThrow(
      EmailTemplateError,
    );
  });
});

describe('safety', () => {
  const hostile = {
    ...session,
    name: '<b>Eve</b>',
    sessionTitle: '"><script>alert(1)</script>\nBcc: x@y.z',
    link: 'javascript:alert(1)',
  };

  it('escapes html, drops unsafe links and keeps the subject on one line', () => {
    const e = render('join_confirmation', 'en', hostile);
    expect(e.html).not.toContain('<script>alert');
    expect(e.html).not.toContain('<b>Eve</b>');
    expect(e.html).toContain('&lt;b&gt;Eve&lt;/b&gt;');
    expect(e.html).not.toContain('javascript:');
    expect(e.subject).not.toMatch(/[\r\n]/);
  });

  it('rejects unknown templates and locales', () => {
    expect(() => render('nope' as never, 'en', {} as never)).toThrow(EmailTemplateError);
    expect(() => render('welcome', 'fr' as never, {})).toThrow(EmailTemplateError);
  });
});

describe('content', () => {
  it('confirms a join pledge, not a seat booking', () => {
    const e = render('join_confirmation', 'en', session);
    expect(e.text).toMatch(/no seat to hold/i);
    expect(e.text).toContain(session.link);
    expect(e.html).toContain(session.venueName);
  });

  it('greets by name only when there is one', () => {
    expect(render('welcome', 'en', { name: 'Ayesha' }).text).toContain('Assalamu alaikum Ayesha,');
    expect(render('welcome', 'en', {}).text).not.toContain('Assalamu alaikum');
    expect(render('welcome', 'ur', { name: 'عائشہ' }).text).toContain('السلام علیکم عائشہ،');
  });

  it('serves the logo from the preview base when given', () => {
    const e = render('welcome', 'en', {}, { logoUrl: './logo.png' });
    expect(e.html).toContain('<img src="./logo.png"');
  });
});

describe('renderTemplateSource', () => {
  it.each(all)('keeps {{{variables}}} for $name ($locale)', ({ name, locale }) => {
    const src = renderTemplateSource(name, locale);
    for (const v of src.variables) {
      expect(src.html + src.text + src.subject).toContain(`{{{${v.key}}}}`);
    }
    expect(src.html).not.toContain('href="#"');
  });
});
