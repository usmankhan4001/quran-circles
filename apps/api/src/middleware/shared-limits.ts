import { z } from 'zod';
import { InMemoryRateLimiter, type RateLimiter as SignInRateLimiter } from '../auth';
import { MemoryRateLimiter, type RateLimiter, type RateLimitRule } from './rate-limit';

/**
 * Rate limits shared by every API process in one container (`API_PROCESSES` above 1).
 *
 * The limits stay where they always were, in memory, but in one place: the cluster primary keeps
 * the two existing limiters (the contract buckets and per-staff allowances in `rate-limit.ts`, the
 * sign-in limits per number, per address and for refresh in `auth/rate-limiter.ts`) and the worker
 * processes ask it over the cluster's IPC channel. The primary handles one message at a time, so a
 * limit is exact across processes: two processes can never both take the last slot. Same classes,
 * same semantics, same answers as one process.
 *
 * Keys are the limiters' own (user ids and hashed addresses, never phone numbers). Nothing is
 * logged. If the primary does not answer, the call fails and the request answers 500: a limit is
 * never skipped.
 *
 * Several containers would need a shared store instead (Postgres); `infra/ENV.md` says so.
 */

const Rule = z.object({
  limit: z.number().int().min(1),
  windowSeconds: z.number().int().min(1),
});

export const LimitRequest = z.discriminatedUnion('op', [
  z.object({
    type: z.literal('qc:limit'),
    id: z.number().int(),
    op: z.literal('consume'),
    key: z.string().min(1).max(512),
    rule: Rule,
    nowMs: z.number(),
  }),
  z.object({
    type: z.literal('qc:limit'),
    id: z.number().int(),
    op: z.literal('hit'),
    key: z.string().min(1).max(512),
    rule: Rule,
    nowMs: z.number(),
  }),
  z.object({
    type: z.literal('qc:limit'),
    id: z.number().int(),
    op: z.literal('reset'),
    key: z.string().min(1).max(512),
  }),
]);
export type LimitRequest = z.infer<typeof LimitRequest>;

export interface LimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export type LimitReply =
  | { type: 'qc:limit-reply'; id: number; ok: true; result: LimitResult }
  | { type: 'qc:limit-reply'; id: number; ok: false };

const isRequest = (msg: unknown): boolean =>
  typeof msg === 'object' && msg !== null && (msg as { type?: unknown }).type === 'qc:limit';

const isReply = (msg: unknown): msg is LimitReply =>
  typeof msg === 'object' &&
  msg !== null &&
  (msg as { type?: unknown }).type === 'qc:limit-reply' &&
  typeof (msg as { id?: unknown }).id === 'number';

/** The primary's side: the one copy of every counter. */
export class SharedLimitStore {
  constructor(
    readonly buckets: MemoryRateLimiter = new MemoryRateLimiter(),
    readonly signIn: InMemoryRateLimiter = new InMemoryRateLimiter(),
  ) {}

  /**
   * Answers one worker message. `null` for messages that are not limit requests (the caller
   * ignores them). A malformed request gets `ok: false`, so the worker fails the request.
   */
  async handle(message: unknown): Promise<LimitReply | null> {
    if (!isRequest(message)) return null;
    const parsed = LimitRequest.safeParse(message);
    if (!parsed.success) {
      const id = (message as { id?: unknown }).id;
      return typeof id === 'number' ? { type: 'qc:limit-reply', id, ok: false } : null;
    }
    const req = parsed.data;
    try {
      return { type: 'qc:limit-reply', id: req.id, ok: true, result: await this.apply(req) };
    } catch {
      return { type: 'qc:limit-reply', id: req.id, ok: false };
    }
  }

  private async apply(req: LimitRequest): Promise<LimitResult> {
    switch (req.op) {
      case 'consume':
        return this.buckets.consume(req.key, req.rule, req.nowMs);
      case 'hit': {
        const r = await this.signIn.hit(req.key, req.rule, new Date(req.nowMs));
        return r.allowed ? { allowed: true, retryAfterSeconds: 0 } : r;
      }
      case 'reset':
        await this.signIn.reset(req.key);
        return { allowed: true, retryAfterSeconds: 0 };
    }
  }
}

