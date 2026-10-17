import { describe, expect, it } from 'vitest';
import { filterBySearch, matchesSearch, normalizeForSearch, searchTerms } from './search';

describe('search terms', () => {
  it('has no words for an empty or blank query, so every row matches', () => {
    expect(searchTerms('')).toEqual([]);
    expect(searchTerms('   ')).toEqual([]);
    expect(matchesSearch([], ['anything'])).toBe(true);
  });

  it('folds case, spacing and Urdu digits', () => {
    expect(normalizeForSearch('  Masjid   AL-Noor ')).toBe('masjid al-noor');
    expect(normalizeForSearch('۰۳۰۰')).toBe('0300');
    expect(normalizeForSearch('٠٣٠٠')).toBe('0300');
  });
});

describe('matching a row', () => {
  const row = [
    { en: 'Test Dars Circle', ur: 'ٹیسٹ درس حلقہ' },
    { en: 'Test Masjid One', ur: null },
    '+923000000061',
    null,
    undefined,
  ];

  it('needs every word somewhere in the row', () => {
    expect(matchesSearch(searchTerms('dars masjid'), row)).toBe(true);
    expect(matchesSearch(searchTerms('dars library'), row)).toBe(false);
  });

  it('finds the Urdu name as well as the English one', () => {
    expect(matchesSearch(searchTerms('درس'), row)).toBe(true);
  });

  it('matches a phone number however it was typed', () => {
    expect(matchesSearch(searchTerms('0300 0000061'), row)).toBe(true);
    expect(matchesSearch(searchTerms('+92 300 0000061'), row)).toBe(true);
    expect(matchesSearch(searchTerms('۰۰۰۰۰۶۱'), row)).toBe(true);
    expect(matchesSearch(searchTerms('061'), row)).toBe(true);
    expect(matchesSearch(searchTerms('0300 0000099'), row)).toBe(false);
  });

  it('does not treat a single digit as a phone number', () => {
    expect(matchesSearch(searchTerms('7'), ['Test Room'])).toBe(false);
  });
});

describe('filtering rows', () => {
  const rows = [
    { name: 'Test Alpha', phone: '+923000000071' },
    { name: 'Test Beta', phone: '+923000000072' },
  ];
  const fields = (r: (typeof rows)[number]) => [r.name, r.phone];

  it('returns every row for an empty query, as a copy', () => {
    const out = filterBySearch(rows, '', fields);
    expect(out).toEqual(rows);
    expect(out).not.toBe(rows);
  });

  it('keeps only the matching rows', () => {
    expect(filterBySearch(rows, 'beta', fields).map((r) => r.name)).toEqual(['Test Beta']);
    expect(filterBySearch(rows, '0300 0000071', fields).map((r) => r.name)).toEqual(['Test Alpha']);
    expect(filterBySearch(rows, 'gamma', fields)).toEqual([]);
  });
});
