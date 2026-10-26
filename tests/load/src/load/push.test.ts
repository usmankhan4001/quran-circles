import { describe, expect, it } from 'vitest';
import { Synthetic, type Api, type Person } from '../people';
import { burstTimeline, healthzProbe, pushBurst, type DrainProbe, type OutboxCounts } from './push';

/**
 * The push burst's drain logic against scripted probes: no network (a fake fetch answers the
 * post), no database. Since migration 0011 the API only marks the update `push_pending_since`;
 * the worker writes the rows a moment later, so the probe first sees no rows at all.
 */

const UPDATE_ID = '00000000-0000-4000-8000-000000000042';

const admin: Person = {
  label: 'national admin',
  userId: '00000000-0000-4000-8000-000000000001',
  token: 'token-admin',
  refreshToken: 'refresh-admin',
  ip: '10.0.0.1',
  me: {
    id: '00000000-0000-4000-8000-000000000001',
    email: null,
    phone: '+923130000000',
    displayName: null,
    locale: 'en',
    createdAt: '2026-10-18T00:00:00Z',
    profile: {} as Person['me']['profile'],
    roles: [],
  },
};

const json = (status: number, data: unknown): Response =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

/** An API whose national post answers 201 for `recipients` people, and counts the posts. */
function postingApi(recipients: number, status = 201): { api: Api; posts: () => number } {
  let posts = 0;
  const fetchFake: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    if (url.pathname !== '/v1/admin/updates' || init?.method !== 'POST') {
      throw new Error(`unexpected call ${init?.method ?? 'GET'} ${url.pathname}`);
    }
    posts += 1;
    return status === 201
      ? json(201, { id: UPDATE_ID, recipients })
      : json(status, { error: { code: 'forbidden', message: 'x', requestId: 'r' } });
  };
  return {
    api: {
      baseUrl: 'http://127.0.0.1:1',
      fixedCode: '000000',
      synthetic: new Synthetic('+92313', 1),
      options: { fetch: fetchFake },
    },
    posts: () => posts,
  };
}

const counts = (c: Partial<OutboxCounts>): OutboxCounts => ({
  queued: 0,
  sending: 0,
  sent: 0,
  other: 0,
  ...c,
});

/** Answers each read with the next scripted counts, then keeps answering the last. */
function scriptedProbe(kind: DrainProbe['kind'], script: OutboxCounts[]) {
  const ids: string[] = [];
  let i = 0;
  const probe: DrainProbe = {
    kind,
    async counts(updateId) {
      ids.push(updateId);
      const c = script[Math.min(i, script.length - 1)] as OutboxCounts;
      i += 1;
      return c;
    },
  };
  return { probe, reads: () => i, ids };
}

const fast = { pollMs: 1, settleMs: 20 } as const;

describe('push burst, database probe', () => {
  it('is not drained while the fan-out is pending, and counts the rows the worker wrote', async () => {
    const { api } = postingApi(1000);
    const { probe, reads, ids } = scriptedProbe('database', [
      // The post has answered; the worker has not written the rows yet.
      counts({ pushesPending: 1, workerLost: 0, maxAttempts: 0 }),
      counts({ pushesPending: 1, workerLost: 0, maxAttempts: 0 }),
      counts({ pushesPending: 1, workerLost: 0, maxAttempts: 0 }),
      // Written and claimed.
      counts({ queued: 400, sending: 600, pushesPending: 0, workerLost: 0, maxAttempts: 1 }),
      counts({ queued: 0, sending: 500, sent: 500, pushesPending: 0, maxAttempts: 1 }),
      counts({ sent: 998, other: 2, pushesPending: 0, workerLost: 0, maxAttempts: 1 }),
    ]);
    const result = await pushBurst(api, admin, probe, fast);
    expect(result.timedOut).toBe(false);
    expect(reads()).toBe(6);
    expect(new Set(ids)).toEqual(new Set([UPDATE_ID]));
    expect(result.rowsQueued).toBe(1000);
    expect(result.recipients).toBe(1000);
    expect(result.final).toMatchObject({ sent: 998, other: 2, pushesPending: 0 });
    expect(result.pushesWrittenS).not.toBeNull();
    expect(result.firstSentS).not.toBeNull();
    expect(result.allSentS).not.toBeNull();
    expect(result.firstSentS as number).toBeGreaterThanOrEqual(result.pushesWrittenS as number);
  });

  it('drains at once for an empty audience (no rows and no fan-out mark)', async () => {
    const { api } = postingApi(0);
    const { probe, reads } = scriptedProbe('database', [counts({ pushesPending: 0 })]);
    const result = await pushBurst(api, admin, probe, fast);
    expect(reads()).toBe(1);
    expect(result.timedOut).toBe(false);
    expect(result.rowsQueued).toBe(0);
    expect(result.firstSentS).toBeNull();
  });

  it('times out, rather than reporting a drain, when the fan-out never happens', async () => {
    const { api } = postingApi(1000);
    const { probe } = scriptedProbe('database', [counts({ pushesPending: 1 })]);
    const result = await pushBurst(api, admin, probe, { ...fast, timeoutS: 0.05 });
    expect(result.timedOut).toBe(true);
    expect(result.allSentS).toBeNull();
    expect(result.pushesWrittenS).toBeNull();
    expect(result.drainPerSecond).toBeNull();
    expect(result.rowsQueued).toBe(0);
  });

  it('reports a refused post without reading the probe', async () => {
    const { api, posts } = postingApi(0, 403);
    const { probe, reads } = scriptedProbe('database', [counts({})]);
    const result = await pushBurst(api, admin, probe, fast);
    expect(posts()).toBe(1);
    expect(reads()).toBe(0);
    expect(result).toMatchObject({ postStatus: 403, postCode: 'forbidden', rowsQueued: 0 });
    expect(result.pushesWrittenS).toBeNull();
  });
});

