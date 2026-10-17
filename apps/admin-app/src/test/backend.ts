import {
  ERROR_CODES,
  can,
  endpoints,
  makeApiError,
  scopeFilter,
  updatePostAction,
  type AdminCircle,
  type AdminOccurrence,
  type EndpointDef,
  type ErrorCode,
  type Me,
  type Principal,
  type ScopeAction,
  type ValidationIssue,
  type Session,
  type StaffRegistration,
  type Venue,
} from '@qc/contracts';
import * as fx from '@qc/contracts/fixtures';
import { createMockHandler } from '@qc/contracts/mock';
import { principalOf } from '../scope/principal';

/**
 * A stateful, in-memory stand-in for the API, built on the contract's mock handler. It keeps
 * what screens write (schedule changes, attendance, circles) so a test can read it back, it
 * checks every request body and query against the contract schemas (the mock does that), and
 * it applies the same role-and-scope matrix as the real server (`can` from `@qc/contracts`) so
 * a venue coordinator really is refused on another venue. No network is used.
 */

export const FIXTURE_NOW = new Date(fx.FIXTURE_NOW);
export const STAFF_TOKEN = 'mock-staff';

/** Request text may omit Urdu; stored and returned text always carries it (null when absent). */
function withUrdu<T>(value: T): T {
  if (Array.isArray(value)) return value.map(withUrdu) as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = withUrdu(v);
    if (typeof out.en === 'string' && !('ur' in out)) out.ur = null;
    return out as T;
  }
  return value;
}

const uuid = (n: number): string => `00000000-0000-4000-8000-0b${String(n).padStart(10, '0')}`;

const VENUE_AL_NOOR = fx.venues[0]!;
const VENUE_LAHORE = fx.venues[4]!;
const CITY_RAWALPINDI = fx.cities[0]!;
const CITY_LAHORE = fx.cities.find((c) => c.id === VENUE_LAHORE.cityId)!;

export const ids = {
  venueAlNoor: VENUE_AL_NOOR.id,
  venueLahore: VENUE_LAHORE.id,
  cityRawalpindi: CITY_RAWALPINDI.id,
  cityLahore: CITY_LAHORE.id,
  /** Taraweeh with Dora, at Al-Noor, every day. */
  sessionDora: fx.sessions[0]!.id,
  /** The women's Dora at Markaz Iqra (same city, other venue): 40 seats, all taken. */
  sessionWomen: fx.sessions[1]!.id,
  /** The Tuesday Tajweed Circle at Al-Noor. */
  sessionCircle: fx.sessions[3]!.id,
  /** Johar Town Dora, in Lahore: outside Rawalpindi. */
  sessionLahore: fx.sessions[4]!.id,
  circlePublished: fx.circles[0]!.id,
  circlePending: fx.circles[1]!.id,
} as const;

export type RoleKind = 'venue' | 'city' | 'admin' | 'multi';

const role = (
  n: number,
  kind: 'national_admin' | 'city_coordinator' | 'venue_coordinator',
  scope: {
    cityId?: string;
    venueId?: string;
    name?: { en: string; ur: string };
  },
) => ({
  id: uuid(n),
  role: kind,
  scopeType:
    kind === 'national_admin'
      ? ('national' as const)
      : kind === 'city_coordinator'
        ? ('city' as const)
        : ('venue' as const),
  cityId: scope.cityId ?? null,
  venueId: scope.venueId ?? null,
  scopeName: scope.name ?? null,
  createdAt: '2027-01-05T05:00:00Z',
});

/** Synthetic people only. The numbers are in the fixture range and belong to no one. */
export function meFor(kind: RoleKind): Me {
  const roles = {
    venue: [
      role(1, 'venue_coordinator', {
        venueId: ids.venueAlNoor,
        name: { en: 'Sample Masjid Al-Noor', ur: 'نمونہ مسجد النور' },
      }),
    ],
    city: [
      role(2, 'city_coordinator', {
        cityId: ids.cityRawalpindi,
        name: { en: 'Rawalpindi', ur: 'راولپنڈی' },
      }),
    ],
    admin: [role(3, 'national_admin', {})],
    multi: [
      role(4, 'venue_coordinator', {
        venueId: ids.venueAlNoor,
        name: { en: 'Sample Masjid Al-Noor', ur: 'نمونہ مسجد النور' },
      }),
      role(5, 'venue_coordinator', {
        venueId: ids.venueLahore,
        name: { en: 'Sample Masjid Bilal', ur: 'نمونہ مسجد بلال' },
      }),
    ],
  }[kind];
  return {
    ...fx.fixtureMe,
    id: uuid(100 + roles.length),
    displayName: 'Sample Coordinator',
    roles,
  };
}

