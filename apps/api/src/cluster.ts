import { z } from 'zod';
import type { Logger } from './middleware/logger';

/**
 * Several API processes in one container (`API_PROCESSES`), with `node:cluster`.
 *
 * A Node process serves on one core. With `API_PROCESSES` at 2 or more, `index.ts` becomes a small
 * primary that forks that many copies of the server; they share port 3000 (the primary accepts
 * connections and hands them out in turn) and the database. The primary serves no requests and
 * opens no database connection: it keeps the shared rate limits (`middleware/shared-limits.ts`),
 * restarts a copy that dies (with a growing wait), and on SIGTERM or SIGINT passes SIGTERM to every
 * copy so each finishes its requests and closes its connections, then exits.
 *
 * At 1 (the default) there is no primary: `index.ts` serves in the one process, as before.
 */

export const API_PROCESSES_MAX = 8;

/** What the entry point reads from the environment before it decides how to start. */
export const ApiProcessEnv = z.object({
  /** How many server processes to run in this container. 1 runs no cluster at all. */
  API_PROCESSES: z.coerce.number().int().min(1).max(API_PROCESSES_MAX).default(1),
});

/** `API_PROCESSES` from the environment, or an error that names the variable (never its value). */
export function apiProcessesFromEnv(env: Record<string, string | undefined>): number {
  const parsed = ApiProcessEnv.safeParse({ API_PROCESSES: env.API_PROCESSES });
  if (!parsed.success) {
    throw new Error(`API_PROCESSES must be a whole number from 1 to ${API_PROCESSES_MAX}`);
  }
  return parsed.data.API_PROCESSES;
}

/** The parts of a `cluster.Worker` the supervisor uses. */
export interface WorkerHandle {
  readonly id: number;
  readonly process: { readonly pid?: number | undefined; kill(signal?: NodeJS.Signals): boolean };
  send(message: unknown, sendHandle: undefined, callback: (error: Error | null) => void): boolean;
  isConnected(): boolean;
  on(event: 'error', listener: (error: Error) => void): unknown;
}

/** The parts of `node:cluster` (primary side) the supervisor uses. */
export interface ClusterHandle {
  fork(): WorkerHandle;
  on(event: 'listening', listener: (worker: WorkerHandle) => void): unknown;
  on(
    event: 'exit',
    listener: (worker: WorkerHandle, code: number | null, signal: string | null) => void,
  ): unknown;
  on(event: 'message', listener: (worker: WorkerHandle, message: unknown) => void): unknown;
}

export interface SupervisorOptions {
  cluster: ClusterHandle;
  processes: number;
  logger: Logger;
  /** Called for every message a worker sends (the shared limits). */
  onMessage?: (worker: WorkerHandle, message: unknown) => void;
  /** Wait before the first restart after a crash; it doubles for each crash in a row. */
  restartBaseMs?: number;
  /** The longest wait between restarts. */
  restartMaxMs?: number;
  /** A worker that served this long before it died starts the waits from the beginning again. */
  stableAfterMs?: number;
  /** On shutdown, workers still running after this are killed. Under compose's `stop_grace_period`. */
  shutdownTimeoutMs?: number;
  /** `process.exit` in production. */
  exit: (code: number) => void;
  now?: () => number;
}

export interface Supervisor {
  /** Passes SIGTERM to every worker and exits once they have all stopped. */
  shutdown(signal: string): void;
  /** Workers currently running. */
  readonly running: number;
}

interface Slot {
  worker: WorkerHandle;
  forkedAt: number;
  listening: boolean;
}

/**
 * Starts `processes` workers and keeps that many running.
 *
 * - A worker that dies is replaced after `restartBaseMs`, doubling for each crash in a row up to
 *   `restartMaxMs`; one that had served for `stableAfterMs` resets the wait. Logged with the exit
 *   code or signal only.
 * - A worker that dies before any worker has ever served is a start-up failure (bad configuration,
 *   database refused): the primary stops the others and exits 1, so the container restarts and its
 *   health check shows it, the same as one process failing to start.
 * - `shutdown`: no more restarts, SIGTERM to each worker (not `worker.kill()`, which would cut the
 *   IPC channel the shared limits need while requests finish), exit 0 when all have stopped, or
 *   SIGKILL and exit 1 after `shutdownTimeoutMs`.
 */
