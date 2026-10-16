import { z } from 'zod';
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
  /** The public https origin of the web app, for links in messages. */
  PUBLIC_WEB_BASE: optional,
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
