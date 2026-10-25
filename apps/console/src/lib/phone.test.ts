import { E164_PATTERN } from '@qc/contracts';
import { describe, expect, it } from 'vitest';
import { formatPhone, maskPhone, normalizePhone, phoneTail, toAsciiDigits } from './phone';

const e164 = (input: string, mobileOnly = false) => {
  const r = normalizePhone(input, { mobileOnly });
  return r.ok ? r.e164 : r.issue;
};

describe('normalizePhone', () => {
  it.each([
    ['0300 1234567', '+923001234567'],
    ['03001234567', '+923001234567'],
    ['300-1234567', '+923001234567'],
    ['+92 300 1234567', '+923001234567'],
    ['0092 300 1234567', '+923001234567'],
    ['923001234567', '+923001234567'],
    ['(0300) 123.4567', '+923001234567'],
  ])('accepts the Pakistan mobile number %s', (input, expected) => {
    expect(e164(input)).toBe(expected);
    expect(E164_PATTERN.test(expected)).toBe(true);
  });

  it('reads Eastern Arabic and Urdu digits', () => {
    expect(toAsciiDigits('٠٣٠٠١٢٣٤٥٦٧')).toBe('03001234567');
    expect(e164('۰۳۰۰ ۱۲۳۴۵۶۷')).toBe('+923001234567');
  });

  it('accepts other countries only in full international form', () => {
    expect(e164('+14155550123')).toBe('+14155550123');
    expect(e164('+44 20 7946 0958')).toBe('+442079460958');
  });

  it('rejects empty, malformed and impossible numbers', () => {
    expect(e164('')).toBe('empty');
    expect(e164('   ')).toBe('empty');
    expect(e164('abc')).toBe('invalid');
    expect(e164('0300 12345')).toBe('invalid');
    expect(e164('+92 300 12345678')).toBe('invalid');
    expect(e164('+0123456')).toBe('invalid');
    expect(e164('+1')).toBe('invalid');
    expect(e164('0300-1234567-9')).toBe('invalid');
  });

  it('flags landlines when only mobiles are allowed', () => {
    expect(e164('051 2345678')).toBe('+92512345678');
    expect(e164('051 2345678', true)).toBe('not_mobile');
  });
});

describe('formatPhone', () => {
  it('spaces Pakistan mobiles and leaves anything else alone', () => {
    expect(formatPhone('+923001234567')).toBe('+92 300 1234567');
    expect(formatPhone('+14155550123')).toBe('+14155550123');
  });
});

describe('maskPhone and phoneTail', () => {
  it('keeps the country code and the last four digits of an E.164 number', () => {
    expect(maskPhone('+923001234567')).toBe('+92 ••• •••4567');
    expect(maskPhone('+14155550123')).toBe('+14 ••• •••0123');
    expect(maskPhone(' +923001234567 ')).toBe('+92 ••• •••4567');
  });

  it('never shows more than four digits of the number', () => {
    expect(maskPhone('+923001234567').replace(/[^0-9]/g, '')).toBe('924567');
    expect(maskPhone('+923001234567')).not.toContain('300');
  });

  it('keeps only the last four digits of something that is not E.164', () => {
    expect(maskPhone('0300 1234567')).toBe('••• •••4567');
    expect(maskPhone('۰۳۰۰۱۲۳۴۵۶۷')).toBe('••• •••4567');
  });

  it('shows the mask alone when there are fewer than four digits', () => {
    expect(maskPhone('')).toBe('••• •••');
    expect(maskPhone('+92')).toBe('••• •••');
    expect(maskPhone('abc')).toBe('••• •••');
  });

  it('gives the last four digits for screen readers', () => {
    expect(phoneTail('+923001234567')).toBe('4567');
    expect(phoneTail('12')).toBe('12');
  });
});
