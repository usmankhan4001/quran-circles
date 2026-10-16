import { describe, expect, it } from 'vitest';
import { pickLocalized } from './localized';

describe('pickLocalized', () => {
  it('uses Urdu for an Urdu reader when it exists, and says which language it is', () => {
    expect(pickLocalized({ en: 'Hello', ur: 'سلام' }, 'ur')).toEqual({ text: 'سلام', lang: 'ur' });
  });

  it('shows English, marked as English, when Urdu has not been written', () => {
    expect(pickLocalized({ en: 'Hello', ur: null }, 'ur')).toEqual({ text: 'Hello', lang: 'en' });
  });

  it('always uses English for an English reader', () => {
    expect(pickLocalized({ en: 'Hello', ur: 'سلام' }, 'en')).toEqual({ text: 'Hello', lang: 'en' });
  });
});