describe('push burst, worker /healthz probe', () => {
  it('waits for metrics.updatePushesPending to reach 0 even when the global sent count stands still', async () => {
    const { api } = postingApi(500);
    const { probe } = scriptedProbe('worker-healthz', [
      // Baseline before the post: 10 sent earlier, 3 leases already lost.
      counts({ sent: 10, pushesPending: 0, workerLost: 3 }),
      // After the post: another update's rows trickle out, then stand still for longer than the
      // settle time, while this update's pushes are still to be written.
      counts({ sent: 12, pushesPending: 1, workerLost: 3 }),
      ...Array.from({ length: 60 }, () => counts({ sent: 12, pushesPending: 1, workerLost: 3 })),
      // Written; sent, then standing still.
      counts({ queued: 300, sending: 200, sent: 12, pushesPending: 0, workerLost: 3 }),
      counts({ sent: 512, pushesPending: 0, workerLost: 3 }),
    ]);
    const result = await pushBurst(api, admin, probe, fast);
    expect(result.timedOut).toBe(false);
    expect(result.final.sent).toBe(502);
    expect(result.final.workerLost).toBe(0);
    expect(result.rowsQueued).toBe(500);
    expect(result.pushesWrittenS).not.toBeNull();
    expect(result.probe).toBe('worker-healthz');
  });

  it('reads details, the pending fan-out count and the lost-lease counter from /healthz', async () => {
    const seen: string[] = [];
    const fetchFake: typeof fetch = async (input) => {
      seen.push(String(input));
      return json(200, {
        ok: true,
        details: { queued: 5, sending: 7, sent: 100, dead: 2, failed: 1 },
        metrics: { workerLost: 4, updatePushesPending: 2, claimed: 9 },
      });
    };
    const probe = healthzProbe('http://127.0.0.1:2/', fetchFake);
    expect(probe.kind).toBe('worker-healthz');
    expect(await probe.counts('')).toEqual({
      queued: 5,
      sending: 7,
      sent: 100,
      other: 3,
      pushesPending: 2,
      workerLost: 4,
    });
    expect(seen).toEqual(['http://127.0.0.1:2/healthz']);
  });

  it('leaves the fan-out count unset for a worker that does not report it', async () => {
    const fetchFake: typeof fetch = async () => json(200, { ok: true, details: { sent: 1 } });
    const c = await healthzProbe('http://127.0.0.1:2', fetchFake).counts('');
    expect(c).toEqual({ queued: 0, sending: 0, sent: 1, other: 0 });
    expect('pushesPending' in c).toBe(false);
  });
});

