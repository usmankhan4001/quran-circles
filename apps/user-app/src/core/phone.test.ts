import { describe, expect, it } from 'vitest';
import { formatPhoneForDisplay, normalizeCode, normalizePhone, toWesternDigits } from './phone';

describe('normalizePhone', () => {
  it.each([
    ['0300 1234567', '+923001234567'],
    ['300 1234567', '+923001234567'],
    ['+92 300 1234567', '+923001234567'],
    ['0092-300-1234567', '+923001234567'],
    ['923001234567', '+923001234567'],
    ['(0300) 123 4567', '+923001234567'],
  ])('reads %s as %s', (typed, expected) => {
    expect(normalizePhone(typed)).toBe(expected);
  });

  it('accepts Eastern Arabic and Urdu digits', () => {
    expect(toWesternDigits('٠٣٠٠')).toBe('0300');
    expect(normalizePhone('۰۳۰۰ ۱۲۳۴۵۶۷')).toBe('+923001234567');
    expect(normalizePhone('٠٣٠٠١٢٣٤٥٦٧')).toBe('+923001234567');
  });

  it.each(['', '   ', 'abc', '0300', '0300 12345', '+92 200 1234567', '12'])(
    'rejects %j',
    (typed) => {
      expect(normalizePhone(typed)).toBeNull();
    },
  );

  it('keeps a number from another country as typed', () => {
    expect(normalizePhone('+44 7700 900123')).toBe('+447700900123');
  });
});

describe('normalizeCode', () => {
  it('takes exactly six digits, with spaces or Urdu digits', () => {
    expect(normalizeCode('123456')).toBe('123456');
    expect(normalizeCode('123 456')).toBe('123456');
    expect(normalizeCode('١٢٣٤٥٦')).toBe('123456');
  });

  it('rejects anything else', () => {
    for (const bad of ['', '12345', '1234567', '12345a']) expect(normalizeCode(bad)).toBeNull();
  });
});

describe('formatPhoneForDisplay', () => {
  it('spaces a Pakistani number and leaves others alone', () => {
    expect(formatPhoneForDisplay('+923001234567')).toBe('+92 300 1234567');
    expect(formatPhoneForDisplay('+447700900123')).toBe('+447700900123');
  });
});
