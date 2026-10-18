import { performance } from 'node:perf_hooks';
import { errorCode } from '../http';
import { as, type Api, type Person } from '../people';

/**
 * The push burst: a national admin posts a national announcement with `notify: true`. The API
 * marks the update `push_pending_since` and answers; the worker then writes one push per active
 * person with a device into the outbox (the fan-out), claims the rows and sends them through the
 * (fake, local) push provider. Measured: the post's latency, how long the fan-out took, how many
 * rows were queued, and how long the worker took to send them all. While the fan-out is pending
 * the outbox holds no rows for the update, so the burst is not drained until it has been written.
 */
export interface OutboxCounts {
  queued: number;
  sending: number;
  sent: number;
  /** Anything else: failed, dead, skipped. */
  other: number;
  /** Database probe only: rows whose lease ran out before they were sent (`worker_lost`). */
  workerLost?: number;
  /** Database probe only: the highest attempt count of the update's rows. */
  maxAttempts?: number;
  /**
   * Updates whose push rows the worker has not written yet: 0 or 1 for this update (database,
   * `updates.push_pending_since`), every update (healthz, `metrics.updatePushesPending`). Not set
   * when the worker does not report it.
   */
  pushesPending?: number;
}

/** How the burst's progress is read: from the database locally, from the worker's /healthz remotely. */
export interface DrainProbe {
  kind: 'database' | 'worker-healthz';
  /** Counts for this update (database), or global counts (healthz). */
  counts(updateId: string): Promise<OutboxCounts>;
}

export interface PushBurstResult {
  postStatus: number;
  postCode: string | null;
  postMs: number;
  recipients: number;
  /** Database: the update's rows at the end. Healthz: the post's recipient count. */
  rowsQueued: number;
  /** Seconds from the post's answer until the worker had written the push rows (fan-out done). */
  pushesWrittenS: number | null;
  /** Seconds from the post's answer to the first and the last row sent. */
  firstSentS: number | null;
  allSentS: number | null;
  drainPerSecond: number | null;
  /** Rows sent while the step's virtual users were still running, and the rate then. */
  sentUnderLoad: number | null;
  underLoadPerSecond: number | null;
  final: OutboxCounts;
  probe: DrainProbe['kind'];
  timedOut: boolean;
}

const sleep = (ms: number): Promise<void> => new Promise((done) => setTimeout(done, ms));

const pending = (c: OutboxCounts): boolean => (c.pushesPending ?? 0) > 0;