export interface RecordedCall {
  endpoint: string;
  method: string;
  path: string;
  query: Record<string, string>;
  body: unknown;
}

type Handler = (ctx: Ctx, requestId: string) => Response | unknown;
interface Ctx {
  params: Record<string, string>;
  query: Record<string, unknown>;
  body: unknown;
}

export interface Backend {
  /** Pass to `AuthProvider` / `AppProviders`. */
  fetch: typeof fetch;
  me: Me;
  principal: Principal;
  /** Every request, in order. */
  calls: RecordedCall[];
  callsTo: (endpointId: string) => RecordedCall[];
  /**
   * Makes the next requests to an endpoint fail with a contract error code. `issues` go with a
   * `validation_failed` answer, as the real server sends them.
   */
  failWith: (
    endpointId: string,
    code: ErrorCode,
    options?: { times?: number; issues?: ValidationIssue[] },
  ) => void;
  /** While offline every request fails like a dropped connection. */
  setOffline: (offline: boolean) => void;
  /** What the server holds. */
  state: {
    sessions: Session[];
    occurrences: AdminOccurrence[];
    venues: Venue[];
    circles: AdminCircle[];
    registrants: Map<string, StaffRegistration[]>;
    attendance: Map<
      string,
      { headcount: number | null; entries: unknown[]; markedAt: string | null }
    >;
    updates: unknown[];
  };
}

const errorResponse = (code: ErrorCode, extra?: Parameters<typeof makeApiError>[2]): Response =>
  new Response(JSON.stringify(makeApiError(code, 'test-request', extra)), {
    status: ERROR_CODES[code],
    headers: { 'content-type': 'application/json' },
  });

/** Names are invented. Phone numbers sit in the fixture range. */
const FIRST_NAMES = [
  'Sample Guest One',
  'Sample Guest Two',
  'نمونہ مہمان',
  'Sample Guest Four',
  'Sample Guest Five',
];

export function registrantsFor(
  sessionId: string,
  count: number,
  occurrenceId: string | null = null,
): StaffRegistration[] {
  return Array.from({ length: count }, (_, i) => ({
    id: uuid(1000 + i + (sessionId.endsWith('1') ? 0 : 500)),
    name:
      i === 6
        ? null
        : (FIRST_NAMES[i % FIRST_NAMES.length] ?? 'Sample Guest') +
          (i >= FIRST_NAMES.length ? ` ${i + 1}` : ''),
    phone: i === 5 ? null : `+92300000${String(10 + i).padStart(4, '0')}`,
    areaId: fx.areas[0]!.id,
    section: (['family', 'women', 'men'] as const)[i % 3]!,
    partySize: (i % 4) + 1,
    status: i === 4 ? ('waitlisted' as const) : ('confirmed' as const),
    occurrenceId,
    allowsWhatsapp: i % 2 === 0,
    createdAt: '2027-02-10T06:00:00Z',
  }));
}

export interface BackendOptions {
  me?: Me;
  /** How many registrants each session gets. Default 3. */
  registrantCount?: number;
  /** Extra or replacement handlers, by endpoint id. */
  handlers?: Record<string, Handler>;
}

const findDef = (
  method: string,
  pathname: string,
): { def: EndpointDef; params: Record<string, string> } | null => {
  for (const def of Object.values(endpoints) as EndpointDef[]) {
    if (def.method !== method) continue;
    const re = new RegExp(`^${def.path.replace(/\{(\w+)\}/g, '(?<$1>[^/]+)')}/?$`);
    const m = re.exec(pathname);
    if (m) return { def, params: { ...(m.groups ?? {}) } };
  }
  return null;
};

