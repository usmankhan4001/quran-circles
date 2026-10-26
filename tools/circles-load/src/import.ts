import type { ImportResult } from '@qc/contracts';
import { DEFAULTS, sessionRow, venueRow, type LoadDefaults } from './build';
import { normalise, type CleanRow } from './clean';
import type { PlannedVenue } from './plan';
import { slugOf } from './places';

/** The report file `circles-load report` writes. */
export interface PlanFile {
  venues: PlannedVenue[];
  rows: CleanRow[];
}

interface Localized {
  en: string;
  ur: string | null;
}
interface CityItem {
  id: string;
  slug: string;
  name: Localized;
}
interface AreaItem {
  id: string;
  slug: string;
}
interface VenueItem {
  id: string;
  cityId: string;
  name: Localized;
  lat: number;
  lng: number;
}
interface SessionItem {
  id: string;
  venueId: string;
}
interface Page<T> {
  items: T[];
  nextCursor?: string | null;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
  ) {
    super(`API ${status}`);
  }
}

/** A thin client for the few calls the load needs. Nothing but the token is kept. */
export class Api {
  constructor(
    readonly base: string,
    private token: string | null = null,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async call<T>(
    method: string,
    path: string,
    body?: unknown,
    query?: Record<string, string>,
  ): Promise<T> {
    const url = new URL(path, this.base);
    for (const [k, v] of Object.entries(query ?? {})) url.searchParams.set(k, v);
    const res = await this.fetchImpl(url, {
      method,
      headers: {
        'content-type': 'application/json',
        ...(this.token ? { authorization: `Bearer ${this.token}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await res.text();
    const parsed: unknown = text ? JSON.parse(text) : null;
    if (!res.ok) throw new ApiError(res.status, parsed);
    return parsed as T;
  }

  /** Email sign-in with the API's fixed test code (local) or a code the person reads out. */
  async signIn(email: string, phone: string, code: string): Promise<void> {
    const { challengeId } = await this.call<{ challengeId: string }>('POST', '/v1/auth/code', {
      email,
      phone,
    });
    const tokens = await this.call<{ accessToken: string }>('POST', '/v1/auth/verify', {
      challengeId,
      code,
      deviceLabel: 'circles-load',
    });
    this.token = tokens.accessToken;
  }

  async allPages<T>(path: string, query: Record<string, string> = {}): Promise<T[]> {
    const out: T[] = [];
    let cursor: string | undefined;
    for (;;) {
      const page = await this.call<Page<T>>('GET', path, undefined, {
        ...query,
        limit: '100',
        ...(cursor ? { cursor } : {}),
      });
      out.push(...page.items);
      if (!page.nextCursor) return out;
      cursor = page.nextCursor;
    }
  }
}

export interface LoadOptions {
  apply: boolean;
  startsOn: string;
  defaults?: Omit<LoadDefaults, 'startsOn'>;
  log?: (line: string) => void;
}

export interface LoadOutcome {
  venues: ImportResult;
  sessions: ImportResult | null;
  /** Ids this run created (empty on a dry run). What `unload` archives. */
  manifest: { venueIds: string[]; sessionIds: string[] };
  /** Venues that could not be mapped to a city or area of the target. */
  unmappedCities: string[];
}

const summary = (r: ImportResult): string =>
  `created ${r.counts.created}, duplicate ${r.counts.duplicate}, invalid ${r.counts.invalid}${r.applied ? ' (applied)' : ' (dry run)'}`;

/**
 * Loads the plan's importable venues and their circles through the API's own bulk import: the
 * same validation, scope checks and audit as the console. Dry run first, always; with `apply`,
 * the same rows are sent for real only when the dry run has no invalid row.
 */
export async function load(api: Api, plan: PlanFile, opts: LoadOptions): Promise<LoadOutcome> {
  const log = opts.log ?? (() => {});
  const defaults: LoadDefaults = { ...(opts.defaults ?? DEFAULTS), startsOn: opts.startsOn };

  const cities = (await api.call<{ items: CityItem[] }>('GET', '/v1/places/cities')).items;
  const cityOf = (name: string): CityItem | undefined =>
    cities.find((c) => normalise(c.name.en) === normalise(name) || c.slug === slugOf(name));
  const areaOf = new Map<string, string>();
  for (const city of cities) {
    const areas = (
      await api.call<{ items: AreaItem[] }>('GET', '/v1/places/areas', undefined, {
        cityId: city.id,
      })
    ).items;
    const main = areas.find((a) => a.slug === `${city.slug}-city`) ?? areas[0];
    if (main) areaOf.set(city.id, main.id);
  }

  // One venue row per importable venue; names are made unique within a city, because the
  // import treats a repeated name in one city as a duplicate and would skip the second venue.
  const importable = plan.venues.filter((v) => v.importable);
  const unmappedCities = new Set<string>();
  const namesUsed = new Map<string, number>();
  const venueRows: { key: string; body: NonNullable<ReturnType<typeof venueRow>>['body'] }[] = [];
  for (const v of importable) {
    const city = cityOf(v.city);
    const areaId = city ? areaOf.get(city.id) : undefined;
    if (!city || !areaId) {
      unmappedCities.add(v.city);
      continue;
    }
    const row = venueRow(v, { cityId: city.id, areaId });
    if (!row) continue;
    const nameKey = `${city.id}|${normalise(row.body.name.en)}`;
    const n = (namesUsed.get(nameKey) ?? 0) + 1;
    namesUsed.set(nameKey, n);
    if (n > 1) row.body.name.en = `${row.body.name.en} (${n})`;
    venueRows.push({ key: v.venueKey, body: row.body });
  }
  log(`venues to import: ${venueRows.length}; cities not in the target: ${unmappedCities.size}`);

  const before = await api.allPages<VenueItem>('/v1/admin/venues');
  const venueDry = await api.call<ImportResult>('POST', '/v1/admin/import/venues', {
    dryRun: true,
    rows: venueRows.map((r) => r.body),
  });
  log(`venues dry run: ${summary(venueDry)}`);
  const manifest = { venueIds: [] as string[], sessionIds: [] as string[] };
  if (!opts.apply || venueDry.counts.invalid > 0)
    return { venues: venueDry, sessions: null, manifest, unmappedCities: [...unmappedCities] };

  const venueRun = await api.call<ImportResult>('POST', '/v1/admin/import/venues', {
    dryRun: false,
    rows: venueRows.map((r) => r.body),
  });
  log(`venues: ${summary(venueRun)}`);
  const after = await api.allPages<VenueItem>('/v1/admin/venues');
  const known = new Set(before.map((v) => v.id));
  manifest.venueIds = after.filter((v) => !known.has(v.id)).map((v) => v.id);

  // Match each planned venue to its row in the target by city, name and position.
  const venueIdOf = new Map<string, string>();
  for (const r of venueRows) {
    const hit = after.find(
      (v) =>
        v.cityId === r.body.cityId &&
        normalise(v.name.en) === normalise(r.body.name.en) &&
        Math.abs(v.lat - r.body.lat) < 1e-6 &&
        Math.abs(v.lng - r.body.lng) < 1e-6,
    );
    if (hit) venueIdOf.set(r.key, hit.id);
  }

  const rowById = new Map(plan.rows.map((r) => [r.id, r]));
  const sessionRows = [];
  for (const v of importable) {
    const venueId = venueIdOf.get(v.venueKey);
    if (!venueId) continue;
    for (const id of v.sessionRows) {
      const row = rowById.get(id);
      const body = row ? sessionRow(row, venueId, defaults) : null;
      if (body) sessionRows.push(body);
    }
  }
  const sessionsBefore = await api.allPages<SessionItem>('/v1/admin/sessions');
  const sessionDry = await api.call<ImportResult>('POST', '/v1/admin/import/sessions', {
    dryRun: true,
    rows: sessionRows,
  });
  log(`sessions dry run: ${summary(sessionDry)}`);
  if (sessionDry.counts.invalid > 0)
    return {
      venues: venueRun,
      sessions: sessionDry,
      manifest,
      unmappedCities: [...unmappedCities],
    };
  const sessionRun = await api.call<ImportResult>('POST', '/v1/admin/import/sessions', {
    dryRun: false,
    rows: sessionRows,
  });
  log(`sessions: ${summary(sessionRun)}`);
  const sessionsAfter = await api.allPages<SessionItem>('/v1/admin/sessions');
  const knownSessions = new Set(sessionsBefore.map((s) => s.id));
  manifest.sessionIds = sessionsAfter.filter((s) => !knownSessions.has(s.id)).map((s) => s.id);
  return { venues: venueRun, sessions: sessionRun, manifest, unmappedCities: [...unmappedCities] };
}

/** Archives exactly what a load created: its sessions first, then its venues. */
export async function unload(
  api: Api,
  manifest: { venueIds: string[]; sessionIds: string[] },
  log: (line: string) => void = () => {},
): Promise<{ sessionsArchived: number; venuesArchived: number }> {
  let sessionsArchived = 0;
  for (const id of manifest.sessionIds) {
    await api.call('PATCH', `/v1/admin/sessions/${id}`, { status: 'archived' });
    sessionsArchived++;
  }
  log(`sessions archived: ${sessionsArchived}`);
  let venuesArchived = 0;
  for (const id of manifest.venueIds) {
    await api.call('POST', `/v1/admin/venues/${id}/archive`);
    venuesArchived++;
  }
  log(`venues archived: ${venuesArchived}`);
  return { sessionsArchived, venuesArchived };
}
