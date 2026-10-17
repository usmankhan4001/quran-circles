import { ERROR_CODES, issuesFromZod, makeApiError, type ErrorCode } from './errors';
import { endpoints } from './endpoints';
import type { EndpointDef } from './define';
import { fakeFromSchema, seeded } from './fake';
import * as fx from './fixtures';
import { z } from 'zod';
import type { Session } from './schemas/sessions';
import {
  REGISTRATION_EXPORT_COLUMNS,
  checkImportRows,
  type ImportKind,
  type ImportRowResult,
  type SessionCreate,
  type VenueCreate,
  type InviteBody,
  type Invite,
} from './schemas/admin';
import { csvCell, csvFile } from './csv';
import { ValidationIssue } from './errors';
import { CONTRACT_VERSION } from './openapi';
import {
  can,
  roleAssignAction,
  scopeFilter,
  updatePostAction,
  ACTIONS,
  type Principal,
  type ResourceScope,
  type ScopeAction,
  type ScopeFilter,
} from './scopes';
import type { Me } from './schemas/people';
import type {
  DailyAyahEntry,
  DailyAyahPut,
  MemorisationPut,
  ReadingDay,
  ReadingDayRecord,
} from './schemas/reading';
import { READING_DAY_SOURCES } from './enums';
import {
  pakistanDate as pakistanDateOf,
  readingDayDateIssue,
  readingRangeIssue,
  resolveDailyAyah,
} from './reading';
import { MEMORISATION_REVISE_AFTER_DAYS_DEFAULT } from './schemas/reading';
import type { Role } from './enums';
import type { Poster, PosterCreate } from './schemas/posters';
import { posterLocaleOf, posterOutOfDate } from './posters';

/**
 * A mock server generated from the API contract. It validates every request against the schemas,
 * serves realistic synthetic data for every endpoint and can produce every error case.
 *
 * Try it:
 * - `Authorization: Bearer mock-user` is an attendee; `mock-staff` is a national admin;
 *   `mock-city` is the city coordinator of Rawalpindi; `mock-venue` is the venue coordinator of
 *   Sample Masjid Al-Noor (Rawalpindi). `mock-expired` gets token_expired; no token on a
 *   signed-in endpoint gets unauthenticated.
 * - `x-mock-error: <error code>` makes any endpoint fail with that code.
 * - Code `123456` signs in; any other code gets otp_invalid. A request for a code to one of the
 *   staff test numbers in `staffAccounts` (+923000000201 venue, +923000000202 city,
 *   +923000000203 national) signs in as that staff account; any other number is the attendee.
 * - Staff tokens are checked against the scope matrix: a role that may not use an endpoint gets
 *   forbidden, a known record outside the caller's scope gets forbidden (or not_found on the
 *   scoped reads), and admin lists hold only what the role may see.
 */
export type MockHandler = (request: Request) => Promise<Response>;

const compile = (path: string): RegExp =>
  new RegExp(`^${path.replace(/\{(\w+)\}/g, '(?<$1>[^/]+)')}/?$`);

const routes = (Object.values(endpoints) as EndpointDef[]).map((def) => ({
  def,
  re: compile(def.path),
}));

const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const errorResponse = (
  code: ErrorCode,
  requestId: string,
  extra?: Parameters<typeof makeApiError>[2],
): Response => json(ERROR_CODES[code], makeApiError(code, requestId, extra));

const issuesOf = issuesFromZod;

/** Query strings are flat; arrays are repeated keys. Decide by the schema's property types. */
const queryObject = (def: EndpointDef, params: URLSearchParams): Record<string, unknown> => {
  const props =
    (def.query
      ? (
          z.toJSONSchema(def.query, { io: 'input', unrepresentable: 'any' }) as {
            properties?: Record<string, { type?: string }>;
          }
        ).properties
      : undefined) ?? {};
  const out: Record<string, unknown> = {};
  for (const key of new Set(params.keys())) {
    const all = params.getAll(key);
    out[key] = props[key]?.type === 'array' ? all : all[0];
  }
  return out;
};

const page = <T>(items: T[], query: { cursor?: string; limit?: number }) => {
  const start = query.cursor ? Number.parseInt(query.cursor, 10) || 0 : 0;
  const limit = query.limit ?? 20;
  const slice = items.slice(start, start + limit);
  return { items: slice, nextCursor: start + limit < items.length ? String(start + limit) : null };
};

type Ctx = {
  params: Record<string, string>;
  query: Record<string, unknown>;
  body: unknown;
  /** The signed-in person behind the token, when there is one. */
  me?: Me;
  /** Their role assignments, for `can` and `scopeFilter`. */
  principal?: Principal;
};
export type MockContext = Ctx;

const staffList = Object.values(fx.staffAccounts);
const staffByToken = (token: string) => staffList.find((a) => a.token === token);

const principalOf = (me: Me): Principal => ({
  userId: me.id,
  assignments: me.roles.map((r) => ({ role: r.role, cityId: r.cityId, venueId: r.venueId })),
});

const inScope = (f: ScopeFilter, r: { cityId: string; venueId: string }): boolean =>
  f.national || f.cityIds.includes(r.cityId) || f.venueIds.includes(r.venueId);

