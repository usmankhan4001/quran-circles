import { describe, expect, it } from 'vitest';
import {
  bilingualOf,
  emptyBilingual,
  isBilingualEmpty,
  pickLocalized,
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