/** How a worker talks to the primary. `processChannel()` in production, a fake in tests. */
export interface LimitChannel {
  send(message: LimitRequest): void;
  onMessage(listener: (message: unknown) => void): void;
  onClose(listener: () => void): void;
}

/** The worker's IPC channel to the cluster primary. */
export function processChannel(proc: NodeJS.Process = process): LimitChannel {
  return {
    send: (message) => {
      if (!proc.send || !proc.connected) throw new Error('no channel to the primary');
      proc.send(message);
    },
    onMessage: (listener) => {
      proc.on('message', listener);
    },
    onClose: (listener) => {
      proc.on('disconnect', listener);
    },
  };
}

export class SharedLimitUnavailable extends Error {
  override name = 'SharedLimitUnavailable';
}

interface Pending {
  resolve: (result: LimitResult) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

/** The worker's side: sends each call to the primary and waits for its answer. */
export class SharedLimitClient {
  private nextId = 1;
  private readonly pending = new Map<number, Pending>();
  private closed = false;

  constructor(
    private readonly channel: LimitChannel,
    private readonly timeoutMs = 5_000,
  ) {
    channel.onMessage((message) => {
      if (!isReply(message)) return;
      const entry = this.pending.get(message.id);
      if (!entry) return;
      this.pending.delete(message.id);
      clearTimeout(entry.timer);
      if (message.ok) entry.resolve(message.result);
      else entry.reject(new SharedLimitUnavailable('the primary refused the limit request'));
    });
    channel.onClose(() => {
      this.closed = true;
      for (const [id, entry] of this.pending) {
        this.pending.delete(id);
        clearTimeout(entry.timer);
        entry.reject(new SharedLimitUnavailable('the channel to the primary closed'));
      }
    });
  }

  /** Calls waiting for an answer. For tests. */
  get inFlight(): number {
    return this.pending.size;
  }

  request(body: DistributiveOmit<LimitRequest, 'type' | 'id'>): Promise<LimitResult> {
    if (this.closed) {
      return Promise.reject(new SharedLimitUnavailable('the channel to the primary closed'));
    }
    const id = this.nextId++;
    return new Promise<LimitResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new SharedLimitUnavailable('the primary did not answer in time'));
      }, this.timeoutMs);
      timer.unref?.();
      this.pending.set(id, { resolve, reject, timer });
      try {
        this.channel.send({ ...body, type: 'qc:limit', id } as LimitRequest);
      } catch {
        this.pending.delete(id);
        clearTimeout(timer);
        reject(new SharedLimitUnavailable('could not reach the primary'));
      }
    });
  }
}

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** The contract buckets and per-staff allowances (`AppDeps.rateLimiter`), kept by the primary. */
export function sharedBucketLimiter(client: SharedLimitClient): RateLimiter {
  return {
    consume: (key: string, rule: RateLimitRule, nowMs: number) =>
      client.request({ op: 'consume', key, rule: ruleOf(rule), nowMs }),
  };
}

/** The sign-in limits (`AuthDeps.rateLimiter`), kept by the primary. */
export function sharedSignInLimiter(client: SharedLimitClient): SignInRateLimiter {
  return {
    hit: async (key, rule, now) => {
      const r = await client.request({ op: 'hit', key, rule: ruleOf(rule), nowMs: now.getTime() });
      return r.allowed
        ? { allowed: true }
        : { allowed: false, retryAfterSeconds: r.retryAfterSeconds };
    },
    reset: async (key) => {
      await client.request({ op: 'reset', key });
    },
  };
}

const ruleOf = (rule: RateLimitRule): RateLimitRule => ({
  limit: rule.limit,
  windowSeconds: rule.windowSeconds,
});
