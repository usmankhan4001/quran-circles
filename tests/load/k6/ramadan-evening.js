/* global __ENV, open */
/**
 * The Ramadan-evening load test for k6 (staging). The same model as the Node runner
 * (`pnpm --filter @qc/load load`), read from the same `scenario.json`: many people open Nearby,
 * open sessions and register while a national push burst goes out.
 *
 *   QC_ALLOW_REMOTE=staging QC_BASE_URL=https://api.staging.example \
 *   QC_WORKER_URL=https://worker.staging.example QC_FIXED_CODE=<test-mode code> \
 *   QC_ADMIN_PHONE=<number with a national-admin invite> k6 run k6/ramadan-evening.js
 *
 * Needs the API in test mode (`AUTH_FIXED_CODE`) with `TRUST_PROXY=true` passing the client's
 * X-Forwarded-For through, the worker on fake push providers, and synthetic data only. It refuses
 * any host but localhost unless QC_ALLOW_REMOTE=staging. Never point it at production.
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import exec from 'k6/execution';
import { Rate, Trend } from 'k6/metrics';

const SCENARIO = JSON.parse(open('../scenario.json'));

const BASE = (__ENV.QC_BASE_URL || '').replace(/\/+$/, '');
const WORKER = (__ENV.QC_WORKER_URL || '').replace(/\/+$/, '');
const FIXED_CODE = __ENV.QC_FIXED_CODE || '';
const ADMIN_PHONE = __ENV.QC_ADMIN_PHONE || '';
const USERS = Number(__ENV.QC_USERS || SCENARIO.seed.users);
// The API sends at most 1,000 sign-in codes an hour for all numbers together and the ceiling is
// not configurable, so a run plans at most 900 (see src/limits.ts).
const SIGN_IN_BUDGET = 900;

function checkTarget(url) {
  const host = url.replace(/^https?:\/\//, '').split(/[/:]/)[0];
  const local = host === 'localhost' || host === '127.0.0.1';
  if (!local && __ENV.QC_ALLOW_REMOTE !== 'staging') {
    throw new Error(
      `refusing ${host}: localhost only unless QC_ALLOW_REMOTE=staging; never production`,
    );
  }
}
if (!BASE || !FIXED_CODE || !ADMIN_PHONE) {
  throw new Error('set QC_BASE_URL, QC_FIXED_CODE and QC_ADMIN_PHONE');
}
checkTarget(BASE);
if (WORKER) checkTarget(WORKER);

const failed = new Rate('qc_failed');
const rateLimited = new Rate('qc_rate_limited');
const pushPostMs = new Trend('qc_push_post_ms', true);
const pushDrainRate = new Trend('qc_push_drain_per_s');

const EXPECTED_CODES = [
  'already_registered',
  'session_full',
  'registration_closed',
  'occurrence_in_past',
];

// Stages: ramp to each step's VUs, then hold it. One push burst per step, `atS` into the step.
const stages = [];
const pushScenarios = {};
let elapsed = 0;
SCENARIO.steps.forEach((step, i) => {
  stages.push({ duration: `${SCENARIO.rampS}s`, target: step.vus });
  stages.push({ duration: `${step.durationS}s`, target: step.vus });
  pushScenarios[`push_burst_${i + 1}`] = {
    executor: 'per-vu-iterations',
    vus: 1,
    iterations: 1,
    startTime: `${elapsed + SCENARIO.rampS + SCENARIO.pushBurst.atS}s`,
    maxDuration: '15m',
    exec: 'pushBurst',
  };
  elapsed += SCENARIO.rampS + step.durationS;
});

const thresholds = {
  qc_failed: [`rate<=${SCENARIO.thresholds.failedRate}`],
  qc_rate_limited: [`rate<=${SCENARIO.thresholds.rateLimitedRate}`],
  qc_push_post_ms: [`max<=${SCENARIO.thresholds.push.postMs}`],
};
if (WORKER) thresholds.qc_push_drain_per_s = [`min>=${SCENARIO.thresholds.push.drainPerSecond}`];
for (const [op, limits] of Object.entries(SCENARIO.thresholds.ops)) {
  thresholds[`http_req_duration{op:${op}}`] = [`p(95)<=${limits.p95}`, `p(99)<=${limits.p99}`];
}

export const options = {
  setupTimeout: '20m',
  scenarios: {
    evening: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages,
      gracefulRampDown: '10s',
      exec: 'evening',
    },
    ...pushScenarios,
  },
  thresholds,
  summaryTrendStats: ['min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max', 'count'],
};

// Business answers (a second registration, a full session) are not HTTP failures.
http.setResponseCallback(http.expectedStatuses({ min: 200, max: 299 }, 409));

function ipFor(n) {
  return `10.${(n >> 16) & 255}.${(n >> 8) & 255}.${(n & 254) + 1}`;
}

function headers(token, ip) {
  const h = {
    'content-type': 'application/json',
    accept: 'application/json',
    'x-forwarded-for': ip,
  };
  if (token) h.authorization = `Bearer ${token}`;
  return h;
}

function qs(query) {
  const parts = [];
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null) continue;
    for (const item of Array.isArray(v) ? v : [v]) {
      parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(item))}`);
    }
  }
  return parts.length ? `?${parts.join('&')}` : '';
}

function record(res) {
  let code = null;
  if (res.status >= 400) {
    try {
      code = res.json('error.code');
    } catch {
      code = null;
    }
  }
  const unexpected4xx =
    res.status >= 400 && res.status < 500 && res.status !== 429 && !EXPECTED_CODES.includes(code);
  failed.add(res.status === 0 || res.status >= 500 || unexpected4xx);
  rateLimited.add(res.status === 429);
  return res;
}

// Access tokens last 15 minutes: on a 401 the app refreshes once and retries, and so do we.
function refresh(user) {
  if (!user.refreshToken) return false;
  const res = record(
    http.post(`${BASE}/v1/auth/refresh`, JSON.stringify({ refreshToken: user.refreshToken }), {
      headers: headers(null, user.ip),
      tags: { op: 'token_refresh' },
    }),
  );
  if (res.status !== 200) return false;
  user.token = res.json('accessToken');
  user.refreshToken = res.json('refreshToken');
  return true;
}

function send(op, method, url, body, user, extra) {
  const go = () =>
    http.request(method, url, body, {
      headers: headers(user.token, user.ip),
      tags: { op },
      ...(extra || {}),
    });
  let res = go();
  if (res.status === 401 && refresh(user)) res = go();
  return record(res);
}

function get(op, path, query, user) {
  return send(op, 'GET', `${BASE}${path}${qs(query || {})}`, null, user);
}

function post(op, path, body, user, extra) {
  return send(op, 'POST', `${BASE}${path}`, JSON.stringify(body), user, extra);
}

function must(res, what) {
  if (res.status < 200 || res.status >= 300) throw new Error(`${what} failed: HTTP ${res.status}`);
  return res.json();
}

function signIn(phone, ip) {
  const challenge = must(
    http.post(
      `${BASE}/v1/auth/code`,
      JSON.stringify({ phone, locale: 'en', channel: 'whatsapp' }),
      {
        headers: headers(null, ip),
      },
    ),
    'request code',
  );
  const signedIn = must(
    http.post(
      `${BASE}/v1/auth/verify`,
      JSON.stringify({
        challengeId: challenge.challengeId,
        code: FIXED_CODE,
        deviceLabel: 'qc-k6',
      }),
      { headers: headers(null, ip) },
    ),
    'verify code',
  );
  return { token: signedIn.accessToken, refreshToken: signedIn.refreshToken, ip };
}

function pkDate(offsetDays) {
  // Pakistan is UTC+5 all year.
  return new Date(Date.now() + 5 * 3600_000 + offsetDays * 86_400_000).toISOString().slice(0, 10);
}

function pagedIds(path, query, admin, keep) {
  const ids = [];
  let cursor = null;
  do {
    const page = must(
      http.get(`${BASE}${path}${qs({ ...query, limit: 100, cursor })}`, {
        headers: headers(admin.token, admin.ip),
      }),
      `list ${path}`,
    );
    for (const row of page.items) if (keep(row)) ids.push(row.id);
    cursor = page.nextCursor;
  } while (cursor);
  return ids;
}

export function setup() {
  const seed = SCENARIO.seed;
  const planned = USERS + 1 + SCENARIO.steps.length;
  if (planned > SIGN_IN_BUDGET) {
    throw new Error(`${planned} sign-ins would pass the API's hourly code ceiling; lower QC_USERS`);
  }
  const runTag = Date.now().toString(36);
  const ipBase = Math.floor(Math.random() * 4_000_000);
  const admin = signIn(ADMIN_PHONE, ipFor(ipBase));
  const cities = must(http.get(`${BASE}/v1/places/cities`), 'cities').items;
  const city = cities.find((c) => c.slug === seed.citySlug) || cities[0];
  const areaIds = must(
    http.get(`${BASE}/v1/places/areas${qs({ cityId: city.id })}`),
    'areas',
  ).items.map((a) => a.id);
  const jitter = () => (Math.random() * 2 - 1) * seed.spreadDeg;
  const venueRows = [];
  for (let i = 0; i < seed.venues; i += 1) {
    venueRows.push({
      cityId: city.id,
      areaId: areaIds[i % areaIds.length],
      name: { en: `Load ${runTag} Masjid ${i + 1}` },
      address: { en: `${i + 1} Synthetic Street` },
      lat: Number((seed.center.lat + jitter()).toFixed(6)),
      lng: Number((seed.center.lng + jitter()).toFixed(6)),
      facilities: { womenSection: i % 2 === 0 },
    });
  }
  must(
    post('seed', '/v1/admin/import/venues', { dryRun: false, rows: venueRows }, admin, {
      timeout: '120s',
    }),
    'import venues',
  );
  const prefix = `Load ${runTag} `;
  const venueIds = pagedIds('/v1/admin/venues', { cityId: city.id }, admin, (v) =>
    v.name.en.startsWith(prefix),
  );
  const sections = ['family', 'men', 'women'];
  const times = ['19:30', '20:00', '20:30', '21:00', '21:30', '22:00'];
  const sessionRows = [];
  venueIds.forEach((venueId, v) => {
    for (let k = 0; k < seed.sessionsPerVenue; k += 1) {
      sessionRows.push({
        kind: 'recurring',
        venueId,
        program: k === 0 ? 'dora' : 'circles',
        title: { en: `Load ${runTag} Session ${v + 1}.${k + 1}` },
        section: sections[(v + k) % 3],
        language: (v + k) % 4 === 0 ? 'en' : 'ur',
        localStartTime: times[(v * 3 + k) % times.length],
        durationMinutes: 90,
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        startsOn: pkDate(0),
        endsOn: pkDate(30),
        capacity: (v + k) % 10 === 0 ? 30 : null,
      });
    }
  });
  for (let i = 0; i < sessionRows.length; i += 2000) {
    must(
      post(
        'seed',
        '/v1/admin/import/sessions',
        { dryRun: false, rows: sessionRows.slice(i, i + 2000) },
        admin,
        { timeout: '300s' },
      ),
      'import sessions',
    );
  }
  const venueSet = new Set(venueIds);
  const sessionIds = pagedIds('/v1/admin/sessions', { cityId: city.id }, admin, (s) =>
    venueSet.has(s.venueId),
  );

  // Synthetic attendees, signed in 20 at a time, each with a fake push device.
  const users = [];
  const phoneSeed = Math.floor(Math.random() * 9_000_000);
  for (let start = 0; start < USERS; start += 20) {
    const batch = [];
    for (let i = start; i < Math.min(USERS, start + 20); i += 1) {
      const phone = `+92317${String((phoneSeed + i * 7919) % 10_000_000).padStart(7, '0')}`;
      batch.push({ phone, ip: ipFor(ipBase + 1 + i) });
    }
    const codes = http.batch(
      batch.map((b) => [
        'POST',
        `${BASE}/v1/auth/code`,
        JSON.stringify({ phone: b.phone, locale: 'en', channel: 'whatsapp' }),
        { headers: headers(null, b.ip) },
      ]),
    );
    const verified = http.batch(
      codes.map((res, i) => [
        'POST',
        `${BASE}/v1/auth/verify`,
        JSON.stringify({
          challengeId: must(res, 'request code').challengeId,
          code: FIXED_CODE,
          deviceLabel: 'qc-k6',
        }),
        { headers: headers(null, batch[i].ip) },
      ]),
    );
    const people = verified.map((res, i) => {
      const signedIn = must(res, 'verify code');
      return { token: signedIn.accessToken, refreshToken: signedIn.refreshToken, ip: batch[i].ip };
    });
    http.batch(
      people.map((p, i) => [
        'PUT',
        `${BASE}/v1/me/devices`,
        JSON.stringify({
          platform: 'android',
          provider: 'fcm',
          token: `qc-k6-fake-${runTag}-${start + i}`,
          locale: 'ur',
        }),
        { headers: headers(p.token, p.ip) },
      ]),
    );
    users.push(...people);
  }
  // One national admin per push burst, each with its own session: every burst runs in its own VU
  // with its own copy of the data, and a refresh token must not be shared between copies.
  const pushAdmins = SCENARIO.steps.map((_, i) => {
    const phone = `+92318${String((phoneSeed + i * 7919) % 10_000_000).padStart(7, '0')}`;
    must(
      post('seed', '/v1/admin/invites', { role: 'national_admin', phone }, admin),
      'invite push admin',
    );
    return signIn(phone, ipFor(ipBase + USERS + 1 + i));
  });
  return { runTag, cityId: city.id, areaIds, sessionIds, users, pushAdmins };
}

// Each VU has its own copy of the setup data, so each VU gets its own slice of the people: a
// refresh in one VU rotates that person's refresh token, which another VU would then lack.
const MAX_VUS = Math.max(...SCENARIO.steps.map((s) => s.vus));
let iteration = 0;

function think() {
  const [lo, hi] = SCENARIO.journey.thinkMs;
  sleep((lo + Math.random() * (hi - lo)) / 1000);
}

function pick(items) {
  return items[Math.floor(Math.random() * items.length)];
}

export function evening(data) {
  const j = SCENARIO.journey;
  const slice = Math.max(1, Math.floor(data.users.length / MAX_VUS));
  const vu = (exec.vu.idInTest - 1) % MAX_VUS;
  const user = data.users[(vu * slice + (iteration % slice)) % data.users.length];
  iteration += 1;
  const spread = SCENARIO.seed.spreadDeg / 2;
  const lat = Number((SCENARIO.seed.center.lat + (Math.random() * 2 - 1) * spread).toFixed(5));
  const lng = Number((SCENARIO.seed.center.lng + (Math.random() * 2 - 1) * spread).toFixed(5));

  get('config', '/v1/config', { cityId: data.cityId }, user);
  const nearby =
    Math.random() < j.filteredNearbyProbability
      ? get(
          'nearby_filtered',
          '/v1/sessions',
          {
            cityId: data.cityId,
            lat,
            lng,
            section: pick(['family', 'men', 'women']),
            timeFrom: '19:00',
            timeTo: '23:00',
            limit: 20,
          },
          user,
        )
      : get('nearby', '/v1/sessions', { cityId: data.cityId, lat, lng, limit: 20 }, user);
  check(nearby, { 'nearby answered': (r) => r.status === 200 });
  think();
  get(
    'home_next',
    '/v1/occurrences',
    { cityId: data.cityId, from: new Date().toISOString(), limit: 10 },
    user,
  );

  let found;
  try {
    found = nearby.json('items').map((s) => s.id);
  } catch {
    found = [];
  }
  const candidates = found.length > 0 ? found : data.sessionIds;
  const views = Math.round(
    j.viewsPerJourney[0] + Math.random() * (j.viewsPerJourney[1] - j.viewsPerJourney[0]),
  );
  let viewed = null;
  let section = 'family';
  for (let v = 0; v < views && candidates.length > 0; v += 1) {
    viewed = pick(candidates);
    const detail = get('session_view', `/v1/sessions/${viewed}`, {}, user);
    try {
      section = detail.json('section') || 'family';
    } catch {
      section = 'family';
    }
    get('session_occurrences', `/v1/sessions/${viewed}/occurrences`, { limit: 7 }, user);
    think();
  }
  if (viewed && Math.random() < j.registerProbability) {
    post(
      'register',
      '/v1/registrations',
      {
        sessionId: viewed,
        areaId: pick(data.areaIds),
        section,
        partySize: 1 + Math.floor(Math.random() * 3),
        name: 'Load Person',
        allowWhatsapp: Math.random() < 0.5,
      },
      user,
    );
    get('my_registrations', '/v1/registrations/mine', { upcomingOnly: true }, user);
  }
  get('unread_count', '/v1/updates/unread-count', {}, user);
  get('ayah', '/v1/ayah-of-the-day', {}, user);
}

function outbox() {
  const res = http.get(`${WORKER}/healthz`, { tags: { op: 'healthz' } });
  const d = res.json('details') || {};
  return { sent: d.sent || 0, pending: (d.queued || 0) + (d.sending || 0) };
}

export function pushBurst(data) {
  const burst = Number(exec.scenario.name.replace('push_burst_', '')) - 1;
  const admin = data.pushAdmins[burst];
  const before = WORKER ? outbox() : null;
  const res = post(
    'push_post',
    '/v1/admin/updates',
    {
      scope: { type: 'national' },
      kind: 'announcement',
      title: { en: `Taraweeh tonight ${data.runTag}` },
      body: { en: 'Synthetic load-test announcement.' },
      notify: true,
    },
    admin,
    { timeout: '120s' },
  );
  pushPostMs.add(res.timings.duration);
  if (!WORKER || res.status !== 201) return;
  const started = Date.now();
  // The worker's counts are global (other bursts, reminders queued for later), so the burst is
  // measured by progress: drained when the sent count has grown and then stood still for 5 s.
  let lastSent = before.sent;
  let lastProgress = started;
  while (Date.now() - started < 14 * 60_000) {
    sleep(1);
    const now = outbox();
    if (now.sent > lastSent) {
      lastSent = now.sent;
      lastProgress = Date.now();
    } else if (lastSent > before.sent && Date.now() - lastProgress >= 5000) {
      break;
    }
  }
  const seconds = (lastProgress - started) / 1000;
  const sent = lastSent - before.sent;
  pushDrainRate.add(seconds > 0 ? sent / seconds : 0);
}
