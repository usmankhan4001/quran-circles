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
