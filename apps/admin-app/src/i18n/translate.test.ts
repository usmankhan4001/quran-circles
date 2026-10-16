import { messages } from '@qc/i18n';
import { describe, expect, it } from 'vitest';
import {
  createTranslator,
  hasMessage,
  translate,
  translatePlural,
  type MessageKey,
} from './translate';

describe('translate', () => {
  it('reads a key in the requested language', () => {
    expect(translate('en', 'admin.tabs.today')).toBe('Today');
    expect(translate('ur', 'admin.tabs.today')).not.toBe('Today');
  });

  it('fills named parameters and leaves unknown ones visible', () => {
    expect(translate('en', 'admin.updates.recipients.other', { count: 12 })).toBe(
      'Reached 12 people',
    );
    expect(translate('en', 'admin.updates.recipients.other')).toBe('Reached {count} people');
  });

  it('falls back to English and then to the key', () => {
    expect(translate('ur', 'no.such.key' as MessageKey)).toBe('no.such.key');
  });

  it('picks the singular and plural forms and formats the count', () => {
    expect(translatePlural('en', 'admin.updates.recipients', 1)).toBe('Reached 1 person');
    expect(translatePlural('en', 'admin.updates.recipients', 5)).toBe('Reached 5 people');
    expect(translatePlural('en', 'admin.updates.recipients', 0)).toBe('Reached 0 people');
  });

  it('builds a translator with a plural helper', () => {
    const t = createTranslator('en');
    expect(t('admin.tabs.places')).toBe('Places');
    expect(t.plural('admin.updates.recipients', 2)).toBe('Reached 2 people');
  });

  it('knows which keys exist', () => {
    expect(hasMessage('admin.tabs.today')).toBe(true);
    expect(hasMessage('admin.nope')).toBe(false);
  });
});

describe('the admin messages', () => {
  const en = messages.en as Record<string, string>;
  const ur = messages.ur as Record<string, string>;
  const adminKeys = Object.keys(en).filter((k) => k.startsWith('admin.'));

  it('exist in both languages with text', () => {
    expect(adminKeys.length).toBeGreaterThan(200);
    for (const key of adminKeys) {
      expect(ur[key], key).toBeTruthy();
    }
  });

  it('keep the same {placeholders} in both languages', () => {
    const names = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const key of adminKeys) {
      expect(names(ur[key]!), key).toEqual(names(en[key]!));
    }
  });

  it('give every plural a one and an other form', () => {
    // `admin.schedule.scope.one` is "This session only", a choice and not a plural form.
    const notPlural = new Set(['admin.schedule.scope.one']);
    for (const key of adminKeys.filter((k) => k.endsWith('.one') && !notPlural.has(k))) {
      const base = key.slice(0, -4);
      expect(en[`${base}.other`], base).toBeTruthy();
    }
  });
});
