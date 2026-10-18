import { z } from 'zod';

const optional = z.string().trim().min(1).optional();

/** Everything the renderer reads from the environment. No value here is a secret except the token. */
export const RendererEnv = z.object({
  /**
   * Fails closed (SEC-11): unset or empty means `production`, as in the API's auth config. Only an
   * explicit `development` or `test` runs without a token.
   */
  APP_ENV: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.enum(['development', 'test', 'staging', 'production']).default('production'),
  ),
  /** The port for `/render`, `/templates` and `/healthz`. */
  RENDERER_PORT: z.coerce.number().int().min(0).max(65535).default(8090),
  /** Address to listen on. Inside the compose network this is the container's own interface. */
  RENDERER_HOST: z.string().trim().min(1).default('0.0.0.0'),
  /**
   * Shared bearer token the api and the worker send. Required unless `APP_ENV` is exactly
   * `development` or `test`, so a service that can reach the renderer on the network still cannot
   * use it without the token.
   */
  RENDERER_TOKEN: z.string().trim().min(24).optional(),
  /** Renders running at once (one browser page each). */
  RENDER_CONCURRENCY: z.coerce.number().int().min(1).max(8).default(2),
  /** Renders allowed to wait for a slot; more than this answers 503 `busy`. */
  RENDER_QUEUE_MAX: z.coerce.number().int().min(0).max(100).default(8),
  /** Wall-clock limit for one render (all its formats), including waiting for fonts. */
  RENDER_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(120_000).default(20_000),
  /** JavaScript heap limit for each browser renderer process, in MB. */
  BROWSER_HEAP_MB: z.coerce.number().int().min(32).max(1024).default(128),
  /** Restart the browser after this many renders, so a slow leak cannot grow without bound. */
  BROWSER_RECYCLE_AFTER: z.coerce.number().int().min(1).max(10_000).default(100),
  /** Byte budget of the in-memory result cache. */
  RENDER_CACHE_BYTES: z.coerce
    .number()
    .int()
    .min(0)
    .max(1024 * 1024 * 1024)
    .default(64 * 1024 * 1024),
  /** A browser binary to use instead of Playwright's own (the container sets this). */
  CHROMIUM_PATH: optional,
  /** The public https origin of the web app. QR codes use it so a phone camera can open them. */
  PUBLIC_WEB_BASE: optional,
});
export type RendererEnv = z.infer<typeof RendererEnv>;

export class RendererConfigError extends Error {
  override name = 'RendererConfigError';
}

/** Parses the environment. Names the offending variables but never their values. */
export function parseRendererEnv(env: Record<string, string | undefined>): RendererEnv {
  const parsed = RendererEnv.safeParse(env);
  if (!parsed.success) {
    const names = [...new Set(parsed.error.issues.map((i) => i.path.join('.') || '(environment)'))];
    throw new RendererConfigError(`Invalid renderer environment: ${names.join(', ')}`);
  }
  const value = parsed.data;
  if (value.PUBLIC_WEB_BASE && !/^https:\/\/[^\s/]+\/?$/.test(value.PUBLIC_WEB_BASE)) {
    throw new RendererConfigError('Invalid renderer environment: PUBLIC_WEB_BASE');
  }
  const local = value.APP_ENV === 'development' || value.APP_ENV === 'test';
  if (!local && !value.RENDERER_TOKEN) {
    throw new RendererConfigError(
      'Invalid renderer environment: RENDERER_TOKEN is required unless APP_ENV is development or test',
    );
  }
  if (!local && !value.PUBLIC_WEB_BASE) {
    // Without it QR codes carry the app scheme, which a phone camera without the app cannot open.
    throw new RendererConfigError(
      'Invalid renderer environment: PUBLIC_WEB_BASE is required in staging and production',
    );
  }
  return value;
}
