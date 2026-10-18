import { describe, expect, it } from 'vitest';
import { parseRendererEnv, RendererConfigError } from './config';

const TOKEN = 'test-token-not-a-secret-0123456789';

describe('parseRendererEnv', () => {
  it('has safe defaults for development', () => {
    const env = parseRendererEnv({ APP_ENV: 'development' });
    expect(env).toMatchObject({
      APP_ENV: 'development',
      RENDERER_PORT: 8090,
      RENDER_CONCURRENCY: 2,
      RENDER_QUEUE_MAX: 8,
      RENDER_TIMEOUT_MS: 20_000,
      BROWSER_HEAP_MB: 128,
    });
    expect(env.RENDERER_TOKEN).toBeUndefined();
  });

  it('fails closed: with APP_ENV unset or empty it is production and needs the token (SEC-11)', () => {
    for (const env of [{}, { APP_ENV: '' }, { APP_ENV: undefined }]) {
      expect(() => parseRendererEnv(env)).toThrow(RendererConfigError);
      expect(() => parseRendererEnv({ ...env, PUBLIC_WEB_BASE: 'https://example.org' })).toThrow(
        /RENDERER_TOKEN/,
      );
      const started = parseRendererEnv({
        ...env,
        RENDERER_TOKEN: TOKEN,
        PUBLIC_WEB_BASE: 'https://example.org',
      });
      expect(started.APP_ENV).toBe('production');
      expect(started.RENDERER_TOKEN).toBe(TOKEN);
    }
  });

  it('runs without a token only when APP_ENV is exactly development or test', () => {
    for (const APP_ENV of ['development', 'test']) {
      expect(parseRendererEnv({ APP_ENV }).RENDERER_TOKEN).toBeUndefined();
    }
    for (const APP_ENV of ['Development', 'dev', 'TEST', ' test', 'local', 'prod']) {
      expect(() => parseRendererEnv({ APP_ENV }), APP_ENV).toThrow(/APP_ENV/);
      expect(() =>
        parseRendererEnv({
          APP_ENV,
          RENDERER_TOKEN: TOKEN,
          PUBLIC_WEB_BASE: 'https://example.org',
        }),
      ).toThrow(RendererConfigError);
    }
  });

  it('requires a token and the public web origin in staging and production', () => {
    for (const APP_ENV of ['staging', 'production']) {
      expect(() => parseRendererEnv({ APP_ENV, PUBLIC_WEB_BASE: 'https://example.org' })).toThrow(
        /RENDERER_TOKEN/,
      );
      expect(() => parseRendererEnv({ APP_ENV, RENDERER_TOKEN: TOKEN })).toThrow(/PUBLIC_WEB_BASE/);
      expect(
        parseRendererEnv({ APP_ENV, RENDERER_TOKEN: TOKEN, PUBLIC_WEB_BASE: 'https://example.org' })
          .APP_ENV,
      ).toBe(APP_ENV);
    }
  });

  it('refuses limits outside their range and names the variable, never the value', () => {
    try {
      parseRendererEnv({ RENDER_CONCURRENCY: '64', RENDERER_TOKEN: 'short-secret-value' });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(RendererConfigError);
      const message = (error as Error).message;
      expect(message).toContain('RENDER_CONCURRENCY');
      expect(message).toContain('RENDERER_TOKEN');
      expect(message).not.toContain('short-secret-value');
    }
  });

  it('accepts only an https origin with no path for QR links', () => {
    const dev = { APP_ENV: 'development' };
    expect(() => parseRendererEnv({ ...dev, PUBLIC_WEB_BASE: 'http://example.org' })).toThrow(
      /PUBLIC_WEB_BASE/,
    );
    expect(() => parseRendererEnv({ ...dev, PUBLIC_WEB_BASE: 'https://example.org/app' })).toThrow(
      /PUBLIC_WEB_BASE/,
    );
    expect(
      parseRendererEnv({ ...dev, PUBLIC_WEB_BASE: 'https://example.org' }).PUBLIC_WEB_BASE,
    ).toBe('https://example.org');
  });
});
