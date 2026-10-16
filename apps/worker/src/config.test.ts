import { describe, expect, it } from 'vitest';
import { WorkerConfigError, parseWorkerEnv } from './config';

const base = { DATABASE_URL: 'postgres://qc:qc@localhost:5432/qc' };

describe('worker configuration', () => {
  it('has safe defaults in development', () => {
    const config = parseWorkerEnv(base);
    expect(config).toMatchObject({
      MESSAGING_MODE: 'fake',
      WORKER_HTTP_PORT: 8081,
      WORKER_POLL_MS: 5000,
      WORKER_SEND_CONCURRENCY: 4,
    });
  });

  it('requires a database', () => {
    expect(() => parseWorkerEnv({})).toThrow(WorkerConfigError);
  });

  it('reads numbers from strings and rejects nonsense', () => {
    expect(
      parseWorkerEnv({ ...base, WORKER_HTTP_PORT: '9000', WORKER_POLL_MS: '1000' }),
    ).toMatchObject({
      WORKER_HTTP_PORT: 9000,
      WORKER_POLL_MS: 1000,
    });
    expect(() => parseWorkerEnv({ ...base, WORKER_POLL_MS: '5' })).toThrow(/WORKER_POLL_MS/);
    expect(() => parseWorkerEnv({ ...base, WORKER_HTTP_PORT: 'abc' })).toThrow(/WORKER_HTTP_PORT/);
  });

  it('checks the public web origin', () => {
    expect(
      parseWorkerEnv({ ...base, PUBLIC_WEB_BASE: 'https://example.test' }).PUBLIC_WEB_BASE,
    ).toBe('https://example.test');
    expect(() => parseWorkerEnv({ ...base, PUBLIC_WEB_BASE: 'not a url' })).toThrow(
      /PUBLIC_WEB_BASE/,
    );
  });

  it('in production, insists on the webhook secrets', () => {
    expect(() => parseWorkerEnv({ ...base, APP_ENV: 'production' })).toThrow(/WHATSAPP_APP_SECRET/);
    expect(
      parseWorkerEnv({
        ...base,
        APP_ENV: 'production',
        WHATSAPP_APP_SECRET: 's',
        WHATSAPP_VERIFY_TOKEN: 'v',
      }),
    ).toMatchObject({ APP_ENV: 'production' });
  });

  it('names the broken variable but never prints its value', () => {
    try {
      parseWorkerEnv({ ...base, WORKER_POLL_MS: 'super-secret-looking-value' });
      throw new Error('should have thrown');
    } catch (error) {
      expect((error as Error).message).toContain('WORKER_POLL_MS');
      expect((error as Error).message).not.toContain('super-secret-looking-value');
    }
  });
});