describe('push burst, worker /healthz?update= probe (per update)', () => {
  const times = {
    postedAt: '2026-10-18T19:00:00.000Z',
    writtenAt: '2026-10-18T19:00:00.800Z',
    firstSentAt: '2026-10-18T19:00:01.000Z',
    lastSentAt: '2026-10-18T19:00:03.000Z',
  };

  it("drains on the update's own rows, however much else the worker sends meanwhile", async () => {
    const { api } = postingApi(840);
    const { probe, ids } = scriptedProbe('worker-healthz', [
      // Baseline (global): the virtual users' confirmations keep the global sent count growing.
      counts({ sent: 50, pushesPending: 0 }),
      counts({ pushesPending: 1, perUpdate: true }),
      counts({ queued: 600, sending: 240, pushesPending: 0, perUpdate: true }),
      counts({ sent: 839, other: 1, pushesPending: 0, perUpdate: true, times }),
    ]);
    const result = await pushBurst(api, admin, probe, fast);
    expect(result.timedOut).toBe(false);
    expect(result.perUpdate).toBe(true);
    // No baseline subtracted from the update's own counts, and rows taken from them.
    expect(result.final).toMatchObject({ sent: 839, other: 1 });
    expect(result.rowsQueued).toBe(840);
    expect(result.timeline).toEqual({
      writtenS: 0.8,
      firstSentS: 1,
      lastSentS: 3,
      sendPerSecond: 419,
    });
    // The baseline read is global (''), every later read asks for the update.
    expect(ids[0]).toBe('');
    expect(new Set(ids.slice(1))).toEqual(new Set([UPDATE_ID]));
  });

  it("keeps waiting while the update's rows are queued, and times out rather than guess", async () => {
    const { api } = postingApi(840);
    const { probe } = scriptedProbe('worker-healthz', [
      counts({ sent: 0, pushesPending: 0 }),
      counts({ queued: 840, pushesPending: 0, perUpdate: true }),
    ]);
    const result = await pushBurst(api, admin, probe, { ...fast, timeoutS: 0.05 });
    expect(result.timedOut).toBe(true);
    expect(result.allSentS).toBeNull();
    expect(result.drainPerSecond).toBeNull();
  });

  it('asks /healthz?update=<id> and reads the per-update block', async () => {
    const seen: string[] = [];
    const fetchFake: typeof fetch = async (input) => {
      seen.push(String(input));
      return json(200, {
        ok: true,
        details: { sent: 9999 },
        metrics: { workerLost: 7, updatePushesPending: 3 },
        update: {
          pushPending: false,
          ...times,
          rows: 840,
          queued: 1,
          sending: 2,
          sent: 830,
          other: 7,
          workerLost: 0,
          maxAttempts: 1,
        },
      });
    };
    const c = await healthzProbe('http://127.0.0.1:2/', fetchFake).counts(UPDATE_ID);
    expect(seen).toEqual([`http://127.0.0.1:2/healthz?update=${UPDATE_ID}`]);
    expect(c).toEqual({
      queued: 1,
      sending: 2,
      sent: 830,
      other: 7,
      workerLost: 0,
      maxAttempts: 1,
      pushesPending: 0,
      perUpdate: true,
      times,
    });
  });

  it('falls back to the global counts when the worker does not answer per update', async () => {
    const fetchFake: typeof fetch = async () =>
      json(200, { ok: true, details: { sent: 5 }, metrics: { updatePushesPending: 0 } });
    const c = await healthzProbe('http://127.0.0.1:2', fetchFake).counts(UPDATE_ID);
    expect(c).toEqual({ queued: 0, sending: 0, sent: 5, other: 0, pushesPending: 0 });
    expect(c.perUpdate).toBeUndefined();
    // An unknown update (null) also falls back rather than reading as an empty, drained burst.
    const unknown: typeof fetch = async () => json(200, { ok: true, details: {}, update: null });
    expect((await healthzProbe('http://127.0.0.1:2', unknown).counts(UPDATE_ID)).perUpdate).toBe(
      undefined,
    );
  });

  it('builds no send rate from fewer than two sends, and no timeline without times', () => {
    expect(burstTimeline(undefined, 10)).toBeNull();
    expect(
      burstTimeline(
        { postedAt: times.postedAt, writtenAt: null, firstSentAt: null, lastSentAt: null },
        0,
      ),
    ).toEqual({ writtenS: null, firstSentS: null, lastSentS: null, sendPerSecond: null });
    expect(burstTimeline({ ...times, lastSentAt: times.firstSentAt }, 1)?.sendPerSecond).toBeNull();
  });
});
