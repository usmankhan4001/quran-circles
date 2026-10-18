import { describe, expect, it } from 'vitest';
import { createMemoryLogger, sanitizeFields } from './logger';

describe('logger', () => {
  it('drops fields named like personal data', () => {
    const out = sanitizeFields({
      outboxId: 'abc',
      phone: '+923000000001',
      recipientPhoneE164: '+923000000001',
      to: '+923000000001',
      body: 'Assalamu alaikum',
      name: 'Aisha',
      token: 'device-token',
      code: '123456',
      variables: 'x',
      attempts: 2,
    });
    expect(out).toEqual({ outboxId: 'abc', attempts: 2 });
  });

  it('redacts phone-shaped values under innocent keys', () => {
    expect(sanitizeFields({ detail: 'sent to +923000000001' })).toEqual({ detail: '[redacted]' });
    expect(sanitizeFields({ detail: '923000000001' })).toEqual({ detail: '[redacted]' });
    expect(sanitizeFields({ detail: 'wa_131026' })).toEqual({ detail: 'wa_131026' });
  });

  it('keeps canonical UUIDs, even when every group is digits', () => {
    const allDigits = '12345678-1234-4123-8123-123456789012';
    const nil = '00000000-0000-4000-8000-000000000000';
    const hex = '3f2b8c1e-9a4d-4c7b-8e21-5d6f7a8b9c0d';
    expect(sanitizeFields({ cityId: allDigits })).toEqual({ cityId: allDigits });
    expect(sanitizeFields({ cityId: nil.toUpperCase() })).toEqual({ cityId: nil.toUpperCase() });
    expect(sanitizeFields({ detail: `budget for ${allDigits} and ${hex}` })).toEqual({
      detail: `budget for ${allDigits} and ${hex}`,
    });
    const logger = createMemoryLogger();
    logger.warn('messaging.city_budget_reached', { cityId: allDigits, spentMinor: 120000 });
    expect(logger.lines[0]?.fields).toEqual({ cityId: allDigits, spentMinor: 120000 });
  });

  it('still redacts phone numbers next to or inside longer strings with UUIDs', () => {
    const id = '12345678-1234-4123-8123-123456789012';
    for (const detail of [
      `${id} sent to +923000000001`,
      `+92 300 0000001 for ${id}`,
      `city ${id}, number 0300-0000001`,
      `${id}923000000001`,
      `923000000001${id}`,
      `ref:923000000001-${id}`,
      `${id}-0300 0000001`,
      // Not a canonical UUID (a group too long), so the digit run counts.
      '123456789-1234-4123-8123-123456789012',
    ]) {
      expect(sanitizeFields({ detail }), detail).toEqual({ detail: '[redacted]' });
    }
  });

  it('applies the filter to every level', () => {
    const logger = createMemoryLogger();
    logger.debug('a', { phone: '+923000000001' });
    logger.info('b', { phone: '+923000000001' });
    logger.warn('c', { phone: '+923000000001' });
    logger.error('d', { phone: '+923000000001' });
    expect(logger.dump()).not.toContain('923000000001');
    expect(logger.lines.map((l) => l.level)).toEqual(['debug', 'info', 'warn', 'error']);
  });
});
