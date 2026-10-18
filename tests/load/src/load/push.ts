import { performance } from 'node:perf_hooks';
import { errorCode } from '../http';
import { as, type Api, type Person } from '../people';

/**
 * The push burst: a national admin posts a national announcement with `notify: true`, which
 * queues one push per active person with a device into the outbox in the same request; the
 * worker then claims the rows and sends them through the (fake, local) push provider. Measured:
 * the post's latency, how many rows it queued, and how long the worker took to send them all.
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
  rowsQueued: number;
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

export async function pushBurst(
  api: Api,
  admin: Person,
  probe: DrainProbe,
  options: { timeoutS?: number; label?: string; loadEndsAt?: number } = {},
): Promise<PushBurstResult> {
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
    { timeoutMs: 120_000 },
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
  let last: OutboxCounts = await probe.counts(updateId);
  const rowsQueued =
    probe.kind === 'database'
      ? last.queued + last.sending + last.sent + last.other
      : (posted.recipients ?? 0);
  const delta = (c: OutboxCounts): OutboxCounts =>
    baseline
      ? {
          queued: c.queued - baseline.queued,
          sending: c.sending - baseline.sending,
          sent: c.sent - baseline.sent,
          other: c.other - baseline.other,
        }
      : c;
  let done = false;
  let underLoad: { sent: number; seconds: number } | null = null;
  let lastSent = 0;
  let lastProgress = answeredAt;
  while (performance.now() < deadline) {
    const d = delta(last);
    const now = performance.now();
    if (first === null && d.sent > 0) first = now;
    if (d.sent > lastSent) {
      lastSent = d.sent;
      lastProgress = now;
    }
    if (underLoad === null && options.loadEndsAt !== undefined && now >= options.loadEndsAt) {
      underLoad = { sent: d.sent, seconds: (now - answeredAt) / 1000 };
    }
    // Remote counts are global (reminders queued for later, other bursts), so remotely the burst
    // is drained when the sent count has grown and then stood still for 5 s.
    if (
      probe.kind === 'database'
        ? d.queued + d.sending === 0
        : lastSent > 0 && now - lastProgress >= 5000
    ) {
      done = true;
      break;
    }
    await sleep(1000);
    last = await probe.counts(updateId);
  }
  const finishedAt = probe.kind === 'database' ? performance.now() : lastProgress;
  const final = delta(last);
  const allSentS = done ? (finishedAt - answeredAt) / 1000 : null;
  if (underLoad === null && allSentS !== null) underLoad = { sent: final.sent, seconds: allSentS };
  return {
    postStatus: res.status,
    postCode: null,
    postMs: Math.round(res.ms),
    recipients: posted.recipients ?? 0,
    rowsQueued,
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

/** Reads the worker's `/healthz` outbox counts (global; the burst is measured as a delta). */
export function healthzProbe(workerUrl: string): DrainProbe {
  return {
    kind: 'worker-healthz',
    async counts() {
      const res = await fetch(`${workerUrl.replace(/\/+$/, '')}/healthz`);
      const body = (await res.json()) as { details?: Record<string, number> };
      const d = body.details ?? {};
      const queued = d.queued ?? 0;
      const sending = d.sending ?? 0;
      const sent = d.sent ?? 0;
      const total = Object.values(d).reduce((s, v) => s + v, 0);
      return { queued, sending, sent, other: total - queued - sending - sent };
    },
  };
}
