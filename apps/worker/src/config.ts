import path from 'node:path';
import { z } from 'zod';
import { DEFAULT_OCCURRENCE_HORIZON_DAYS } from '@qc/db';
import { MessagingEnv } from '@qc/messaging';

const optional = z.string().trim().min(1).optional();

/** Everything the worker reads from the environment, including the messaging providers. */
export const WorkerEnv = MessagingEnv.extend({
  DATABASE_URL: z.string().trim().min(1),
  /** The port for the WhatsApp webhook and `/healthz`. */
  WORKER_HTTP_PORT: z.coerce.number().int().min(0).max(65535).default(8081),
  /** How often the dispatcher looks for due outbox rows. */
  WORKER_POLL_MS: z.coerce.number().int().min(250).max(60_000).default(5_000),
  WORKER_SEND_CONCURRENCY: z.coerce.number().int().min(1).max(32).default(4),
  /** How many days ahead the daily top-up keeps session occurrences. Same default as the API. */
  OCCURRENCE_HORIZON_DAYS: z.coerce
    .number()
    .int()
    .min(1)
    .max(366)
    .default(DEFAULT_OCCURRENCE_HORIZON_DAYS),
  /** The public https origin of the web app, for links in messages. */
  PUBLIC_WEB_BASE: optional,
  /** The poster renderer on the internal network, e.g. `http://poster-renderer:8090`. */
  RENDERER_URL: optional,
  /** The renderer's shared bearer token. Never logged. */
  RENDERER_TOKEN: optional,
  /** One renderer call gives up after this long; under the `poster-render` queue's 120 s expiry. */
  RENDERER_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(110_000).default(90_000),
  /** Absolute directory for rendered poster files (a volume); the API reads the same directory. */
  POSTER_STORAGE_DIR: optional,
  /** Poster jobs handled at once on this node. */
  WORKER_POSTER_CONCURRENCY: z.coerce.number().int().min(1).max(8).default(2),
});
export type WorkerEnv = z.infer<typeof WorkerEnv>;

export class WorkerConfigError extends Error {
  override name = 'WorkerConfigError';
}

/**
 * Parses and checks the environment. Names the offending variables but never their values, so a
 * misconfigured secret is not echoed into logs.
 */
export function parseWorkerEnv(env: Record<string, string | undefined>): WorkerEnv {
  const parsed = WorkerEnv.safeParse(env);
  if (!parsed.success) {
    const names = [...new Set(parsed.error.issues.map((i) => i.path.join('.') || '(environment)'))];
    throw new WorkerConfigError(`Invalid worker environment: ${names.join(', ')}`);
  }
  const value = parsed.data;
  if (value.PUBLIC_WEB_BASE && !/^https?:\/\/[^\s/]+(\/.*)?$/.test(value.PUBLIC_WEB_BASE)) {
    throw new WorkerConfigError('Invalid worker environment: PUBLIC_WEB_BASE');
  }
  if (value.RENDERER_URL && !/^https?:\/\/[^\s/]+(\/\S*)?$/.test(value.RENDERER_URL)) {
    throw new WorkerConfigError('Invalid worker environment: RENDERER_URL');
  }
  if (value.POSTER_STORAGE_DIR && !path.isAbsolute(value.POSTER_STORAGE_DIR)) {
    throw new WorkerConfigError('Invalid worker environment: POSTER_STORAGE_DIR must be absolute');
  }
  if (value.APP_ENV === 'production') {
    if (!value.WHATSAPP_APP_SECRET || !value.WHATSAPP_VERIFY_TOKEN) {
      // Without these the webhook would answer 503 forever: delivery receipts and STOP replies lost.
      throw new WorkerConfigError(
        'Invalid worker environment: WHATSAPP_APP_SECRET, WHATSAPP_VERIFY_TOKEN are required in production',
      );
    }
  }
  return value;
}

/** The poster variables, of which every one must be set for the `poster-render` queue to work. */
export const POSTER_ENV_NAMES = ['RENDERER_URL', 'RENDERER_TOKEN', 'POSTER_STORAGE_DIR'] as const;

/**
 * The poster variables that are unset. The worker starts without them; poster jobs then fail with
 * `render_failed` and a log line naming these variables (never their values).
 */
export const missingPosterEnv = (config: WorkerEnv): string[] =>
  POSTER_ENV_NAMES.filter((name) => !config[name]);