/** The scope filter of a list action for the caller. No principal sees nothing. */
const filterFor = (c: Ctx, action: ScopeAction): ScopeFilter =>
  scopeFilter(c.principal ?? null, action);

const venueScope = (venueId: unknown): ResourceScope | null => {
  const v = fx.venues.find((x) => x.id === venueId);
  return v ? { cityId: v.cityId, venueId: v.id } : null;
};
const sessionScope = (sessionId: unknown) => {
  const s = fx.sessions.find((x) => x.id === sessionId);
  return s ? { cityId: s.cityId, venueId: s.venueId } : null;
};

/**
 * What a staff request acts on, from its path or body, with the actions to check it against.
 * `null` when it names a record the fixtures do not have: the handler answers that (usually
 * not_found). `undefined` when there is nothing to check beyond the role.
 */
const staffResource = (
  def: EndpointDef,
  c: Ctx,
): { resource: ResourceScope; actions: ScopeAction[] } | null | undefined => {
  const actions = [...def.actions] as ScopeAction[];
  const p = c.params;
  const body = (c.body ?? {}) as Record<string, unknown>;
  const withActions = (resource: ResourceScope | null, only = actions) =>
    resource ? { resource, actions: only } : null;
  if (p.sessionId) return withActions(sessionScope(p.sessionId));
  if (p.occurrenceId) {
    const o = fx.occurrences.find((x) => x.id === p.occurrenceId);
    return withActions(o ? sessionScope(o.sessionId) : null);
  }
  if (p.venueId) return withActions(venueScope(p.venueId));
  if (p.circleId) {
    const x = fx.circles.find((y) => y.id === p.circleId);
    return withActions(x ? { cityId: x.cityId, venueId: x.venueId } : null);
  }
  if (p.posterId) {
    const x = fx.posters.find((y) => y.id === p.posterId);
    return withActions(x ? sessionScope(x.sessionId) : null);
  }
  if (p.dailyAyahId) {
    const pick = fx.dailyAyahs.find((x) => x.id === p.dailyAyahId);
    if (!pick) return null;
    return {
      resource: pick.scopeType === 'national' ? {} : { cityId: pick.cityId, venueId: pick.venueId },
      actions,
    };
  }
  switch (def.id) {
    case 'adminDailyAyahs.put': {
      const scope = (body as DailyAyahPut).scope;
      if (scope.type === 'national') return { resource: {}, actions };
      if (scope.type === 'venue') return withActions(venueScope(scope.venueId));
      const x = fx.circles.find((y) => y.id === scope.circleId);
      return withActions(x ? { cityId: x.cityId, venueId: x.venueId } : null);
    }
    case 'adminVenues.create':
      return fx.cities.some((x) => x.id === body.cityId)
        ? { resource: { cityId: body.cityId as string }, actions: ['venue.create'] }
        : null;
    case 'adminCircles.create':
    case 'adminSessions.create':
      return withActions(venueScope(body.venueId));
    case 'adminUpdates.post':
    case 'adminUpdates.preview': {
      const scope = body.scope as {
        type: 'national' | 'city' | 'venue';
        cityId?: string;
        venueId?: string;
      };
      const only = [updatePostAction(scope.type)];
      if (scope.type === 'national') return { resource: {}, actions: only };
      if (scope.type === 'venue') return withActions(venueScope(scope.venueId), only);
      return fx.cities.some((x) => x.id === scope.cityId)
        ? { resource: { cityId: scope.cityId }, actions: only }
        : null;
    }
    case 'adminRoles.invite':
    case 'adminRoles.assign': {
      const role = body.role as Role;
      const only = [roleAssignAction(role)];
      if (role === 'national_admin') return { resource: {}, actions: only };
      if (role === 'venue_coordinator') return withActions(venueScope(body.venueId), only);
      return fx.cities.some((x) => x.id === body.cityId)
        ? { resource: { cityId: body.cityId as string }, actions: only }
        : null;
    }
    default:
      return undefined;
  }
};

/**
 * The server's scope check for a staff token, run after the request validates. A role that no
 * action of the endpoint allows is forbidden. A known record outside the caller's scope is
 * forbidden, except on the scoped reads (`any` actions such as `adminSessions.get`), which answer
 * not_found so the record's existence is not revealed.
 */
const staffGuard = (def: EndpointDef, c: Ctx, requestId: string): Response | null => {
  const principal = c.principal ?? null;
  const actions = def.actions as readonly ScopeAction[];
  const roles = new Set<Role>(actions.flatMap((a) => [...ACTIONS[a].roles]));
  if (!principal?.assignments.some((a) => roles.has(a.role)))
    return errorResponse('forbidden', requestId);
  const target = staffResource(def, c);
  if (!target) return null;
  if (target.actions.every((a) => ACTIONS[a].level === 'any')) {
    const r = target.resource as { cityId: string; venueId: string };
    return target.actions.some((a) => inScope(filterFor(c, a), r)) ? null : notFound(requestId);
  }
  if (target.actions.some((a) => can(principal, a, target.resource))) return null;
  return errorResponse('forbidden', requestId);
};

