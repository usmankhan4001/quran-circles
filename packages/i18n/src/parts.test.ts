import { describe, expect, it } from 'vitest';
import { messages, partOf, parts, PARTS, type Part } from './index';
import * as client from './client';
import userAppEn from './tables/user-app.en';
import userAppUr from './tables/user-app.ur';
import adminAppEn from './tables/admin-app.en';
import adminAppUr from './tables/admin-app.ur';

type Table = Record<string, string>;
const keys = (o: object) => Object.keys(o).filter((k) => !k.startsWith('_'));
const table = (part: Part, locale: 'en' | 'ur') => parts[part][locale] as Table;

describe('parts', () => {
  it.each(PARTS)('%s has the same keys in English and Urdu', (part) => {
    expect(keys(table(part, 'ur')).sort()).toEqual(keys(table(part, 'en')).sort());
  });

  it.each(PARTS)('%s holds only the keys whose namespace belongs to it', (part) => {
    for (const locale of ['en', 'ur'] as const) {
      const strays = keys(table(part, locale)).filter((key) => partOf(key) !== part);
      expect(strays, `${locale}/${part}.json`).toEqual([]);
    }
  });

  it('has every key in exactly one part', () => {
    const all = PARTS.flatMap((part) => keys(table(part, 'en')));
    expect(new Set(all).size).toBe(all.length);
    expect(all.sort()).toEqual(keys(messages.en).sort());
  });

  it.each(PARTS)('marks the Urdu of %s as a draft for review', (part) => {
    expect(table(part, 'ur')['_meta.status']).toMatch(/native Urdu speaker must review/);
  });

  it('puts keys in parts by namespace', () => {
    expect(partOf('console.nav.dashboard')).toBe('console');
    expect(partOf('admin.today.title')).toBe('admin-app');
    expect(partOf('ui.close')).toBe('shared');
    expect(partOf('errors.forbidden')).toBe('shared');
    expect(partOf('time.period.night')).toBe('shared');
    expect(partOf('home.greeting')).toBe('user-app');
    expect(partOf('administrator')).toBe('user-app');
  });
});

describe('app tables', () => {
  it.each([
    ['user-app', 'en', userAppEn],
    ['user-app', 'ur', userAppUr],
    ['admin-app', 'en', adminAppEn],
    ['admin-app', 'ur', adminAppUr],
  ] as const)('%s in %s is the shared part and its own, word for word', (part, locale, t) => {
    expect(keys(t).sort()).toEqual(
      [...keys(table('shared', locale)), ...keys(table(part, locale))].sort(),
    );
    for (const key of keys(t)) expect(t[key]).toBe((messages[locale] as Table)[key]);
  });

  it('leaves the other apps out of each table', () => {
    expect(keys(userAppEn).some((k) => k.startsWith('admin.') || k.startsWith('console.'))).toBe(
      false,
    );
    expect(keys(adminAppUr).some((k) => k.startsWith('home.') || k.startsWith('console.'))).toBe(
      false,
    );
  });
});

describe('client', () => {
  it('starts with no words and fills the same objects in place', () => {
    const en = client.messages.en as Table;
    const ur = client.messages.ur as Table;
    expect(client.hasMessages('ur')).toBe(false);
    expect(ur['ui.close']).toBeUndefined();

    client.installMessages('ur', userAppUr);
    expect(client.hasMessages('ur')).toBe(true);
    expect(client.hasMessages('en')).toBe(false);
    expect(client.messages.ur).toBe(ur);
    expect(ur['ui.close']).toBe(messages.ur['ui.close']);
    expect(en['ui.close']).toBeUndefined();

    client.installMessages('en', userAppEn);
    expect(client.messages.en).toBe(en);
    expect(en['tabs.home']).toBe(messages.en['tabs.home']);
  });

  it('has the same helpers as the full catalogue', () => {
    expect(client.timePeriodKey(21)).toBe('time.period.night');
    expect(client.TIME_PERIOD_KEYS).toHaveLength(5);
  });
});