export function createBackend(options: BackendOptions = {}): Backend {
  const me = options.me ?? meFor('city');
  const principal = principalOf(me);
  const count = options.registrantCount ?? 3;
  const calls: RecordedCall[] = [];
  const failures = new Map<
    string,
    { code: ErrorCode; times: number; issues?: ValidationIssue[] }
  >();
  let offline = false;

  const state: Backend['state'] = {
    sessions: structuredClone(fx.sessions),
    occurrences: structuredClone(fx.occurrences),
    venues: structuredClone(fx.venues),
    circles: structuredClone(fx.circles),
    registrants: new Map(),
    attendance: new Map(),
    updates: [],
  };
  for (const s of state.sessions) {
    state.registrants.set(s.id, registrantsFor(s.id, s.id === ids.sessionWomen ? 60 : count));
  }

  const sessionOf = (id: string) => state.sessions.find((s) => s.id === id);
  const occurrenceOf = (id: string) => state.occurrences.find((o) => o.id === id);
  const okFor = (action: ScopeAction, r: { cityId?: string | null; venueId?: string | null }) =>
    can(principal, action, r);
  /** Followers in reach of an update, by scope. Preview and post agree unless a test says not. */
  const recipientsFor = (scope: 'national' | 'city' | 'venue') =>
    scope === 'national' ? 1200 : scope === 'city' ? 140 : 37;
  const page = <T>(items: T[], query: Record<string, unknown>) => {
    const start = query.cursor ? Number.parseInt(String(query.cursor), 10) || 0 : 0;
    const limit = (query.limit as number | undefined) ?? 20;
    return {
      items: items.slice(start, start + limit),
      nextCursor: start + limit < items.length ? String(start + limit) : null,
    };
  };

  const handlers: Record<string, Handler> = {
    'auth.verifyCode': (c, id) => {
      const body = c.body as { code: string };
      if (body.code !== '123456') return errorResponse('otp_invalid');
      void id;
      return {
        accessToken: STAFF_TOKEN,
        accessTokenExpiresAt: '2027-02-15T09:00:00Z',
        refreshToken: 'mock-refresh-token-0000',
        refreshTokenExpiresAt: '2027-03-15T08:00:00Z',
        me,
        isNewAccount: false,
      };
    },
    'me.get': () => me,
    'adminSessions.list': (c) => {
      const filter = scopeFilter(principal, 'session.list_admin');
      const q = c.query as { cityId?: string; venueId?: string };
      const items = state.sessions
        .filter(
          (s) =>
            filter.national ||
            filter.cityIds.includes(s.cityId) ||
            filter.venueIds.includes(s.venueId),
        )
        .filter(
          (s) => (!q.cityId || s.cityId === q.cityId) && (!q.venueId || s.venueId === q.venueId),
        )
        .map((s) => ({ ...s, circleStatus: s.circle ? ('published' as const) : null }));
      return page(items, c.query);
    },
    'adminSessions.get': (c) => {
      // Scoped like the list. Outside the scope the answer is not_found, so nothing is revealed.
      const filter = scopeFilter(principal, 'session.list_admin');
      const s = sessionOf(c.params.sessionId!);
      const inScope =
        s &&
        (filter.national ||
          filter.cityIds.includes(s.cityId) ||
          filter.venueIds.includes(s.venueId));
      if (!s || !inScope) return errorResponse('not_found');
      return { ...s, circleStatus: s.circle ? ('published' as const) : null };
    },
    'adminSessions.occurrences': (c) => {
      const from = c.query.from as string | undefined;
      const items = state.occurrences
        .filter((o) => o.sessionId === c.params.sessionId && (!from || o.startsAt >= from))
        .slice(0, (c.query.limit as number | undefined) ?? 30);
      return { items };
    },
    'adminSessions.changeSchedule': (c) => {
      const s = sessionOf(c.params.sessionId!);
      if (!s) return errorResponse('not_found');
      const body = c.body as {
        localStartTime?: string;
        durationMinutes?: number;
        daysOfWeek?: number[];
        effectiveFrom: string;
        notify: boolean;
      };
      if (body.localStartTime) s.localStartTime = body.localStartTime;
      if (body.durationMinutes) s.durationMinutes = body.durationMinutes;
      if (body.daysOfWeek) s.daysOfWeek = body.daysOfWeek;
      const changed = state.occurrences.filter(
        (o) => o.sessionId === s.id && o.status === 'scheduled',
      ).length;
      return {
        session: s,
        occurrencesChanged: changed,
        updatePostedId: body.notify ? uuid(9000) : null,
      };
    },
    'adminOccurrences.update': (c) => {
      const o = occurrenceOf(c.params.occurrenceId!);
      if (!o) return errorResponse('not_found');
      const body = c.body as Partial<AdminOccurrence> & { notify: boolean };
      const { notify, ...rest } = body;
      void notify;
      Object.assign(o, rest);
      return { occurrence: o };
    },
    'registrations.forSession': (c) => {
      const all = state.registrants.get(c.params.sessionId!) ?? [];
      const status = c.query.status as string | undefined;
      const rows = all.filter((r) => !status || r.status === status);
      return {
        ...page(rows, c.query),
        totals: {
          registrations: all.length,
          people: all.filter((r) => r.status === 'confirmed').reduce((n, r) => n + r.partySize, 0),
          waitlisted: all.filter((r) => r.status === 'waitlisted').length,
        },
      };
    },
    'adminAttendance.get': (c) => {
      const held = state.attendance.get(c.params.occurrenceId!);
      return {
        occurrenceId: c.params.occurrenceId,
        headcount: held?.headcount ?? null,
        entries: held?.entries ?? [],
        markedAt: held?.markedAt ?? null,
      };
    },
    'adminAttendance.put': (c) => {
      const body = c.body as { headcount: number; entries: unknown[] };
      const held = { headcount: body.headcount, entries: body.entries, markedAt: fx.FIXTURE_NOW };
      state.attendance.set(c.params.occurrenceId!, held);
      const o = occurrenceOf(c.params.occurrenceId!);
      if (o) o.headcount = body.headcount;
      return { occurrenceId: c.params.occurrenceId, ...held };
    },
    'adminVenues.list': (c) => {
      const filter = scopeFilter(principal, 'venue.list_admin');
      const q = c.query as { cityId?: string; includeArchived?: boolean };
      const items = state.venues
        .filter(
          (v) =>
            filter.national || filter.cityIds.includes(v.cityId) || filter.venueIds.includes(v.id),
        )
        .filter(
          (v) =>
            (!q.cityId || v.cityId === q.cityId) && (q.includeArchived || v.status !== 'archived'),
        );
      return page(items, c.query);
    },
    'adminVenues.create': (c) => {
      const body = c.body as Record<string, unknown> & {
        name: { en: string; ur?: string };
        address: { en: string; ur?: string };
        facilities: Record<string, unknown>;
      };
      const venue = {
        id: uuid(7000 + state.venues.length),
        slug: `new-venue-${state.venues.length}`,
        status: 'active',
        ...withUrdu(body),
        facilities: {
          womenSection: false,
          parking: false,
          wuduArea: false,
          elderWheelchairAccess: false,
          childFriendly: false,
          entranceNotes: null,
          ...withUrdu(body.facilities),
        },
      } as unknown as Venue;
      state.venues.push(venue);
      return venue;
    },
    'adminVenues.update': (c) => {
      const v = state.venues.find((x) => x.id === c.params.venueId);
      if (!v) return errorResponse('not_found');
      const body = c.body as { facilities?: Record<string, unknown> } & Record<string, unknown>;
      const { facilities, ...rest } = withUrdu(body);
      Object.assign(v, rest);
      if (facilities) Object.assign(v.facilities, facilities);
      return v;
    },
    'adminCircles.list': (c) => {
      const filter = scopeFilter(principal, 'circle.list_admin');
      const q = c.query as { cityId?: string; venueId?: string };
      const items = state.circles
        .filter(
          (x) =>
            filter.national ||
            filter.cityIds.includes(x.cityId) ||
            filter.venueIds.includes(x.venueId),
        )
        .filter(
          (x) => (!q.cityId || x.cityId === q.cityId) && (!q.venueId || x.venueId === q.venueId),
        );
      return page(items, c.query);
    },
    'adminCircles.get': (c) => {
      const filter = scopeFilter(principal, 'circle.list_admin');
      const circle = state.circles.find((x) => x.id === c.params.circleId);
      const inScope =
        circle &&
        (filter.national ||
          filter.cityIds.includes(circle.cityId) ||
          filter.venueIds.includes(circle.venueId));
      return inScope ? circle : errorResponse('not_found');
    },
    'adminCircles.create': (c) => {
      const body = c.body as { venueId: string } & Record<string, unknown>;
      const venue = state.venues.find((v) => v.id === body.venueId);
      if (!venue) return errorResponse('not_found');
      // Venue coordinators create circles that wait for a city coordinator.
      const publishes = can(principal, 'circle.approve', {
        cityId: venue.cityId,
        venueId: venue.id,
      });
      const circle = {
        id: uuid(8000 + state.circles.length),
        cityId: venue.cityId,
        createdAt: fx.FIXTURE_NOW,
        approvedAt: publishes ? fx.FIXTURE_NOW : null,
        status: publishes ? 'published' : 'pending_approval',
        ...withUrdu(body),
      } as unknown as AdminCircle;
      state.circles.push(circle);
      return circle;
    },
    'adminCircles.update': (c) => {
      const circle = state.circles.find((x) => x.id === c.params.circleId);
      if (!circle) return errorResponse('not_found');
      Object.assign(circle, withUrdu(c.body));
      return circle;
    },
    'adminCircles.decide': (c) => {
      const circle = state.circles.find((x) => x.id === c.params.circleId);
      if (!circle) return errorResponse('not_found');
      if (circle.status !== 'pending_approval') return errorResponse('circle_not_pending');
      const body = c.body as { decision: 'approve' | 'reject' };
      circle.status = body.decision === 'approve' ? 'published' : 'rejected';
      circle.approvedAt = body.decision === 'approve' ? fx.FIXTURE_NOW : null;
      return circle;
    },
    'adminTemplates.list': () => ({
      items: [
        {
          key: 'time_change',
          channel: 'push',
          locale: 'en',
          body: 'The session now starts at {time}.',
          variables: ['time'],
          costCategory: 'utility',
          status: 'approved',
        },
        {
          key: 'time_change',
          channel: 'push',
          locale: 'ur',
          body: 'سیشن اب {time} بجے شروع ہوگا۔',
          variables: ['time'],
          costCategory: 'utility',
          status: 'approved',
        },
        {
          key: 'reminder',
          channel: 'push',
          locale: 'en',
          body: 'See you today at {venue}. {link}',
          variables: ['venue', 'link'],
          costCategory: 'utility',
          status: 'approved',
        },
        {
          key: 'draft_only',
          channel: 'push',
          locale: 'en',
          body: 'Not approved yet.',
          variables: [],
          costCategory: 'utility',
          status: 'draft',
        },
      ],
    }),
    'adminUpdates.list': (c) => page(state.updates, c.query),
    'adminUpdates.preview': (c) => {
      const body = c.body as { scope: { type: 'national' | 'city' | 'venue' } };
      return { recipients: recipientsFor(body.scope.type) };
    },
    'adminUpdates.post': (c) => {
      const body = c.body as {
        scope: { type: 'national' | 'city' | 'venue'; cityId?: string; venueId?: string };
        kind: string;
        title: { en: string; ur?: string };
        body: { en: string; ur?: string };
        sessionId?: string;
        notify: boolean;
      };
      const cityId =
        body.scope.type === 'venue'
          ? (state.venues.find((v) => v.id === body.scope.venueId)?.cityId ?? null)
          : (body.scope.cityId ?? null);
      const posted = {
        id: uuid(9100 + state.updates.length),
        kind: body.kind,
        scope: { type: body.scope.type, cityId, venueId: body.scope.venueId ?? null },
        title: { en: body.title.en, ur: body.title.ur ?? null },
        body: { en: body.body.en, ur: body.body.ur ?? null },
        sessionId: body.sessionId ?? null,
        publishedAt: fx.FIXTURE_NOW,
        authorName: me.displayName,
        recipients: recipientsFor(body.scope.type),
      };
      state.updates.push(posted);
      return posted;
    },
    ...options.handlers,
  };

  const inner = createMockHandler({ handlers });

  /** The server's own scope check, run before the handler. */
  async function guard(request: Request): Promise<Response | null> {
    const url = new URL(request.url);
    const found = findDef(request.method.toUpperCase(), url.pathname);
    if (!found || found.def.auth !== 'staff') return null;
    const { def, params } = found;
    let body: Record<string, unknown> | undefined;
    if (def.body)
      body = (await request
        .clone()
        .json()
        .catch(() => undefined)) as Record<string, unknown> | undefined;

    let resource: { cityId?: string | null; venueId?: string | null } | null = null;
    if (params.sessionId) {
      const s = sessionOf(params.sessionId);
      if (s) resource = { cityId: s.cityId, venueId: s.venueId };
    } else if (params.occurrenceId) {
      const o = occurrenceOf(params.occurrenceId);
      const s = o && sessionOf(o.sessionId);
      if (s) resource = { cityId: s.cityId, venueId: s.venueId };
    } else if (params.venueId) {
      const v = state.venues.find((x) => x.id === params.venueId);
      if (v) resource = { cityId: v.cityId, venueId: v.id };
    } else if (params.circleId) {
      const c = state.circles.find((x) => x.id === params.circleId);
      if (c) resource = { cityId: c.cityId, venueId: c.venueId };
    } else if (def.id === 'adminCircles.create' && typeof body?.venueId === 'string') {
      const v = state.venues.find((x) => x.id === body.venueId);
      if (v) resource = { cityId: v.cityId, venueId: v.id };
    } else if (def.id === 'adminVenues.create' && typeof body?.cityId === 'string') {
      resource = { cityId: body.cityId };
    } else if (
      (def.id === 'adminUpdates.post' || def.id === 'adminUpdates.preview') &&
      body?.scope
    ) {
      const scope = body.scope as {
        type: 'national' | 'city' | 'venue';
        cityId?: string;
        venueId?: string;
      };
      const venue = scope.venueId ? state.venues.find((x) => x.id === scope.venueId) : undefined;
      const action = updatePostAction(scope.type);
      return can(principal, action, {
        cityId: scope.cityId ?? venue?.cityId,
        venueId: scope.venueId,
      })
        ? null
        : errorResponse('forbidden');
    }
    if (!resource) return null;
    const actions = def.actions as readonly ScopeAction[];
    return actions.some((a) => okFor(a, resource!)) ? null : errorResponse('forbidden');
  }

  const fakeFetch: typeof fetch = async (input, init) => {
    if (offline) throw new TypeError('Failed to fetch');
    const request = new Request(input as RequestInfo, init);
    const url = new URL(request.url);
    const found = findDef(request.method.toUpperCase(), url.pathname);
    const query: Record<string, string> = {};
    url.searchParams.forEach((v, k) => {
      query[k] = v;
    });
    let body: unknown;
    if (request.method !== 'GET')
      body = await request
        .clone()
        .json()
        .catch(() => undefined);
    calls.push({
      endpoint: found?.def.id ?? 'unknown',
      method: request.method.toUpperCase(),
      path: url.pathname,
      query,
      body,
    });
    const forced = found && failures.get(found.def.id);
    if (forced && forced.times > 0) {
      forced.times -= 1;
      return errorResponse(
        forced.code,
        forced.code === 'rate_limited'
          ? { retryAfterSeconds: 30 }
          : forced.issues
            ? { issues: forced.issues }
            : undefined,
      );
    }
    const denied = await guard(request);
    if (denied) return denied;
    return inner(request);
  };

  return {
    fetch: fakeFetch,
    me,
    principal,
    calls,
    callsTo: (endpointId) => calls.filter((c) => c.endpoint === endpointId),
    failWith: (endpointId, code, opts) => {
      failures.set(endpointId, { code, times: opts?.times ?? 1, issues: opts?.issues });
    },
    setOffline: (value) => {
      offline = value;
    },
    state,
  };
}