const signedIn = (account: (typeof staffList)[number]) => ({
  accessToken: account.token,
  accessTokenExpiresAt: '2027-02-15T09:00:00Z',
  refreshToken: account.refreshToken,
  refreshTokenExpiresAt: '2027-03-15T08:00:00Z',
});

const generated = (id: keyof typeof endpoints) =>
  fakeFromSchema((endpoints[id] as EndpointDef).success.schema!, seeded(id));

const sessionMatches = (s: Session, q: Record<string, unknown>): boolean => {
  if (q.cityId && s.cityId !== q.cityId) return false;
  if (q.areaId && s.areaId !== q.areaId) return false;
  if (q.venueId && s.venueId !== q.venueId) return false;
  if (q.circleId && s.circle?.id !== q.circleId) return false;
  if (q.program && s.program !== q.program) return false;
  if (q.kind && s.kind !== q.kind) return false;
  if (q.section && s.section !== q.section) return false;
  if (q.language && s.language !== q.language) return false;
  const days = q.dayOfWeek as number[] | undefined;
  if (days?.length && !days.some((d) => s.daysOfWeek.includes(d))) return false;
  if (q.timeFrom && s.localStartTime < (q.timeFrom as string)) return false;
  if (q.timeTo && s.localStartTime > (q.timeTo as string)) return false;
  if (q.q) {
    const needle = String(q.q).toLowerCase();
    const hay =
      `${s.title.en} ${s.title.ur ?? ''} ${s.venue.name.en} ${s.venue.name.ur ?? ''}`.toLowerCase();
    if (!hay.includes(needle)) return false;
  }
  return true;
};

const notFound = (requestId: string) => errorResponse('not_found', requestId);

const ref = (path: string): ValidationIssue => ({ path, code: 'invalid_reference' });

/** What a bulk import checks beyond the shape: ids that exist, and what is already there. */
const importChecks: {
  [K in ImportKind]: (row: unknown) => { issues: ValidationIssue[]; key: string; exists: boolean };
} = {
  venues: (row) => {
    const v = row as VenueCreate;
    const issues: ValidationIssue[] = [];
    if (!fx.cities.some((c) => c.id === v.cityId)) issues.push(ref('cityId'));
    const area = fx.areas.find((a) => a.id === v.areaId);
    if (!area) issues.push(ref('areaId'));
    else if (area.cityId !== v.cityId) issues.push({ path: 'areaId', code: 'area_not_in_city' });
    const key = `${v.cityId}|${v.name.en.toLowerCase()}`;
    const exists = fx.venues.some(
      (x) => x.cityId === v.cityId && x.name.en.toLowerCase() === v.name.en.toLowerCase(),
    );
    return { issues, key, exists };
  },
  coordinators: (row) => {
    const b = row as InviteBody;
    const issues: ValidationIssue[] = [];
    if (b.role === 'city_coordinator' && !fx.cities.some((c) => c.id === b.cityId))
      issues.push(ref('cityId'));
    if (b.role === 'venue_coordinator' && !fx.venues.some((v) => v.id === b.venueId))
      issues.push(ref('venueId'));
    const place =
      b.role === 'city_coordinator' ? b.cityId : b.role === 'venue_coordinator' ? b.venueId : '';
    return { issues, key: `${b.phone}|${b.role}|${place}`, exists: false };
  },
  sessions: (row) => {
    const x = row as SessionCreate;
    const issues: ValidationIssue[] = [];
    if (!fx.venues.some((v) => v.id === x.venueId)) issues.push(ref('venueId'));
    if (x.circleId && !fx.circles.some((c) => c.id === x.circleId)) issues.push(ref('circleId'));
    const when = x.kind === 'one_off' ? x.date : x.daysOfWeek.join(',');
    const key = `${x.venueId}|${x.title.en.toLowerCase()}|${x.kind}|${x.localStartTime}|${when}`;
    const exists = fx.sessions.some(
      (s) =>
        s.venueId === x.venueId &&
        s.kind === x.kind &&
        s.localStartTime === x.localStartTime &&
        s.title.en.toLowerCase() === x.title.en.toLowerCase(),
    );
    return { issues, key, exists };
  },
};

/** The bulk import in the mock: real per-row checks, nothing is stored. */
const importHandler = (kind: ImportKind) => (c: Ctx) => {
  const body = c.body as { dryRun: boolean; rows: unknown[] };
  const seen = new Set<string>();
  const rows: ImportRowResult[] = checkImportRows(kind, body.rows).map((check) => {
    if (!check.ok) return { index: check.index, status: 'invalid', issues: check.issues };
    const { issues, key, exists } = importChecks[kind](check.value);
    if (issues.length) return { index: check.index, status: 'invalid', issues };
    if (exists || seen.has(key)) return { index: check.index, status: 'duplicate', issues: [] };
    seen.add(key);
    return { index: check.index, status: 'created', issues: [] };
  });
  const counts = {
    created: rows.filter((r) => r.status === 'created').length,
    duplicate: rows.filter((r) => r.status === 'duplicate').length,
    invalid: rows.filter((r) => r.status === 'invalid').length,
  };
  return { dryRun: body.dryRun, applied: !body.dryRun && counts.invalid === 0, counts, rows };
};