export async function pushBurst(
  api: Api,
  admin: Person,
  probe: DrainProbe,
  options: {
    timeoutS?: number;
    label?: string;
    loadEndsAt?: number;
    /** How often the probe is read (default 1 s). */
    pollMs?: number;
    /** Healthz only: how long the sent count must stand still to count as drained (default 5 s). */
    settleMs?: number;
  } = {},
): Promise<PushBurstResult> {
  const pollMs = options.pollMs ?? 1000;
  const settleMs = options.settleMs ?? 5000;
  const baseline = probe.kind === 'worker-healthz' ? await probe.counts('') : null;
  const res = await as(
    api,
    admin,
    'adminUpdates.post',
    {
      body: {
        scope: { type: 'national' },
        kind: 'announcement',
        title: { en: `Taraweeh tonight ${options.label ?? ''}`.trim() },
        body: { en: 'Synthetic load-test announcement.' },
        notify: true,
      },
    },
    { timeoutMs: 120_000, ...(api.options?.fetch ? { fetch: api.options.fetch } : {}) },
  );
  const answeredAt = performance.now();
  const posted = res.body as { id?: string; recipients?: number } | null;
  if (res.status !== 201 || !posted?.id) {
    return {
      postStatus: res.status,
      postCode: errorCode(res.body),
      postMs: Math.round(res.ms),
      recipients: 0,
      rowsQueued: 0,
      pushesWrittenS: null,
      firstSentS: null,
      allSentS: null,
      drainPerSecond: null,
      sentUnderLoad: null,
      underLoadPerSecond: null,
      final: { queued: 0, sending: 0, sent: 0, other: 0 },
      probe: probe.kind,
      timedOut: false,
    };
  }
  const updateId = posted.id;
  const deadline = answeredAt + (options.timeoutS ?? 900) * 1000;
  let first: number | null = null;
  let written: number | null = null;
  let last: OutboxCounts = await probe.counts(updateId);
  // Remote counts are global, so the burst is their growth since just before the post. The
  // pending fan-out count and the lost-lease counter keep their meaning (absolute, and growth).
  const delta = (c: OutboxCounts): OutboxCounts =>
    baseline
      ? {
          queued: c.queued - baseline.queued,
          sending: c.sending - baseline.sending,
          sent: c.sent - baseline.sent,
          other: c.other - baseline.other,
          ...(c.workerLost !== undefined
            ? { workerLost: c.workerLost - (baseline.workerLost ?? 0) }
            : {}),
          ...(c.pushesPending !== undefined ? { pushesPending: c.pushesPending } : {}),
        }
      : c;
  let done = false;
  let underLoad: { sent: number; seconds: number } | null = null;
  let lastSent = 0;
  let lastProgress = answeredAt;
  while (performance.now() < deadline) {
    const d = delta(last);
    const now = performance.now();
    if (written === null && !pending(d)) written = now;
    if (first === null && d.sent > 0) first = now;
    if (d.sent > lastSent) {
      lastSent = d.sent;
      lastProgress = now;
    }
    if (underLoad === null && options.loadEndsAt !== undefined && now >= options.loadEndsAt) {
      underLoad = { sent: d.sent, seconds: (now - answeredAt) / 1000 };
    }
    // Nothing is drained while the worker has still to write the pushes: until then the update has
    // no rows at all. Remote counts are global (reminders queued for later, other bursts), so
    // remotely the burst is drained when the sent count has grown and then stood still for 5 s,
    // counted from the fan-out at the earliest (other traffic may have stood still before it).
    if (
      !pending(d) &&
      written !== null &&
      (probe.kind === 'database'
        ? d.queued + d.sending === 0
        : lastSent > 0 && now - Math.max(lastProgress, written) >= settleMs)
    ) {
      done = true;
      break;
    }
    await sleep(pollMs);
    last = await probe.counts(updateId);
  }
  const finishedAt = probe.kind === 'database' ? performance.now() : lastProgress;
  const final = delta(last);
  // Locally the rows the fan-out wrote are known only once it is done, so they come from the end.
  const rowsQueued =
    probe.kind === 'database'
      ? final.queued + final.sending + final.sent + final.other
      : (posted.recipients ?? 0);
  const allSentS = done ? (finishedAt - answeredAt) / 1000 : null;
  if (underLoad === null && allSentS !== null) underLoad = { sent: final.sent, seconds: allSentS };
  return {
    postStatus: res.status,
    postCode: null,
    postMs: Math.round(res.ms),
    recipients: posted.recipients ?? 0,
    rowsQueued,
    pushesWrittenS: written === null ? null : Math.round((written - answeredAt) / 100) / 10,
    firstSentS: first === null ? null : Math.round((first - answeredAt) / 100) / 10,
    allSentS: allSentS === null ? null : Math.round(allSentS * 10) / 10,
    drainPerSecond: allSentS ? Math.round(final.sent / allSentS) : null,
    sentUnderLoad: underLoad?.sent ?? null,
    underLoadPerSecond:
      underLoad && underLoad.seconds > 0 ? Math.round(underLoad.sent / underLoad.seconds) : null,
    final,
    probe: probe.kind,
    timedOut: !done,
  };
}

const count = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? v : undefined;

/**
 * Reads the worker's `/healthz`: `details` are the outbox counts by status (global; the burst is
 * measured as a delta), `metrics.updatePushesPending` the updates whose pushes are not written
 * yet, `metrics.workerLost` the leases that ran out since the worker started.
 */
export function healthzProbe(workerUrl: string, fetchImpl: typeof fetch = fetch): DrainProbe {
  return {
    kind: 'worker-healthz',
    async counts() {
      const res = await fetchImpl(`${workerUrl.replace(/\/+$/, '')}/healthz`);
      const body = (await res.json()) as {
        details?: Record<string, number>;
        metrics?: Record<string, unknown>;
      };
      const d = body.details ?? {};
      const queued = d.queued ?? 0;
      const sending = d.sending ?? 0;
      const sent = d.sent ?? 0;
      const total = Object.values(d).reduce((s, v) => s + v, 0);
      const pushesPending = count(body.metrics?.updatePushesPending);
      const workerLost = count(body.metrics?.workerLost);
      return {
        queued,
        sending,
        sent,
        other: total - queued - sending - sent,
        ...(pushesPending !== undefined ? { pushesPending } : {}),
        ...(workerLost !== undefined ? { workerLost } : {}),
      };
    },
  };
}
