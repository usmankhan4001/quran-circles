import { ENDPOINT_IDS, type ImportResult } from '@qc/contracts';
import { errorCode, expectOk } from '../http';
import { Synthetic, as, signIn, type Api, type Person } from '../people';
import { expectationFor, judge } from './expect';
import { SCENARIOS, runOrder, scenarioName } from './scenarios';
import {
  CALLER_KINDS,
  type Caller,
  type CallerKind,
  type Expectation,
  type Fixture,
  type Prepared,
  type Scenario,
  type World,
} from './types';
import { buildCallers, buildFixture, buildWorld } from './world';

export interface ScopeRunOptions {
  baseUrl: string;
  fixedCode: string;
  /** A number with a pending national-admin invite (`@qc/db bootstrap-admin`), or an admin's own. */
  adminPhone: string;
  log?: (line: string) => void;
}

export interface CallRecord {
  scenario: string;
  endpoint: string;
  caller: CallerKind;
  expected: Expectation;
  status: number;
  code: string | null;
  ok: boolean;
  reason?: string;
}

export interface ScopeReport {
  baseUrl: string;
  startedAt: string;
  finishedAt: string;
  runTag: string;
  endpoints: { total: number; covered: number; missing: string[] };
  totals: { scenarios: number; calls: number; ok: number; mismatches: number };
  mismatches: CallRecord[];
  /** Records of another person that changed although every caller was refused. */
  tampered: string[];
  records: CallRecord[];
}

interface Ctx {
  api: Api;
  admin: Person;
  world: World;
  fixture: Fixture;
  owner: Person;
  /** Signed-in stand-in whose records give an anonymous caller a well-formed request. */
  standIn: Person;
  counter: number;
}

interface Items<T> {
  items: T[];
}

async function prepare(ctx: Ctx, scenario: Scenario, caller: Caller): Promise<Prepared> {
  const { api, world, fixture } = ctx;
  const who = caller.person ?? ctx.standIn;
  ctx.counter += 1;
  switch (scenario.prepare) {
    case undefined:
      return {};
    case 'fresh_phone':
      return { phone: api.synthetic.phone() };
    case 'challenge': {
      const res = await as(api, null, 'auth.requestCode', {
        body: { phone: api.synthetic.phone(), locale: 'en', channel: 'whatsapp' },
        ip: api.synthetic.ip(),
      });
      return {
        challengeId: expectOk<{ challengeId: string }>(res, 'prepare challenge').challengeId,
      };
    }
    case 'fresh_refresh_token':
      return { refreshToken: (await signIn(api, 'refresh donor')).refreshToken };
    case 'own_follow_update':
    case 'own_follow_delete': {
      const venueId = scenario.prepare === 'own_follow_update' ? world.venueA2 : world.venueB1;
      const res = await as(api, who, 'follows.create', { body: { target: 'venue', venueId } });
      if (res.status === 201) return { followId: (res.body as { id: string }).id };
      const list = expectOk<Items<{ id: string; venueId: string | null }>>(
        await as(api, who, 'follows.list'),
        'prepare follow (list)',
      );
      const found = list.items.find((f) => f.venueId === venueId);
      if (!found) throw new Error(`prepare follow failed: HTTP ${res.status}`);
      return { followId: found.id };
    }
    case 'own_device': {
      const res = await as(api, who, 'devices.register', {
        body: {
          platform: 'android',
          provider: 'fcm',
          token: `qc-scope-fake-${fixture.runTag}-${ctx.counter}`,
          locale: 'en',
        },
      });
      return { deviceId: expectOk<{ id: string }>(res, 'prepare device').id };
    }
    case 'own_bookmark': {
      const res = await as(api, who, 'bookmarks.create', {
        body: { kind: 'ayah', surah: 2, ayah: 1 + (ctx.counter % 280) },
      });
      return { bookmarkId: expectOk<{ id: string }>(res, 'prepare bookmark').id };
    }
    case 'own_circle_request': {
      const res = await as(api, who, 'circleRequests.create', {
        body: { areaId: world.cityA.areaId, days: [5] },
      });
      if (res.status === 201) return { circleRequestId: (res.body as { id: string }).id };
      const list = expectOk<Items<{ id: string; status: string }>>(
        await as(api, who, 'circleRequests.list'),
        'prepare circle request (list)',
      );
      const open = list.items.find((r) => r.status === 'active');
      if (!open) throw new Error(`prepare circle request failed: HTTP ${res.status}`);
      return { circleRequestId: open.id };
    }
    case 'own_registration': {
      const res = await as(api, who, 'registrations.create', {
        body: {
          sessionId: fixture.session2Id,
          areaId: world.cityA.areaId,
          section: 'family',
          partySize: 1,
          name: 'Scope Person',
          allowWhatsapp: false,
        },
      });
      if (res.status === 201) return { registrationId: (res.body as { id: string }).id };
      const mine = expectOk<Items<{ id: string; sessionId: string; status: string }>>(
        await as(api, who, 'registrations.listMine'),
        'prepare registration (list)',
      );
      const found = mine.items.find(
        (r) => r.sessionId === fixture.session2Id && r.status !== 'cancelled',
      );
      if (!found) throw new Error(`prepare registration failed: HTTP ${res.status}`);
      return { registrationId: found.id };
    }
    case 'own_memorisation':
      expectOk(
        await as(api, who, 'memorisation.put', {
          params: { surah: 113 },
          body: { status: 'learning' },
        }),
        'prepare memorisation',
      );
      return {};
  }
}

