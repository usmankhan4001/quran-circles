import { describe, expect, it } from 'vitest';
import { contactUrl, formatPhoneDisplay, normalizePhone, telUrl, whatsappUrl } from './phone';

describe('normalizePhone', () => {
  it.each([
    ['0300 1234567', '+923001234567'],
    ['300-1234567', '+923001234567'],
    ['+92 300 1234567', '+923001234567'],
    ['0092 300 1234567', '+923001234567'],
    ['923001234567', '+923001234567'],
    ['(0300) 123.4567', '+923001234567'],
    ['+44 20 7946 0958', '+442079460958'],
    ['0044 20 7946 0958', '+442079460958'],
  ])('turns %s into %s', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it.each([
    '',
    '   ',
    'abc',
    '0300 abc 4567',
    '12',
    '+',
    '03001234567890123456',
    '+92+300',
    '++923001234567',
  ])('rejects %j', (input) => {
    expect(normalizePhone(input)).toBeNull();
  });
});

describe('phone links', () => {
  it('formats a Pakistan mobile for reading and leaves other numbers alone', () => {
    expect(formatPhoneDisplay('+923001234567')).toBe('+92 300 1234567');
    expect(formatPhoneDisplay('+442079460958')).toBe('+442079460958');
  });

  it('builds the dialler link', () => {
    expect(telUrl('+923001234567')).toBe('tel:+923001234567');
    expect(contactUrl('call', '+923001234567')).toBe('tel:+923001234567');
  });

  it('builds the WhatsApp link without the plus sign', () => {
    expect(whatsappUrl('+923001234567')).toBe('https://wa.me/923001234567');
    expect(contactUrl('whatsapp', '+923001234567')).toBe('https://wa.me/923001234567');
  });

  it('encodes WhatsApp message text', () => {
    expect(whatsappUrl('+923001234567', 'See you & welcome')).toBe(
      'https://wa.me/923001234567?text=See%20you%20%26%20welcome',
    );
  });
});
