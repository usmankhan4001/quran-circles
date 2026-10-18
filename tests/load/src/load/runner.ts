import { performance } from 'node:perf_hooks';
import type { EndpointId } from '@qc/contracts';
import { call, endpointDef, errorCode, type CallInput, type CallResult } from '../http';
import type { Person } from '../people';
import { Recorder, summarize, type Summary } from '../stats';
import { OPS, type Op, type ScenarioFile } from './scenario';

/**
 * The Ramadan-evening journey, closed model: each virtual user (VU) loops "open the app, look at
 * Nearby, open a session or two, maybe register, check the feed badge", with think time between
 * screens. Each iteration acts as the next synthetic attendee from the pool, so per-person rate
 * limits see realistic per-person traffic. The same journey is in `k6/ramadan-evening.js`.
 */

export type Outcome =
  'ok' | 'expected_4xx' | 'unexpected_4xx' | 'rate_limited' | 'server_error' | 'network_error';

/** Business answers that are part of the journey, not failures. */
const EXPECTED_CODES = new Set([
  'already_registered',
  'session_full',
  'registration_closed',
  'occurrence_in_past',
]);

export function classify(res: Pick<CallResult, 'status' | 'body'>): Outcome {
  if (res.status === 0) return 'network_error';
  if (res.status >= 500) return 'server_error';
  if (res.status === 429) return 'rate_limited';
  if (res.status >= 400) {
    const code = errorCode(res.body);
    return code && EXPECTED_CODES.has(code) ? 'expected_4xx' : 'unexpected_4xx';
  }
  return 'ok';
}

export interface JourneyContext {
  baseUrl: string;
  scenario: ScenarioFile;
  cityId: string;
  areaIds: readonly string[];
  center: { lat: number; lng: number };
  sessionIds: readonly string[];
  users: readonly Person[];
  recorder: Recorder;
  /** Test seam. */
  fetch?: typeof fetch;
  random?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number): Promise<void> => new Promise((done) => setTimeout(done, ms));

/** One refresh per person at a time: two journeys of the same person share it. */
const refreshing = new WeakMap<Person, Promise<void>>();

export function refreshTokens(
  ctx: Pick<JourneyContext, 'baseUrl' | 'recorder' | 'fetch'>,
  user: Person,
): Promise<void> {
  const inFlight = refreshing.get(user);
  if (inFlight) return inFlight;
  const run = (async () => {
    const res = await call(
      ctx.baseUrl,
      'auth.refresh',
      { body: { refreshToken: user.refreshToken }, ip: user.ip },
      ctx.fetch ? { fetch: ctx.fetch } : {},
    );
    ctx.recorder.record('token_refresh', res.ms, classify(res));
    const tokens = res.body as { accessToken?: string; refreshToken?: string } | null;
    if (res.status === 200 && tokens?.accessToken && tokens.refreshToken) {
      user.token = tokens.accessToken;
      user.refreshToken = tokens.refreshToken;
    }
  })().finally(() => refreshing.delete(user));
  refreshing.set(user, run);
  return run;
}

export async function journey(ctx: JourneyContext, user: Person): Promise<void> {
  const rnd = ctx.random ?? Math.random;
  const sleep = ctx.sleep ?? defaultSleep;
  const j = ctx.scenario.journey;
  const think = (): Promise<void> => sleep(j.thinkMs[0] + rnd() * (j.thinkMs[1] - j.thinkMs[0]));
  const pick = <T>(items: readonly T[]): T => items[Math.floor(rnd() * items.length)] as T;
  const send = (id: EndpointId, input: CallInput): Promise<CallResult> =>
    call(
      ctx.baseUrl,
      id,
      { ...input, token: user.token, ip: user.ip },
      ctx.fetch ? { fetch: ctx.fetch } : {},
    );
  const op = async (name: Op, id: EndpointId, input: CallInput): Promise<CallResult> => {
    let res = await send(id, input);
    // Access tokens last 15 minutes. The app refreshes and retries, so does the journey; the
    // refresh is measured as its own operation and the first 401 is not counted.
    if (res.status === 401 && endpointDef(id).auth !== 'public') {
      await refreshTokens(ctx, user);
      res = await send(id, input);
    }
    ctx.recorder.record(name, res.ms, classify(res));
    return res;
  };

  const spread = ctx.scenario.seed.spreadDeg / 2;
  const lat = Number((ctx.center.lat + (rnd() * 2 - 1) * spread).toFixed(5));
  const lng = Number((ctx.center.lng + (rnd() * 2 - 1) * spread).toFixed(5));

  await op('config', 'config.get', { query: { cityId: ctx.cityId } });
  const nearby =
    rnd() < j.filteredNearbyProbability
      ? await op('nearby_filtered', 'sessions.list', {
          query: {
            cityId: ctx.cityId,
            lat,
            lng,
            section: pick(['family', 'men', 'women']),
            timeFrom: '19:00',
            timeTo: '23:00',
            limit: 20,
          },
        })
      : await op('nearby', 'sessions.list', {
          query: { cityId: ctx.cityId, lat, lng, limit: 20 },
        });
  await think();
  await op('home_next', 'occurrences.list', {
    query: { cityId: ctx.cityId, from: new Date().toISOString(), limit: 10 },
  });

  const found = ((nearby.body as { items?: { id: string }[] } | null)?.items ?? []).map(
    (s) => s.id,
  );
  const candidates = found.length > 0 ? found : ctx.sessionIds;
  const views = Math.round(
    j.viewsPerJourney[0] + rnd() * (j.viewsPerJourney[1] - j.viewsPerJourney[0]),
  );
  let viewed: string | null = null;
  let section = 'family';
  for (let v = 0; v < views && candidates.length > 0; v += 1) {
    viewed = pick(candidates);
    const detail = await op('session_view', 'sessions.get', { params: { sessionId: viewed } });
    section = (detail.body as { section?: string } | null)?.section ?? 'family';
    await op('session_occurrences', 'sessions.occurrences', {
      params: { sessionId: viewed },
      query: { limit: 7 },
    });
    await think();
  }
  if (viewed && rnd() < j.registerProbability) {
    await op('register', 'registrations.create', {
      body: {
        sessionId: viewed,
        areaId: pick(ctx.areaIds),
        // The session's own section: a men's or women's session takes only its section.
        section,
        partySize: 1 + Math.floor(rnd() * 3),
        name: 'Load Person',
        allowWhatsapp: rnd() < 0.5,
      },
    });
    await op('my_registrations', 'registrations.listMine', { query: { upcomingOnly: true } });
  }
  await op('unread_count', 'updates.unreadCount', {});
  await op('ayah', 'ayahOfTheDay.get', {});
}