/** After every caller tried another person's record: is it still there, unchanged? */
async function ownerRecordIntact(ctx: Ctx, scenario: Scenario): Promise<boolean> {
  const { api, owner, fixture } = ctx;
  switch (scenario.id) {
    case 'follows.update':
    case 'follows.delete': {
      const list = expectOk<Items<{ id: string; alertsEnabled: boolean }>>(
        await as(api, owner, 'follows.list'),
        'owner follows',
      );
      const f = list.items.find((x) => x.id === fixture.owner.followId);
      return !!f && f.alertsEnabled;
    }
    case 'bookmarks.delete': {
      const list = expectOk<Items<{ id: string }>>(
        await as(api, owner, 'bookmarks.list'),
        'owner bookmarks',
      );
      return list.items.some((x) => x.id === fixture.owner.bookmarkId);
    }
    case 'circleRequests.cancel': {
      const list = expectOk<Items<{ id: string; status: string }>>(
        await as(api, owner, 'circleRequests.list'),
        'owner circle requests',
      );
      return list.items.some(
        (x) => x.id === fixture.owner.circleRequestId && x.status === 'active',
      );
    }
    case 'registrations.cancel': {
      const list = expectOk<Items<{ id: string; status: string }>>(
        await as(api, owner, 'registrations.listMine'),
        'owner registrations',
      );
      return list.items.some(
        (x) => x.id === fixture.owner.registrationId && x.status !== 'cancelled',
      );
    }
    default:
      // devices.remove: there is no endpoint that lists devices; refusal status is the check.
      return true;
  }
}