export function superviseWorkers(options: SupervisorOptions): Supervisor {
  const {
    cluster,
    processes,
    logger,
    exit,
    restartBaseMs = 1_000,
    restartMaxMs = 30_000,
    stableAfterMs = 60_000,
    shutdownTimeoutMs = 12_000,
  } = options;
  const now = options.now ?? Date.now;
  const slots = new Map<number, Slot>();
  const restarts = new Set<ReturnType<typeof setTimeout>>();
  let everServed = false;
  let crashStreak = 0;
  let stopping = false;
  let killTimer: ReturnType<typeof setTimeout> | null = null;
  let exited = false;
  /** 0 after a requested shutdown, 1 after a start-up failure. */
  let exitCodeOnStop = 0;

  const finish = (code: number): void => {
    if (exited) return;
    exited = true;
    if (killTimer) clearTimeout(killTimer);
    exit(code);
  };

  const fork = (): void => {
    const worker = cluster.fork();
    // An IPC error (a reply to a worker that just died) must not take the primary down.
    worker.on('error', (error) => {
      logger.warn('api process channel error', { worker: worker.id, errorName: error.name });
    });
    slots.set(worker.id, { worker, forkedAt: now(), listening: false });
  };

  cluster.on('listening', (worker) => {
    const slot = slots.get(worker.id);
    if (!slot || slot.listening) return;
    slot.listening = true;
    everServed = true;
    logger.info('api process listening', { worker: worker.id, pid: worker.process.pid });
  });

  cluster.on('message', (worker, message) => {
    options.onMessage?.(worker, message);
  });

  cluster.on('exit', (worker, code, signal) => {
    const slot = slots.get(worker.id);
    if (!slot) return;
    slots.delete(worker.id);

    if (stopping) {
      logger.info('api process stopped', { worker: worker.id, exitCode: code, signal });
      if (slots.size === 0) finish(exitCodeOnStop);
      return;
    }

    if (!everServed) {
      logger.error('api process failed to start', { worker: worker.id, exitCode: code, signal });
      exitCodeOnStop = 1;
      stopAll();
      if (slots.size === 0) finish(1);
      return;
    }

    if (slot.listening && now() - slot.forkedAt >= stableAfterMs) crashStreak = 0;
    const waitMs = Math.min(restartBaseMs * 2 ** crashStreak, restartMaxMs);
    crashStreak += 1;
    logger.error('api process exited', {
      worker: worker.id,
      exitCode: code,
      signal,
      restartInMs: waitMs,
    });
    const timer = setTimeout(() => {
      restarts.delete(timer);
      if (!stopping) fork();
    }, waitMs);
    restarts.add(timer);
  });

  function stopAll(): void {
    stopping = true;
    for (const timer of restarts) clearTimeout(timer);
    restarts.clear();
    for (const { worker } of slots.values()) {
      try {
        worker.process.kill('SIGTERM');
      } catch {
        // Already gone; its exit event follows.
      }
    }
    killTimer = setTimeout(() => {
      logger.error('api processes did not stop in time', { running: slots.size });
      for (const { worker } of slots.values()) {
        try {
          worker.process.kill('SIGKILL');
        } catch {
          // Already gone.
        }
      }
      finish(1);
    }, shutdownTimeoutMs);
    killTimer.unref?.();
  }

  for (let i = 0; i < processes; i += 1) fork();

  return {
    shutdown(signal: string): void {
      if (stopping) return;
      logger.info('api stopping', { signal, running: slots.size });
      stopAll();
      if (slots.size === 0) finish(exitCodeOnStop);
    },
    get running() {
      return slots.size;
    },
  };
}
