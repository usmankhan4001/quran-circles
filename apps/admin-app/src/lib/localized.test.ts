import { describe, expect, it } from 'vitest';
import {
  bilingualOf,
  emptyBilingual,
  isBilingualEmpty,
  localizedSearchText,
  pickLocalized,
  shownBilingual,
  toLocalizedInput,
  toLocalizedOptional,
} from './localized';

describe('pickLocalized', () => {
  it('picks the language of the person and falls back to English', () => {
    expect(pickLocalized({ en: 'Hello', ur: 'سلام' }, 'ur')).toBe('سلام');
    expect(pickLocalized({ en: 'Hello', ur: 'سلام' }, 'en')).toBe('Hello');
    expect(pickLocalized({ en: 'Hello', ur: null }, 'ur')).toBe('Hello');
  });

  it('gives an empty string for nothing', () => {
    expect(pickLocalized(null, 'en')).toBe('');
    expect(pickLocalized(undefined, 'ur')).toBe('');
  });

  it('counts blank Urdu as none and shows English', () => {
    expect(pickLocalized({ en: 'Hello', ur: '  ' }, 'ur')).toBe('Hello');
    expect(pickLocalized({ en: 'Hello', ur: '' }, 'ur')).toBe('Hello');
  });
});

describe('localizedSearchText', () => {
  it('holds both languages so either name finds the place', () => {
    const text = localizedSearchText({ en: 'Masjid Noor', ur: 'مسجد نور' });
    expect(text).toContain('Masjid Noor');
    expect(text).toContain('مسجد نور');
  });

  it('is the English alone without Urdu, and empty for nothing', () => {
    expect(localizedSearchText({ en: 'Masjid Noor', ur: null })).toBe('Masjid Noor');
    expect(localizedSearchText({ en: 'Masjid Noor', ur: ' ' })).toBe('Masjid Noor');
    expect(localizedSearchText(null)).toBe('');
  });
});

describe('shownBilingual', () => {
  it("leads with the reader's language and adds the other one", () => {
    const v = { en: 'Masjid Noor', ur: 'مسجد نور' };
    expect(shownBilingual(v, 'ur')).toEqual({
      main: { text: 'مسجد نور', lang: 'ur' },
      second: { text: 'Masjid Noor', lang: 'en' },
    });
    expect(shownBilingual(v, 'en')).toEqual({
      main: { text: 'Masjid Noor', lang: 'en' },
      second: { text: 'مسجد نور', lang: 'ur' },
    });
  });

  it('falls back to the other language when the reader language is empty', () => {
    expect(shownBilingual({ en: 'Masjid Noor', ur: '' }, 'ur')).toEqual({
      main: { text: 'Masjid Noor', lang: 'en' },
      second: null,
    });
    expect(shownBilingual({ en: ' ', ur: 'مسجد نور' }, 'en')).toEqual({
      main: { text: 'مسجد نور', lang: 'ur' },
      second: null,
    });
  });

  it('does not repeat the same text, and is null when both are empty', () => {
    expect(shownBilingual({ en: 'Noor', ur: 'Noor' }, 'ur')?.second).toBeNull();
    expect(shownBilingual(emptyBilingual(), 'en')).toBeNull();
  });
});

describe('bilingual fields', () => {
  it('starts empty and reads null as empty text', () => {
    expect(emptyBilingual()).toEqual({ en: '', ur: '' });
    expect(bilingualOf(null)).toEqual({ en: '', ur: '' });
    expect(bilingualOf({ en: 'Hello', ur: null })).toEqual({ en: 'Hello', ur: '' });
  });

  it('counts blank text as empty', () => {
    expect(isBilingualEmpty({ en: '  ', ur: '' })).toBe(true);
    expect(isBilingualEmpty({ en: '', ur: 'سلام' })).toBe(false);
  });

  it('makes contract input and trims', () => {
    expect(toLocalizedInput({ en: ' Hello ', ur: '' })).toEqual({ en: 'Hello', ur: null });
    expect(toLocalizedInput({ en: 'Hello', ur: 'سلام' })).toEqual({ en: 'Hello', ur: 'سلام' });
    expect(toLocalizedInput({ en: '', ur: '' })).toBeNull();
  });

  it('lets Urdu stand in for the required English text', () => {
    expect(toLocalizedInput({ en: '', ur: 'سلام' })).toEqual({ en: 'سلام', ur: 'سلام' });
  });

  it('leaves Urdu out of the optional form when empty', () => {
    expect(toLocalizedOptional({ en: 'Hello', ur: '' })).toEqual({ en: 'Hello' });
    expect(toLocalizedOptional({ en: 'Hello', ur: 'سلام' })).toEqual({ en: 'Hello', ur: 'سلام' });
    expect(toLocalizedOptional(emptyBilingual())).toBeNull();
  });
});
