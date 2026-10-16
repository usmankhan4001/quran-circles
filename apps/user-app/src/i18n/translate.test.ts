import { describe, expect, it } from 'vitest';
import { messages } from '@qc/i18n';
import { createTranslator, pluralForm } from './translate';

describe('translator', () => {
  it('translates and fills placeholders in both languages', () => {
    const en = createTranslator('en');
    const ur = createTranslator('ur');
    expect(en('tabs.home')).toBe('Home');
    expect(ur('tabs.home')).toBe(messages.ur['tabs.home']);
    expect(en('session.schedule.everyDay', { time: '9:00 pm' })).toBe('Every day at 9:00 pm');
  });

  it('picks one for exactly 1 and other for everything else', () => {
    const t = createTranslator('en');
    expect(pluralForm(1)).toBe('one');
    expect(pluralForm(0)).toBe('other');
    expect(pluralForm(2)).toBe('other');
    expect(t('session.duration', { count: 1 })).toBe('1 minute');
    expect(t('session.duration', { count: 90 })).toBe('90 minutes');
    expect(t('session.duration', { count: 0 })).toBe('0 minutes');
  });

  it('formats counts inside plural forms', () => {
    const t = createTranslator('en');
    expect(t('signIn.code.resendIn', { count: 1 })).toBe('Send again in 1 second');
    expect(t('signIn.code.resendIn', { count: 30 })).toBe('Send again in 30 seconds');
  });

  it('falls back to English, then to the key, so a gap is visible', () => {
    const t = createTranslator('ur');
    // @ts-expect-error a key that does not exist
    expect(t('nope.missing')).toBe('nope.missing');
  });

  it('leaves a placeholder alone when the value is not given', () => {
    const t = createTranslator('en');
    expect(t('session.schedule.onDays', { days: 'Mon' })).toBe('Mon at {time}');
  });
});
