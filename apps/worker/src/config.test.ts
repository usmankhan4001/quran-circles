import { describe, expect, it } from 'vitest';
import { POSTER_ENV_NAMES, WorkerConfigError, missingPosterEnv, parseWorkerEnv } from './config';

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

  it('reads the occurrence horizon, defaulting to the API value of 90 days', () => {
    expect(parseWorkerEnv(base).OCCURRENCE_HORIZON_DAYS).toBe(90);
    expect(
      parseWorkerEnv({ ...base, OCCURRENCE_HORIZON_DAYS: '120' }).OCCURRENCE_HORIZON_DAYS,
    ).toBe(120);
    for (const bad of ['0', '400', 'soon', '1.5']) {
      expect(() => parseWorkerEnv({ ...base, OCCURRENCE_HORIZON_DAYS: bad })).toThrow(
        /OCCURRENCE_HORIZON_DAYS/,
      );
    }
  });

  it('reads the WhatsApp limits, defaulting to one a day, 3000 a city a month and 80 %', () => {
    expect(parseWorkerEnv(base)).toMatchObject({
      WHATSAPP_DAILY_CAP: 1,
      WHATSAPP_CITY_MONTHLY_BUDGET: 3000,
      WHATSAPP_BUDGET_ALERT_PERCENT: 80,
    });
    expect(
      parseWorkerEnv({
        ...base,
        WHATSAPP_DAILY_CAP: '0',
        WHATSAPP_CITY_MONTHLY_BUDGET: '500',
        WHATSAPP_BUDGET_ALERT_PERCENT: '90',
      }),
    ).toMatchObject({
      WHATSAPP_DAILY_CAP: 0,
      WHATSAPP_CITY_MONTHLY_BUDGET: 500,
      WHATSAPP_BUDGET_ALERT_PERCENT: 90,
    });
    for (const [name, bad] of [
      ['WHATSAPP_DAILY_CAP', '6'],
      ['WHATSAPP_DAILY_CAP', '-1'],
      ['WHATSAPP_DAILY_CAP', 'unlimited'],
      ['WHATSAPP_CITY_MONTHLY_BUDGET', '-5'],
      ['WHATSAPP_CITY_MONTHLY_BUDGET', '1.5'],
      ['WHATSAPP_BUDGET_ALERT_PERCENT', '0'],
      ['WHATSAPP_BUDGET_ALERT_PERCENT', '101'],
    ] as const) {
      expect(() => parseWorkerEnv({ ...base, [name]: bad })).toThrow(new RegExp(name));
    }
  });

  it('reads the send tunables, with defaults that keep a burst inside one lease', () => {
    expect(parseWorkerEnv(base)).toMatchObject({
      WORKER_PUSH_CONCURRENCY: 4,
      WORKER_PUSH_BATCH_SIZE: 50,
      WORKER_PUSH_PARALLEL: 10,
      WORKER_PUSH_POLL_MS: 500,
      WORKER_PUSH_MAX_IN_FLIGHT: 2000,
      WORKER_MESSAGE_MAX_IN_FLIGHT: 100,
      WORKER_LEASE_MS: 300_000,
      WORKER_BUSY_POLL_MS: 1000,
    });
    expect(
      parseWorkerEnv({
        ...base,
        WORKER_PUSH_CONCURRENCY: '8',
        WORKER_PUSH_BATCH_SIZE: '100',
        WORKER_PUSH_PARALLEL: '20',
        WORKER_PUSH_POLL_MS: '1000',
        WORKER_PUSH_MAX_IN_FLIGHT: '5000',
        WORKER_MESSAGE_MAX_IN_FLIGHT: '50',
        WORKER_LEASE_MS: '600000',
        WORKER_BUSY_POLL_MS: '250',
      }),
    ).toMatchObject({
      WORKER_PUSH_CONCURRENCY: 8,
      WORKER_PUSH_BATCH_SIZE: 100,
      WORKER_PUSH_PARALLEL: 20,
      WORKER_PUSH_POLL_MS: 1000,
      WORKER_PUSH_MAX_IN_FLIGHT: 5000,
      WORKER_MESSAGE_MAX_IN_FLIGHT: 50,
      WORKER_LEASE_MS: 600_000,
      WORKER_BUSY_POLL_MS: 250,
    });
    for (const [name, bad] of [
      ['WORKER_PUSH_CONCURRENCY', '0'],
      ['WORKER_PUSH_BATCH_SIZE', '501'],
      ['WORKER_PUSH_PARALLEL', '0'],
      ['WORKER_PUSH_POLL_MS', '100'],
      ['WORKER_PUSH_MAX_IN_FLIGHT', '0'],
      ['WORKER_MESSAGE_MAX_IN_FLIGHT', 'lots'],
      ['WORKER_LEASE_MS', '1000'],
      ['WORKER_BUSY_POLL_MS', '10'],
    ] as const) {
      expect(() => parseWorkerEnv({ ...base, [name]: bad })).toThrow(new RegExp(name));
    }
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

describe('poster configuration', () => {
  const posterEnv = {
    RENDERER_URL: 'http://poster-renderer:8090',
    RENDERER_TOKEN: 'test-token-not-a-secret',
    POSTER_STORAGE_DIR: '/var/lib/qc/posters',
  };

  it('is optional: the worker configuration parses without it and names what is missing', () => {
    const config = parseWorkerEnv(base);
    expect(config.RENDERER_URL).toBeUndefined();
    expect(missingPosterEnv(config)).toEqual([...POSTER_ENV_NAMES]);
    expect(
      missingPosterEnv(
        parseWorkerEnv({
          ...base,
          APP_ENV: 'production',
          WHATSAPP_APP_SECRET: 's',
          WHATSAPP_VERIFY_TOKEN: 'v',
        }),
      ),
    ).toEqual([...POSTER_ENV_NAMES]);
  });

  it('reads the renderer, the storage directory and their defaults', () => {
    const config = parseWorkerEnv({ ...base, ...posterEnv });
    expect(config).toMatchObject({
      ...posterEnv,
      RENDERER_TIMEOUT_MS: 90_000,
      WORKER_POSTER_CONCURRENCY: 2,
    });
    expect(missingPosterEnv(config)).toEqual([]);
    expect(
      missingPosterEnv(parseWorkerEnv({ ...base, RENDERER_URL: posterEnv.RENDERER_URL })),
    ).toEqual(['RENDERER_TOKEN', 'POSTER_STORAGE_DIR']);
  });

  it('refuses a renderer URL that is not http(s) and a relative storage directory', () => {
    for (const bad of ['poster-renderer:8090', 'ftp://x', 'http://', 'http://a b']) {
      expect(() => parseWorkerEnv({ ...base, RENDERER_URL: bad }), bad).toThrow(/RENDERER_URL/);
    }
    expect(() => parseWorkerEnv({ ...base, POSTER_STORAGE_DIR: 'data/posters' })).toThrow(
      /POSTER_STORAGE_DIR/,
    );
  });

  it('keeps the renderer timeout under the queue expiry of 120 s', () => {
    expect(parseWorkerEnv({ ...base, RENDERER_TIMEOUT_MS: '30000' }).RENDERER_TIMEOUT_MS).toBe(
      30_000,
    );
    for (const bad of ['500', '120000', 'slow']) {
      expect(() => parseWorkerEnv({ ...base, RENDERER_TIMEOUT_MS: bad })).toThrow(
        /RENDERER_TIMEOUT_MS/,
      );
    }
  });

  it('never prints the token', () => {
    try {
      parseWorkerEnv({ ...base, RENDERER_TOKEN: 'leaky-test-token', RENDERER_URL: 'nope' });
      throw new Error('should have thrown');
    } catch (error) {
      expect((error as Error).message).toContain('RENDERER_URL');
      expect((error as Error).message).not.toContain('leaky-test-token');
    }
  });
});
