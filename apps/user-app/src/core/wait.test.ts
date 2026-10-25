import { describe, expect, it } from 'vitest';
import { messages } from '@qc/i18n';
import { createTranslator } from '../i18n/translate';
import { retryAfterText, waitOf } from './wait';

describe('waitOf', () => {
  it.each([
    [1, { unit: 'seconds', count: 1 }],
    [30, { unit: 'seconds', count: 30 }],
    [0.4, { unit: 'seconds', count: 1 }],
    [58.5, { unit: 'seconds', count: 59 }],
    [59.2, { unit: 'minutes', count: 1 }],
    [60, { unit: 'minutes', count: 1 }],
    [61, { unit: 'aboutMinutes', count: 2 }],
    [847, { unit: 'aboutMinutes', count: 15 }],
    [900, { unit: 'minutes', count: 15 }],
    [5339, { unit: 'aboutMinutes', count: 89 }],
    [5400, { unit: 'aboutHours', count: 2 }],
    [7200, { unit: 'hours', count: 2 }],
    [86_400, { unit: 'hours', count: 24 }],
  ])('says %j seconds as %j', (seconds, wait) => {
    expect(waitOf(seconds)).toEqual(wait);
  });

  it.each([null, undefined, 0, -5, Number.NaN, Number.POSITIVE_INFINITY])(
    'gives nothing for an unusable wait (%j)',
    (seconds) => {
      expect(waitOf(seconds)).toBeNull();
    },
  );
});

describe('retryAfterText', () => {
  const en = createTranslator('en');
  const ur = createTranslator('ur');

  it('words the wait in English, with the right plural', () => {
    expect(retryAfterText(en, 847)).toBe('Try again in about 15 minutes.');
    expect(retryAfterText(en, 1)).toBe('Try again in 1 second.');
    expect(retryAfterText(en, 45)).toBe('Try again in 45 seconds.');
    expect(retryAfterText(en, 3600 * 3)).toBe('Try again in 3 hours.');
  });

  it('words the wait in Urdu', () => {
    const text = retryAfterText(ur, 847);
    expect(text).not.toBe('');
    expect(text).not.toContain('signIn.');
    const [before] = messages.ur['signIn.wait.aboutMinutes.other'].split('{count}');
    expect(text.startsWith(before!)).toBe(true);
  });

  it('is empty when there is no usable wait', () => {
    expect(retryAfterText(en, undefined)).toBe('');
    expect(retryAfterText(en, 0)).toBe('');
  });
});
