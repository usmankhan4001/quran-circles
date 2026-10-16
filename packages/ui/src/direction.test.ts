import { describe, expect, it } from 'vitest';
import {
  directionForLocale,
  endSide,
  flippingIcons,
  formatNumber,
  iconFlipTransform,
  iconNames,
  isolate,
  isRtl,
  ltrRun,
  rtlMark,
  shouldFlipIcon,
  startSide,
  textAlignStart,
} from './index';

describe('direction helpers', () => {
  it('maps Urdu to right-to-left and English to left-to-right', () => {
    expect(directionForLocale('ur')).toBe('rtl');
    expect(directionForLocale('ur-PK')).toBe('rtl');
    expect(directionForLocale('UR')).toBe('rtl');
    expect(directionForLocale('en')).toBe('ltr');
    expect(directionForLocale('en-GB')).toBe('ltr');
    expect(directionForLocale('')).toBe('ltr');
    expect(directionForLocale('xx')).toBe('ltr');
  });

  it('knows the other right-to-left languages the app may add', () => {
    for (const l of ['ar', 'fa', 'he']) expect(directionForLocale(l)).toBe('rtl');
  });

  it('gives the physical start and end sides', () => {
    expect(startSide('ltr')).toBe('left');
    expect(endSide('ltr')).toBe('right');
    expect(startSide('rtl')).toBe('right');
    expect(endSide('rtl')).toBe('left');
    expect(textAlignStart('rtl')).toBe('right');
    expect(textAlignStart('ltr')).toBe('left');
    expect(isRtl('rtl')).toBe(true);
    expect(isRtl('ltr')).toBe(false);
  });
});

describe('icon mirroring', () => {
  it('mirrors pointing icons in right-to-left only', () => {
    for (const name of [
      'chevron-forward',
      'chevron-back',
      'arrow-forward',
      'arrow-back',
      'send',
      'undo',
    ]) {
      expect(shouldFlipIcon(name, 'rtl'), name).toBe(true);
      expect(shouldFlipIcon(name, 'ltr'), name).toBe(false);
      expect(iconFlipTransform(name, 'rtl')).toEqual({ transform: [{ scaleX: -1 }] });
      expect(iconFlipTransform(name, 'ltr')).toBeUndefined();
    }
  });

  it('never mirrors objects and fixed concepts', () => {
    for (const name of [
      'check',
      'close',
      'plus',
      'clock',
      'search',
      'phone',
      'bell',
      'play',
      'chevron-down',
      'chevron-up',
      'info',
      'warning',
      'error',
      'success',
    ]) {
      expect(shouldFlipIcon(name, 'rtl'), name).toBe(false);
    }
  });

  it('only the horizontal chevrons of the kit icons flip', () => {
    const flipping = iconNames.filter((n) => flippingIcons.has(n)).sort();
    expect(flipping).toEqual(['chevron-back', 'chevron-forward']);
  });
});

describe('mixed-direction text', () => {
  it('wraps a run in first-strong isolates', () => {
    expect(isolate('Dora')).toBe('⁨Dora⁩');
  });

  it('forces a left-to-right run and marks the end of a right-to-left run', () => {
    expect(ltrRun('0300')).toBe('‎0300‎');
    expect(rtlMark()).toBe('‏');
  });
});

describe('numerals', () => {
  it('uses Western digits for both languages by default', () => {
    expect(formatNumber(2026, 'en')).toBe('2026');
    expect(formatNumber(2026, 'ur')).toBe('2026');
  });

  it('can switch to Eastern Arabic (Urdu) digits in one place', () => {
    expect(formatNumber(1234567890, 'ur', 'eastern-arabic')).toBe('۱۲۳۴۵۶۷۸۹۰');
  });

  it('leaves non-digits alone', () => {
    expect(formatNumber('99+', 'ur', 'eastern-arabic')).toBe('۹۹+');
    expect(formatNumber('', 'en')).toBe('');
  });
});