/** A stored poster as the list shows it: `outOfDate` worked out against the session now. */
const posterView = (p: fx.FixturePoster): Poster => {
  const current = fx.fixturePosterSnapshot(p.sessionId);
  const reasons = current ? posterOutOfDate(p.sourceSnapshot, current) : [];
  return { ...p, outOfDate: reasons.length > 0 ? { reasons } : null };
};

/** Stand-in files for `adminPosters.file`: a 1x1 PNG and a one-page PDF, no content. */
const SAMPLE_PNG = Uint8Array.from(
  atob(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  ),
  (ch) => ch.charCodeAt(0),
);
const SAMPLE_PDF = new TextEncoder().encode(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
    '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
    '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]>>endobj\n' +
    'trailer<</Root 1 0 R>>\n%%EOF\n',
);

/** Pakistan is UTC+5 with no daylight saving. */
const pakistanDate = (instant: string): string =>
  new Date(Date.parse(instant) + 5 * 3600_000).toISOString().slice(0, 10);

const overrides: Record<string, (c: Ctx, requestId: string) => Response | unknown> = {
  'system.health': () => ({ ok: true, service: 'mock' }),
  'config.get': () => ({
    seasonMode: 'dora',
    hijriOffsetDays: 0,
    featureFlags: {
      circle_requests: true,
      session_companion: true,
      invite_friends: true,
      poster_sharing: false,
      quran_offline_copy: false,
      whatsapp_fallback_reminders: false,
      // rc.4 features: on in the mock so the screens can be built against it. Off by default on
      // a real server until a feature_flags row turns them on.
      reading_days: true,
      community_today: true,
      ayah_of_the_day: true,
      memorisation: true,
      read_along: true,
    },
    supportedLocales: ['en', 'ur'],
    minimumAppVersion: { ios: '1.0.0', android: '1.0.0' },
    serverTime: fx.FIXTURE_NOW,
  }),
  'content.page': (c, id) => fx.contentPages.find((p) => p.slug === c.params.slug) ?? notFound(id),
  'places.provinces': () => ({ items: fx.provinces }),
  'places.cities': (c) => ({
    items: fx.cities.filter((x) => !c.query.provinceId || x.provinceId === c.query.provinceId),
  }),
  'places.areas': (c) => ({ items: fx.areas.filter((a) => a.cityId === c.query.cityId) }),
  'venues.list': (c) => {
    const q = c.query;
    const items = fx.venues.filter(
      (v) =>
        (!q.cityId || v.cityId === q.cityId) &&
        (!q.areaId || v.areaId === q.areaId) &&
        (!q.womenSection || v.facilities.womenSection === q.womenSection) &&
        (!q.wheelchairAccess || v.facilities.elderWheelchairAccess === q.wheelchairAccess) &&
        (!q.q ||
          `${v.name.en} ${v.name.ur ?? ''}`.toLowerCase().includes(String(q.q).toLowerCase())),
    );
    return page(items, q as { cursor?: string; limit?: number });
  },
  'venues.get': (c, id) => fx.venues.find((v) => v.id === c.params.venueId) ?? notFound(id),
  'sessions.list': (c) =>
    page(
      fx.sessions.filter((s) => sessionMatches(s, c.query)),
      c.query as { cursor?: string; limit?: number },
    ),
  'sessions.get': (c, id) => fx.sessions.find((s) => s.id === c.params.sessionId) ?? notFound(id),
  'sessions.occurrences': (c, id) => {
    if (!fx.sessions.some((s) => s.id === c.params.sessionId)) return notFound(id);
    const from = c.query.from as string | undefined;
    const to = c.query.to as string | undefined;
    return {
      items: fx.occurrences
        .filter(
          (o) =>
            o.sessionId === c.params.sessionId &&
            (!from || o.startsAt >= from) &&
            (!to || o.startsAt <= to),
        )
        .slice(0, (c.query.limit as number | undefined) ?? 30)
        .map(fx.toPublicOccurrence),
    };
  },
  'occurrences.list': (c) => {
    const from = (c.query.from as string | undefined) ?? fx.FIXTURE_NOW;
    const to = c.query.to as string | undefined;
    const items = fx.occurrences
      .filter((o) => o.startsAt >= from && (!to || o.startsAt <= to))
      .filter((o) => c.query.includeCancelled === true || o.status !== 'cancelled')
      .map((o) => ({ o, s: fx.sessions.find((s) => s.id === o.sessionId)! }))
      .filter(({ s }) => sessionMatches(s, c.query))
      .sort((a, b) => a.o.startsAt.localeCompare(b.o.startsAt))
      .map(({ o, s }) => ({ ...fx.toPublicOccurrence(o), session: s }));
    return page(items, c.query as { cursor?: string; limit?: number });
  },
  'occurrences.get': (c, id) => {
    const o = fx.occurrences.find((x) => x.id === c.params.occurrenceId);
    const s = o && fx.sessions.find((x) => x.id === o.sessionId);
    return o && s ? { ...fx.toPublicOccurrence(o), session: s } : notFound(id);
  },
  'auth.requestCode': (c) => {
    const body = c.body as { phone: string; channel: 'whatsapp' | 'sms' };
    const account = staffList.find((a) => a.phone === body.phone);
    if (!account) return generated('auth.requestCode');
    return {
      challengeId: account.challengeId,
      channel: body.channel,
      expiresAt: '2027-02-15T08:10:00Z',
      resendAfterSeconds: 30,
    };
  },
  'auth.verifyCode': (c, id) => {
    const body = c.body as { challengeId: string; code: string };
    if (body.code !== '123456') return errorResponse('otp_invalid', id);
    const account = staffList.find((a) => a.challengeId === body.challengeId);
    if (account) return { ...signedIn(account), me: account.me, isNewAccount: false };
    const expires = '2027-02-15T09:00:00Z';
    return {
      accessToken: 'mock-user',
      accessTokenExpiresAt: expires,
      refreshToken: 'mock-refresh-token-0000',
      refreshTokenExpiresAt: '2027-03-15T08:00:00Z',
      me: fx.fixtureMe,
      isNewAccount: false,
    };
  },
  'auth.refresh': (c) => {
    const body = c.body as { refreshToken: string };
    const account = staffList.find((a) => a.refreshToken === body.refreshToken);
    return account ? signedIn(account) : generated('auth.refresh');
  },
  'me.get': (c) => c.me ?? fx.fixtureMe,
  'registrations.create': (c, id) => {
    const body = c.body as {
      sessionId: string;
      occurrenceId?: string;
      areaId: string;
      section: string;
      partySize: number;
    };
    const session = fx.sessions.find((s) => s.id === body.sessionId);
    if (!session) return notFound(id);
    return {
      id: fx.fixtureId('registration', 1),
      sessionId: session.id,
      occurrenceId: body.occurrenceId ?? null,
      areaId: body.areaId,
      section: body.section,
      partySize: body.partySize,
      status: session.registration.full ? 'waitlisted' : 'confirmed',
      waitlistPosition: session.registration.full ? 3 : null,
      createdAt: fx.FIXTURE_NOW,
      cancelledAt: null,
      session,
    };
  },
  'updates.feed': () => ({
    items: fx.fixtureUpdates,
    nextCursor: null,
    unreadCount: fx.fixtureUpdates.filter((u) => !u.isRead).length,
  }),
  'updates.unreadCount': () => ({ unreadCount: fx.fixtureUpdates.filter((u) => !u.isRead).length }),
  'registrations.export': () =>
    'name,phone,party_size,section,status\nSample Person,+923000000099,2,family,confirmed\n',
  'adminRegistrations.export': (c, id) => {
    const q = c.query as { cityId?: string; venueId?: string; from?: string; to?: string };
    if (q.from && q.to && q.from > q.to)
      return errorResponse('validation_failed', id, {
        issues: [{ path: 'from', code: 'invalid_range' }],
      });
    // An id the fixtures do not have is not_found (the guard already refused non-staff); a known
    // venue or city outside the caller's scope is forbidden, as on the server.
    const venue = q.venueId ? venueScope(q.venueId) : null;
    if (q.venueId && !venue) return notFound(id);
    if (q.cityId && !fx.cities.some((x) => x.id === q.cityId)) return notFound(id);
    const target = venue ?? (q.cityId ? { cityId: q.cityId } : null);
    if (target && !can(c.principal ?? null, 'registration.export', target))
      return errorResponse('forbidden', id);
    const day = pakistanDate(fx.FIXTURE_REGISTERED_AT);
    const inRange = (!q.from || day >= q.from) && (!q.to || day <= q.to);
    const scope = filterFor(c, 'registration.export');
    const lines = fx.sampleRegistrants
      .filter(
        (r) =>
          inRange &&
          inScope(scope, r) &&
          (!q.cityId || r.cityId === q.cityId) &&
          (!q.venueId || r.venueId === q.venueId),
      )
      .map((r) =>
        [
          csvCell(r.sessionId, { trusted: true }),
          csvCell(r.venueId, { trusted: true }),
          csvCell(r.cityId, { trusted: true }),
          csvCell(r.name),
          csvCell(r.phone, { trusted: true }),
          csvCell(r.partySize),
          csvCell(r.section, { trusted: true }),
          csvCell(r.status, { trusted: true }),
          csvCell(r.registeredAt, { trusted: true }),
        ].join(','),
      );
    return csvFile(REGISTRATION_EXPORT_COLUMNS, lines);
  },
  // The invite echoes the body, including a handover, so a resend can copy it.
  'adminRoles.invite': (c) => {
    const b = c.body as InviteBody;
    const invite: Invite = {
      ...(generated('adminRoles.invite') as Invite),
      phone: b.phone,
      displayName: b.displayName ?? null,
      role: b.role,
      scopeType:
        b.role === 'national_admin' ? 'national' : b.role === 'city_coordinator' ? 'city' : 'venue',
      cityId: 'cityId' in b ? b.cityId : null,
      venueId: 'venueId' in b ? b.venueId : null,
      status: 'pending',
      replacesAssignmentId: ('replacesAssignmentId' in b ? b.replacesAssignmentId : null) ?? null,
    };
    return invite;
  },
  'adminSessions.get': (c, id) =>
    fx.adminSessions.find((s) => s.id === c.params.sessionId) ?? notFound(id),
  'adminCircles.get': (c, id) => fx.circles.find((x) => x.id === c.params.circleId) ?? notFound(id),
  'adminVenues.list': (c) => {
    const scope = filterFor(c, 'venue.list_admin');
    const q = c.query as { cityId?: string; includeArchived?: boolean };
    const items = fx.venues.filter(
      (v) =>
        inScope(scope, { cityId: v.cityId, venueId: v.id }) &&
        (!q.cityId || v.cityId === q.cityId) &&
        (q.includeArchived === true || v.status !== 'archived'),
    );
    return page(items, c.query as { cursor?: string; limit?: number });
  },
  'adminSessions.list': (c) => {
    const scope = filterFor(c, 'session.list_admin');
    const q = c.query as { cityId?: string; venueId?: string; status?: string };
    const items = fx.adminSessions.filter(
      (s) =>
        inScope(scope, s) &&
        (!q.cityId || s.cityId === q.cityId) &&
        (!q.venueId || s.venueId === q.venueId) &&
        (!q.status || s.status === q.status),
    );
    return page(items, c.query as { cursor?: string; limit?: number });
  },
  'adminSessions.occurrences': (c, id) => {
    if (!fx.sessions.some((s) => s.id === c.params.sessionId)) return notFound(id);
    const q = c.query as { from?: string; to?: string; limit?: number };
    return {
      items: fx.occurrences
        .filter(
          (o) =>
            o.sessionId === c.params.sessionId &&
            (!q.from || o.startsAt >= q.from) &&
            (!q.to || o.startsAt <= q.to),
        )
        .slice(0, q.limit ?? 30),
    };
  },
  'adminCircles.list': (c) => {
    const scope = filterFor(c, 'circle.list_admin');
    const q = c.query as { cityId?: string; venueId?: string; status?: string };
    const items = fx.circles.filter(
      (x) =>
        inScope(scope, x) &&
        (!q.cityId || x.cityId === q.cityId) &&
        (!q.venueId || x.venueId === q.venueId) &&
        (!q.status || x.status === q.status),
    );
    return page(items, c.query as { cursor?: string; limit?: number });
  },
  'adminAttendance.get': (c, id) => {
    const o = fx.occurrences.find((x) => x.id === c.params.occurrenceId);
    if (!o) return notFound(id);
    return { occurrenceId: o.id, headcount: o.headcount, entries: [], markedAt: null };
  },
  'registrations.forSession': (c, id) => {
    if (!fx.sessions.some((s) => s.id === c.params.sessionId)) return notFound(id);
    const q = c.query as {
      occurrenceId?: string;
      status?: string;
      cursor?: string;
      limit?: number;
    };
    const all = fx.staffRegistrants(c.params.sessionId!);
    const rows = all.filter(
      (r) =>
        (!q.status || r.status === q.status) &&
        (!q.occurrenceId || r.occurrenceId === null || r.occurrenceId === q.occurrenceId),
    );
    return {
      ...page(rows, q),
      totals: {
        registrations: all.length,
        people: all.filter((r) => r.status === 'confirmed').reduce((n, r) => n + r.partySize, 0),
        waitlisted: all.filter((r) => r.status === 'waitlisted').length,
      },
    };
  },
  'adminUpdates.preview': (c) => {
    const scope = (c.body as { scope: { type: 'national' | 'city' | 'venue' } }).scope.type;
    return { recipients: scope === 'national' ? 4200 : scope === 'city' ? 640 : 85 };
  },
  'readingDays.record': (c, id) => {
    const body = c.body as ReadingDayRecord;
    const issue = readingDayDateIssue(body.date, new Date(fx.FIXTURE_NOW));
    if (issue) return errorResponse('validation_failed', id, { issues: [issue] });
    const date = body.date ?? pakistanDateOf(fx.FIXTURE_NOW);
    const known = fx.fixtureReadingDays.find((d) => d.date === date);
    const sources = new Set([...(known?.sources ?? []), body.source]);
    const day: ReadingDay = {
      date,
      sources: READING_DAY_SOURCES.filter((x) => sources.has(x)),
      pages: Math.max(known?.pages ?? 0, body.pages ?? 0),
      ayahs: Math.max(known?.ayahs ?? 0, body.ayahs ?? 0),
    };
    return day;
  },
  'readingDays.list': (c, id) => {
    const q = c.query as { from: string; to: string };
    const issue = readingRangeIssue(q);
    if (issue) return errorResponse('validation_failed', id, { issues: [issue] });
    return { items: fx.fixtureReadingDays.filter((d) => d.date >= q.from && d.date <= q.to) };
  },
  'memorisation.list': (c) => ({
    items: [...fx.fixtureMemorisation].sort((a, b) => a.surah - b.surah),
    reviseAfterDays:
      c.me?.profile.memorisationReviseAfterDays ?? MEMORISATION_REVISE_AFTER_DAYS_DEFAULT,
  }),
  'memorisation.put': (c) => {
    const surah = Number(c.params.surah);
    const body = c.body as MemorisationPut;
    const known = fx.fixtureMemorisation.find((m) => m.surah === surah);
    const stamp =
      body.markRevised === true || (body.status === 'memorised' && !known?.lastRevisedAt);
    return {
      surah,
      status: body.status,
      lastRevisedAt: stamp ? fx.FIXTURE_NOW : (known?.lastRevisedAt ?? null),
      updatedAt: fx.FIXTURE_NOW,
    };
  },
  'community.today': () => fx.fixtureCommunityToday,
  'ayahOfTheDay.get': (c) => {
    const q = c.query as { date?: string; venueId?: string[]; circleId?: string[] };
    return resolveDailyAyah({
      date: q.date ?? pakistanDateOf(fx.FIXTURE_NOW),
      picks: fx.dailyAyahs,
      followedVenueIds: q.venueId ?? [],
      followedCircleIds: q.circleId ?? [],
    });
  },
  'adminDailyAyahs.list': (c, id) => {
    const q = c.query as {
      from: string;
      to: string;
      scopeType?: string;
      venueId?: string;
      circleId?: string;
    };
    const issue = readingRangeIssue(q);
    if (issue) return errorResponse('validation_failed', id, { issues: [issue] });
    const scope = filterFor(c, 'daily_ayah.manage');
    const items = fx.dailyAyahs.filter(
      (x) =>
        x.date >= q.from &&
        x.date <= q.to &&
        (x.scopeType === 'national' ||
          inScope(scope, { cityId: x.cityId ?? '', venueId: x.venueId ?? '' })) &&
        (!q.scopeType || x.scopeType === q.scopeType) &&
        (!q.venueId || x.venueId === q.venueId) &&
        (!q.circleId || x.circleId === q.circleId),
    );
    return { items };
  },
  'adminDailyAyahs.put': (c, id) => {
    const b = c.body as DailyAyahPut;
    let place: { cityId: string | null; venueId: string | null; circleId: string | null };
    if (b.scope.type === 'national') place = { cityId: null, venueId: null, circleId: null };
    else if (b.scope.type === 'venue') {
      const v = venueScope(b.scope.venueId);
      if (!v) return notFound(id);
      place = { cityId: v.cityId ?? null, venueId: v.venueId ?? null, circleId: null };
    } else {
      const circleId = b.scope.circleId;
      const x = fx.circles.find((y) => y.id === circleId);
      if (!x) return notFound(id);
      place = { cityId: x.cityId, venueId: x.venueId, circleId: x.id };
    }
    const existing = fx.dailyAyahs.find(
      (x) =>
        x.date === b.date &&
        x.scopeType === b.scope.type &&
        x.venueId === place.venueId &&
        x.circleId === place.circleId,
    );
    const entry: DailyAyahEntry = {
      id: existing?.id ?? fx.fixtureId('dailyAyah', 900),
      date: b.date,
      scopeType: b.scope.type,
      ...place,
      surah: b.surah,
      ayah: b.ayah,
      updatedAt: fx.FIXTURE_NOW,
    };
    return entry;
  },
  // The guard has already refused a known pick outside the caller's scope; an unknown id is
  // not_found, as the endpoint's description says.
  'adminDailyAyahs.delete': (c, id) =>
    fx.dailyAyahs.some((x) => x.id === c.params.dailyAyahId) ? undefined : notFound(id),
  'adminPosters.templates': () => ({ items: fx.posterTemplates }),
  'adminPosters.list': (c, id) => {
    if (!fx.sessions.some((s) => s.id === c.params.sessionId)) return notFound(id);
    return {
      items: fx.posters
        .filter((p) => p.sessionId === c.params.sessionId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map(posterView),
    };
  },
  'adminPosters.create': (c, id) => {
    const snapshot = fx.fixturePosterSnapshot(c.params.sessionId!);
    if (!snapshot) return notFound(id);
    const b = c.body as PosterCreate;
    // An unknown or inactive template is an unknown reference: not_found for staff.
    const template = fx.posterTemplates.find((t) => t.key === b.templateKey);
    if (!template) return notFound(id);
    if (b.formats.some((f) => !template.formats.includes(f)))
      return errorResponse('validation_failed', id, {
        issues: [{ path: 'formats', code: 'invalid_value' }],
      });
    const items: Poster[] = b.formats.map((format, i) => ({
      id: fx.fixtureId('poster', 900 + i),
      sessionId: snapshot.sessionId,
      templateKey: template.key,
      format,
      language: b.language,
      locale: posterLocaleOf(b.language),
      fields: b.fields,
      status: 'queued',
      failureCode: null,
      altText: null,
      fileUrl: null,
      sourceSnapshot: snapshot,
      outOfDate: null,
      replacesPosterId: null,
      createdAt: fx.FIXTURE_NOW,
    }));
    return { items };
  },
  'adminPosters.regenerate': (c, id) => {
    const old = fx.posters.find((p) => p.id === c.params.posterId);
    if (!old) return notFound(id);
    if (old.status === 'queued') return errorResponse('conflict', id);
    const fresh: Poster = {
      ...old,
      id: fx.fixtureId('poster', 950),
      status: 'queued',
      failureCode: null,
      altText: null,
      fileUrl: null,
      sourceSnapshot: fx.fixturePosterSnapshot(old.sessionId)!,
      outOfDate: null,
      replacesPosterId: old.id,
      createdAt: fx.FIXTURE_NOW,
    };
    return fresh;
  },
  'adminPosters.file': (c, id) => {
    const p = fx.posters.find((x) => x.id === c.params.posterId);
    if (!p) return notFound(id);
    if (p.status !== 'ready') return errorResponse('conflict', id);
    const pdf = p.format === 'print_a4' || p.format === 'print_a3';
    const ext = pdf ? 'pdf' : 'png';
    return new Response(pdf ? SAMPLE_PDF : SAMPLE_PNG, {
      status: 200,
      headers: {
        'content-type': pdf ? 'application/pdf' : 'image/png',
        'content-disposition': `attachment; filename="poster-${p.templateKey}-${p.format}.${ext}"`,
      },
    });
  },
  'adminImport.venues': importHandler('venues'),
  'adminImport.coordinators': importHandler('coordinators'),
  'adminImport.sessions': importHandler('sessions'),
};

export interface MockOptions {
  /** Extra or replacement handlers by endpoint id. */
  handlers?: Record<string, (c: Ctx, requestId: string) => Response | unknown>;
}

export function createMockHandler(options: MockOptions = {}): MockHandler {
  const table = { ...overrides, ...options.handlers };
  let counter = 0;
  return async (request) => {
    const requestId = `mock-${++counter}`;
    const url = new URL(request.url);
    const method = request.method.toUpperCase();

    if (url.pathname === '/openapi-version') return json(200, { version: CONTRACT_VERSION });

    let matched: { def: EndpointDef; params: Record<string, string> } | undefined;
    let pathKnown = false;
    for (const { def, re } of routes) {
      const m = re.exec(url.pathname);
      if (!m) continue;
      pathKnown = true;
      if (def.method === method) {
        matched = { def, params: { ...(m.groups ?? {}) } };
        break;
      }
    }
    if (!matched) return errorResponse(pathKnown ? 'conflict' : 'not_found', requestId);
    const { def, params } = matched;

    const forced = request.headers.get('x-mock-error');
    if (forced) {
      if (forced in ERROR_CODES) {
        const code = forced as ErrorCode;
        const retry =
          code === 'rate_limited' || code === 'otp_too_many_attempts'
            ? { retryAfterSeconds: 30 }
            : undefined;
        return errorResponse(code, requestId, retry);
      }
      return errorResponse('validation_failed', requestId, {
        issues: [{ path: 'x-mock-error', code: 'invalid_value' }],
      });
    }

    let me: Me | undefined;
    if (def.auth !== 'public') {
      const token = /^Bearer (.+)$/.exec(request.headers.get('authorization') ?? '')?.[1];
      if (!token) return errorResponse('unauthenticated', requestId);
      if (token === 'mock-expired') return errorResponse('token_expired', requestId);
      if (token === 'mock-suspended') return errorResponse('account_suspended', requestId);
      const staff = staffByToken(token);
      if (def.auth === 'staff' && !staff) return errorResponse('forbidden', requestId);
      me = staff?.me ?? fx.fixtureMe;
    }

    const parsedParams = def.params ? def.params.safeParse(params) : null;
    if (parsedParams && !parsedParams.success)
      return errorResponse('validation_failed', requestId, {
        issues: issuesOf(parsedParams.error),
      });
    const parsedQuery = def.query ? def.query.safeParse(queryObject(def, url.searchParams)) : null;
    if (parsedQuery && !parsedQuery.success)
      return errorResponse('validation_failed', requestId, { issues: issuesOf(parsedQuery.error) });
    let body: unknown;
    if (def.body) {
      const raw = (await request.json().catch(() => undefined)) as unknown;
      const parsedBody = def.body.safeParse(raw);
      if (!parsedBody.success)
        return errorResponse('validation_failed', requestId, {
          issues: issuesOf(parsedBody.error),
        });
      body = parsedBody.data;
    }

    const ctx: Ctx = {
      params: (parsedParams?.success ? parsedParams.data : params) as Record<string, string>,
      query: (parsedQuery?.success ? parsedQuery.data : {}) as Record<string, unknown>,
      body,
      ...(me ? { me, principal: principalOf(me) } : {}),
    };

    if (def.auth === 'staff') {
      const denied = staffGuard(def, ctx, requestId);
      if (denied) return denied;
    }

    const handler = table[def.id];
    // A 204 endpoint has no body to generate, but its handler still runs: it can refuse the
    // request (not_found for an unknown id, for example). Anything else it returns is dropped.
    if (def.success.status === 204) {
      const result = handler ? handler(ctx, requestId) : undefined;
      return result instanceof Response ? result : new Response(null, { status: 204 });
    }

    const result = handler
      ? handler(ctx, requestId)
      : fakeFromSchema(def.success.schema!, seeded(def.id));
    if (result instanceof Response) return result;
    if (def.success.contentType === 'text/csv') {
      return new Response(String(result), { status: 200, headers: { 'content-type': 'text/csv' } });
    }
    return json(def.success.status, result);
  };
}
