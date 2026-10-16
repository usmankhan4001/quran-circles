import { ERROR_CODES, makeApiError, type ErrorCode } from './errors';
import { endpoints } from './endpoints';
import type { EndpointDef } from './define';
import { fakeFromSchema, seeded } from './fake';
import * as fx from './fixtures';
import { z } from 'zod';
import type { Session } from './schemas/sessions';
import { CONTRACT_VERSION } from './openapi';

/**
 * A mock server generated from the API contract. It validates every request against the schemas,
 * serves realistic synthetic data for every endpoint and can produce every error case.
 *
 * Try it:
 * - `Authorization: Bearer mock-user` is an attendee; `mock-staff` is a national admin;
 *   `mock-expired` gets token_expired; no token on a signed-in endpoint gets unauthenticated.
 * - `x-mock-error: <error code>` makes any endpoint fail with that code.
 * - Code `123456` signs in; any other code gets otp_invalid.
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

const issuesOf = (error: z.ZodError) =>
  error.issues.map((i) => ({ path: i.path.join('.'), code: i.code })).slice(0, 20);

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

type Ctx = { params: Record<string, string>; query: Record<string, unknown>; body: unknown };

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
  'auth.verifyCode': (c, id) => {
    const body = c.body as { code: string };
    if (body.code !== '123456') return errorResponse('otp_invalid', id);
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
  'me.get': () => fx.fixtureMe,
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

    if (def.auth !== 'public') {
      const token = /^Bearer (.+)$/.exec(request.headers.get('authorization') ?? '')?.[1];
      if (!token) return errorResponse('unauthenticated', requestId);
      if (token === 'mock-expired') return errorResponse('token_expired', requestId);
      if (token === 'mock-suspended') return errorResponse('account_suspended', requestId);
      if (def.auth === 'staff' && token !== 'mock-staff')
        return errorResponse('forbidden', requestId);
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
    };

    if (def.success.status === 204) return new Response(null, { status: 204 });

    const handler = table[def.id];
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
