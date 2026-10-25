import { describe, expect, it } from 'vitest';
import { messages } from '@qc/i18n';
import { createI18n, translate, translatePlural } from './index';
import { renderConsole, screen, shellReady, text } from '../test/harness';

const consoleKeys = Object.keys(messages.en).filter((k) => k.startsWith('console.'));
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('console messages', () => {
  it('has an Urdu value for every English console key, and the other way round', () => {
    const ur = Object.keys(messages.ur).filter((k) => k.startsWith('console.'));
    expect(ur.sort()).toEqual([...consoleKeys].sort());
  });

  it('uses the same placeholders in both languages', () => {
    const bad = consoleKeys.filter(
      (k) =>
        JSON.stringify(placeholders(messages.en[k as 'app.name'])) !==
        JSON.stringify(placeholders(messages.ur[k as 'app.name'])),
    );
    expect(bad).toEqual([]);
  });

  it('has both plural forms wherever one exists', () => {
    for (const k of consoleKeys.filter((k) => k.endsWith('.one')))
      expect(consoleKeys, k).toContain(k.replace(/\.one$/, '.other'));
    for (const k of consoleKeys.filter((k) => k.endsWith('.other')))
      expect(consoleKeys, k).toContain(k.replace(/\.other$/, '.one'));
  });

  it('has no empty values', () => {
    for (const k of consoleKeys) {
      expect(messages.en[k as 'app.name'].trim(), `en ${k}`).not.toBe('');
      expect(messages.ur[k as 'app.name'].trim(), `ur ${k}`).not.toBe('');
    }
  });

  it('keeps the Urdu draft marker', () => {
    expect(messages.ur['_meta.status' as 'app.name']).toMatch(/Draft/);
  });
});

describe('translation helpers', () => {
  it('fills placeholders and leaves unknown ones visible', () => {
    expect(translate('en', 'console.import.applying', { done: 1, total: 3 })).toBe(
      'Importing 1 of 3',
    );
    expect(translate('en', 'console.import.applying', { done: 1 })).toContain('{total}');
  });

  it('falls back to English and then to the key', () => {
    expect(translate('ur', 'no.such.key')).toBe('no.such.key');
  });

  it('picks plural forms', () => {
    expect(translatePlural('en', 'console.import.apply', 1)).toBe('Import 1 row');
    expect(translatePlural('en', 'console.import.apply', 5)).toBe('Import 5 rows');
    expect(translatePlural('ur', 'console.import.apply', 1)).toBe('1 قطار درآمد کریں');
  });

  it('formats numbers with Western digits and dates in Pakistan time, in both languages', () => {
    const en = createI18n('en', () => undefined);
    const ur = createI18n('ur', () => undefined);
    expect(en.number(1234)).toBe('1,234');
    expect(ur.number(1234)).toMatch(/^[0-9,٬]+$/);
    expect(ur.number(1234)).not.toMatch(/[٠-٩۰-۹]/);
    // 20:00 UTC is 01:00 the next morning in Pakistan.
    expect(en.dateTime('2027-02-15T20:00:00Z')).toBe('16 Feb 2027, 1:00 am');
    expect(ur.dateTime('2027-02-15T20:00:00Z')).not.toMatch(/[٠-٩۰-۹]/);
    expect(en.dateTime('not a date')).toBe('not a date');
    expect(en.weekday(0)).toBe('Sun');
    expect(en.weekday(1, 'long')).toBe('Monday');
  });

  it('chooses the Urdu name when there is one, and English otherwise', () => {
    const ur = createI18n('ur', () => undefined);
    const en = createI18n('en', () => undefined);
    expect(ur.localized({ en: 'Hall', ur: 'ہال' })).toBe('ہال');
    expect(ur.localized({ en: 'Hall', ur: null })).toBe('Hall');
    expect(en.localized({ en: 'Hall', ur: 'ہال' })).toBe('Hall');
    expect(en.localized(null)).toBe('');
  });
});

describe('language and direction', () => {
  it('switches language and direction from the shell and remembers the choice', async () => {
    const { user, displayStore } = renderConsole({ role: 'national', path: '/sessions' });
    await shellReady();
    expect(document.documentElement.lang).toBe('en');
    expect(document.documentElement.dir).toBe('ltr');
    await user.selectOptions(screen.getByLabelText(text('console.shell.language')), 'ur');
    expect(document.documentElement.lang).toBe('ur');
    expect(document.documentElement.dir).toBe('rtl');
    expect(
      await screen.findByRole('heading', { level: 1, name: text('console.sessions.title', 'ur') }),
    ).toBeTruthy();
    expect(displayStore.get('qc.console.locale')).toBe('ur');
    await user.selectOptions(screen.getByLabelText(text('console.shell.language', 'ur')), 'en');
    expect(document.documentElement.dir).toBe('ltr');
  });
});
