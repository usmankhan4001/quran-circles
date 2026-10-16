import { describe, expect, it } from 'vitest';
import { createTranslator } from '../../i18n/translate';
import { safeWebUrl, venueMapUrl, venuePhoneUrl } from './links';
import { describePortion } from './portion';

describe('links', () => {
  it('opens the venue in maps by its coordinates', () => {
    expect(venueMapUrl({ lat: 33.6, lng: 73.05 })).toBe(
      'https://www.google.com/maps/search/?api=1&query=33.6,73.05',
    );
  });

  it('dials the venue’s number', () => {
    expect(venuePhoneUrl('+923001234567')).toBe('tel:+923001234567');
  });

  it('opens only web addresses that came from the server', () => {
    expect(safeWebUrl('https://meet.example/abc')).toBe('https://meet.example/abc');
    expect(safeWebUrl('http://example.com')).toBe('http://example.com/');
    for (const bad of ['javascript:alert(1)', 'file:///etc/passwd', 'tel:123', 'not a url', '']) {
      expect(safeWebUrl(bad)).toBeNull();
    }
  });
});

describe('describePortion', () => {
  const t = createTranslator('en');
  it('says what the session reads', () => {
    expect(
      describePortion({ portion: { kind: 'para', para: 5 }, portionLabel: null }, t, 'en'),
    ).toBe('Para 5');
    expect(
      describePortion({ portion: { kind: 'surah', surah: 36 }, portionLabel: null }, t, 'en'),
    ).toBe('Surah 36');
    expect(
      describePortion(
        { portion: { kind: 'ayah_range', surah: 36, fromAyah: 1, toAyah: 12 }, portionLabel: null },
        t,
        'en',
      ),
    ).toBe('Surah 36, ayahs 1 to 12');
    expect(
      describePortion(
        { portion: { kind: 'lesson', title: 'Patience' }, portionLabel: null },
        t,
        'en',
      ),
    ).toBe('Patience');
  });

  it('falls back to the coordinator’s label, or nothing', () => {
    expect(describePortion({ portion: null, portionLabel: 'Revision' }, t, 'en')).toBe('Revision');
    expect(describePortion({ portion: null, portionLabel: null }, t, 'en')).toBeNull();
  });
});