export interface StepResult {
  vus: number;
  durationS: number;
  iterations: number;
  requests: number;
  rps: number;
  outcomes: Record<string, number>;
  failedRate: number;
  rateLimitedRate: number;
  overall: Summary;
  ops: Record<string, Summary & { outcomes: Record<string, number> }>;
}

/**
 * One concurrency step: `vus` loops for `durationS` seconds (VUs start spread over `rampS`).
 * Returns the latency and error figures of the step; the rate is over the VUs' own window.
 */
export async function runStep(
  ctx: Omit<JourneyContext, 'recorder'>,
  step: { vus: number; durationS: number },
  rampS: number,
): Promise<StepResult> {
  const recorder = new Recorder();
  const jctx: JourneyContext = { ...ctx, recorder };
  const started = performance.now();
  const end = started + step.durationS * 1000;
  let iterations = 0;
  let nextUser = Math.floor(Math.random() * ctx.users.length);
  const sleep = ctx.sleep ?? defaultSleep;
  const vu = async (index: number): Promise<void> => {
    await sleep((rampS * 1000 * index) / step.vus);
    while (performance.now() < end) {
      const user = ctx.users[nextUser % ctx.users.length];
      nextUser += 1;
      if (!user) return;
      await journey(jctx, user);
      iterations += 1;
    }
  };
  await Promise.all(Array.from({ length: step.vus }, (_, i) => vu(i)));
  const elapsedS = (performance.now() - started) / 1000;
  const outcomes = recorder.outcomes();
  const requests = Object.values(outcomes).reduce((s, v) => s + v, 0);
  const failed =
    (outcomes.server_error ?? 0) + (outcomes.network_error ?? 0) + (outcomes.unexpected_4xx ?? 0);
  const ops: StepResult['ops'] = {};
  for (const name of OPS) {
    const values = recorder.latencies.get(name);
    if (values) ops[name] = { ...summarize(values), outcomes: recorder.outcomes(name) };
  }
  return {
    vus: step.vus,
    durationS: Math.round(elapsedS * 10) / 10,
    iterations,
    requests,
    rps: Math.round((requests / elapsedS) * 10) / 10,
    outcomes,
    failedRate: requests ? failed / requests : 0,
    rateLimitedRate: requests ? (outcomes.rate_limited ?? 0) / requests : 0,
    overall: summarize(recorder.all()),
    ops,
  };
}

export interface ThresholdCheck {
  name: string;
  limit: number;
  actual: number | null;
  pass: boolean;
}

/** Compares a step (and its push burst, if any) with the proposed thresholds. */
export function checkThresholds(
  scenario: ScenarioFile,
  step: StepResult,
  push?: { postMs: number; drainPerSecond: number | null; timedOut: boolean } | null,
): ThresholdCheck[] {
  const t = scenario.thresholds;
  const out: ThresholdCheck[] = [
    {
      name: 'failed rate',
      limit: t.failedRate,
      actual: step.failedRate,
      pass: step.failedRate <= t.failedRate,
    },
    {
      name: 'rate-limited rate',
      limit: t.rateLimitedRate,
      actual: step.rateLimitedRate,
      pass: step.rateLimitedRate <= t.rateLimitedRate,
    },
  ];
  for (const [op, limits] of Object.entries(t.ops)) {
    const s = step.ops[op];
    if (!s) continue;
    out.push({ name: `${op} p95`, limit: limits.p95, actual: s.p95, pass: s.p95 <= limits.p95 });
    out.push({ name: `${op} p99`, limit: limits.p99, actual: s.p99, pass: s.p99 <= limits.p99 });
  }
  if (push) {
    out.push({
      name: 'push post ms',
      limit: t.push.postMs,
      actual: push.postMs,
      pass: push.postMs <= t.push.postMs,
    });
    out.push({
      name: 'push drain per second',
      limit: t.push.drainPerSecond,
      actual: push.drainPerSecond,
      pass: !push.timedOut && (push.drainPerSecond ?? 0) >= t.push.drainPerSecond,
    });
  }
  return out;
}