export async function runScope(options: ScopeRunOptions): Promise<ScopeReport> {
  const log = options.log ?? (() => undefined);
  const startedAt = new Date().toISOString();
  const runTag = Date.now().toString(36);
  const api: Api = {
    baseUrl: options.baseUrl,
    fixedCode: options.fixedCode,
    synthetic: new Synthetic('+92313'),
    options: { retry429: 8 },
  };

  log('signing in the national admin');
  const admin = await signIn(api, 'national admin', options.adminPhone);
  if (!admin.me.roles.some((r) => r.role === 'national_admin')) {
    throw new Error('the admin phone did not sign in as a national admin');
  }
  log('building the world (cities, venues) and the cast');
  const world = await buildWorld(api, admin, runTag);
  const callers = await buildCallers(api, admin, world, 'main');
  log('building the fixture records');
  const { fixture, owner } = await buildFixture(api, admin, world, callers, runTag);
  const standIn = await signIn(api, 'anonymous stand-in');
  const ctx: Ctx = { api, admin, world, fixture, owner, standIn, counter: 0 };

  const records: CallRecord[] = [];
  const tampered: string[] = [];
  const ordered = runOrder(SCENARIOS);
  for (const scenario of ordered) {
    const name = scenarioName(scenario);
    const cast = scenario.disposable
      ? await buildCallers(api, admin, world, `disposable ${scenario.id}`)
      : callers;
    const planned = cast.map((caller) => ({
      caller,
      expected: expectationFor(scenario, caller.principal, world, fixture.owner.userId),
    }));
    // Refused callers first, so an allowed caller's change cannot affect what a refused one sees.
    const sequence = [
      ...planned.filter((p) => p.expected !== 'allow'),
      ...planned.filter((p) => p.expected === 'allow'),
    ];
    for (const { caller, expected } of sequence) {
      const prepared = await prepare(ctx, scenario, caller);
      const res = await as(api, caller.person, scenario.id, scenario.request(fixture, prepared));
      let verdict = judge(expected, res.status, res.body);
      if (verdict.ok && expected === 'allow' && scenario.staff?.denied === 'row_forbidden') {
        const row = (res.body as Partial<ImportResult> | null)?.rows?.[0];
        if (row?.status !== 'created') {
          verdict = {
            ok: false,
            reason: `allowed import row not created (${row?.status ?? res.status})`,
          };
        }
      }
      records.push({
        scenario: name,
        endpoint: scenario.id,
        caller: caller.kind,
        expected,
        status: res.status,
        code: errorCode(res.body),
        ok: verdict.ok,
        ...(verdict.reason ? { reason: verdict.reason } : {}),
      });
      // After signing out or deleting the account, the same access token must stop working.
      if (scenario.disposable && caller.person && res.status >= 200 && res.status < 300) {
        const after = await as(api, caller.person, 'me.get');
        const check = judge('unauthenticated', after.status, after.body);
        records.push({
          scenario: `${name} then me.get with the same token`,
          endpoint: 'me.get',
          caller: caller.kind,
          expected: 'unauthenticated',
          status: after.status,
          code: errorCode(after.body),
          ok: check.ok,
          ...(check.reason ? { reason: check.reason } : {}),
        });
      }
    }
    if (scenario.owner === 'other' && !(await ownerRecordIntact(ctx, scenario))) {
      tampered.push(name);
    }
    const bad = records.filter((r) => r.scenario.startsWith(name) && !r.ok).length;
    log(`${bad === 0 ? 'ok      ' : 'MISMATCH'} ${name}`);
  }

  const covered = new Set(ordered.map((s) => s.id));
  const missing = ENDPOINT_IDS.filter((id) => !covered.has(id));
  const mismatches = records.filter((r) => !r.ok);
  return {
    baseUrl: options.baseUrl,
    startedAt,
    finishedAt: new Date().toISOString(),
    runTag,
    endpoints: { total: ENDPOINT_IDS.length, covered: covered.size, missing },
    totals: {
      scenarios: ordered.length,
      calls: records.length,
      ok: records.length - mismatches.length,
      mismatches: mismatches.length,
    },
    mismatches,
    tampered,
    records,
  };
}

const SHORT: Record<CallerKind, string> = {
  anonymous: 'anon',
  attendee: 'att',
  vc_venue: 'vcV',
  vc_same_city: 'vcA2',
  vc_other_city: 'vcB',
  cc_city: 'ccA',
  cc_other_city: 'ccB',
  national_admin: 'nat',
  vc_revoked: 'vcRev',
};

/** A plain-text matrix: one row per scenario, the status per caller, `!` marking a mismatch. */
export function formatMatrix(report: ScopeReport): string {
  const scenarios = [...new Set(report.records.map((r) => r.scenario))];
  const width = Math.max(...scenarios.map((s) => s.length), 8);
  const head = ['scenario'.padEnd(width), ...CALLER_KINDS.map((k) => SHORT[k].padStart(6))].join(
    ' ',
  );
  const lines = [head, '-'.repeat(head.length)];
  for (const s of scenarios) {
    const cells = CALLER_KINDS.map((k) => {
      const r = report.records.find((x) => x.scenario === s && x.caller === k);
      return (r ? `${r.status}${r.ok ? '' : '!'}` : '-').padStart(6);
    });
    lines.push([s.padEnd(width), ...cells].join(' '));
  }
  return lines.join('\n');
}
