import { expectOk } from '../http';
import { assertSignInBudget } from '../limits';
import { as, pakistanDate, pool, signIn, type Api, type Person } from '../people';
import type { ScenarioFile } from './scenario';

/**
 * Seeds the evening through the public API, so the same code seeds a local stack or staging:
 * venues and sessions with the bulk import endpoints (one call each), then synthetic attendees
 * who sign in with the test-mode code and register a fake FCM device. Sign-ins stay inside the
 * API's global code ceiling (see `../limits`). All data is synthetic
 * and tagged with the run tag.
 */
export interface EveningData {
  runTag: string;
  cityId: string;
  areaIds: string[];
  center: { lat: number; lng: number };
  venueIds: string[];
  sessionIds: string[];
  users: Person[];
}

interface Items<T> {
  items: T[];
  nextCursor?: string | null;
}

const rand = (min: number, max: number): number => min + Math.random() * (max - min);

async function pagedIds(
  api: Api,
  admin: Person,
  id: 'adminVenues.list' | 'adminSessions.list',
  query: Record<string, string>,
  keep: (row: {
    id: string;
    name?: { en: string };
    title?: { en: string };
    venueId?: string;
  }) => boolean,
): Promise<string[]> {
  const out: string[] = [];
  let cursor: string | null | undefined;
  do {
    const page = expectOk<
      Items<{ id: string; name?: { en: string }; title?: { en: string }; venueId?: string }>
    >(
      await as(api, admin, id, { query: { ...query, limit: 100, ...(cursor ? { cursor } : {}) } }),
      `list ${id}`,
    );
    out.push(...page.items.filter(keep).map((r) => r.id));
    cursor = page.nextCursor;
  } while (cursor);
  return out;
}

export async function seedEvening(
  api: Api,
  admin: Person,
  scenario: ScenarioFile,
  log: (line: string) => void = () => undefined,
): Promise<EveningData> {
  const runTag = Date.now().toString(36);
  const s = scenario.seed;
  const cities = expectOk<Items<{ id: string; slug: string }>>(
    await as(api, admin, 'places.cities'),
    'list cities',
  ).items;
  const city = cities.find((c) => c.slug === s.citySlug) ?? cities[0];
  if (!city) throw new Error('no cities (run the @qc/db seed first)');
  const areaIds = expectOk<Items<{ id: string }>>(
    await as(api, admin, 'places.areas', { query: { cityId: city.id } }),
    'list areas',
  ).items.map((a) => a.id);
  if (areaIds.length === 0) throw new Error(`city ${city.slug} has no areas`);

  log(`seeding ${s.venues} venues in ${city.slug}`);
  const venueRows = Array.from({ length: s.venues }, (_, i) => ({
    cityId: city.id,
    areaId: areaIds[i % areaIds.length],
    name: { en: `Load ${runTag} Masjid ${i + 1}` },
    address: { en: `${i + 1} Synthetic Street` },
    lat: Number((s.center.lat + rand(-s.spreadDeg, s.spreadDeg)).toFixed(6)),
    lng: Number((s.center.lng + rand(-s.spreadDeg, s.spreadDeg)).toFixed(6)),
    facilities: { womenSection: i % 2 === 0 },
  }));
  const venueImport = expectOk<{ applied: boolean; counts: { created: number; invalid: number } }>(
    await as(api, admin, 'adminImport.venues', { body: { dryRun: false, rows: venueRows } }),
    'import venues',
  );
  if (!venueImport.applied)
    throw new Error(`venue import not applied (${venueImport.counts.invalid} invalid)`);
  const prefix = `Load ${runTag} `;
  const venueIds = await pagedIds(api, admin, 'adminVenues.list', { cityId: city.id }, (v) =>
    (v.name?.en ?? '').startsWith(prefix),
  );
  if (venueIds.length !== s.venues) {
    throw new Error(`expected ${s.venues} seeded venues, found ${venueIds.length}`);
  }

  log(`seeding ${s.venues * s.sessionsPerVenue} sessions (daily, Taraweeh hours)`);
  const sections = ['family', 'men', 'women'] as const;
  const times = ['19:30', '20:00', '20:30', '21:00', '21:30', '22:00'];
  const sessionRows = venueIds.flatMap((venueId, v) =>
    Array.from({ length: s.sessionsPerVenue }, (_, k) => ({
      kind: 'recurring',
      venueId,
      program: k === 0 ? 'dora' : 'circles',
      title: { en: `Load ${runTag} Session ${v + 1}.${k + 1}` },
      section: sections[(v + k) % 3],
      language: (v + k) % 4 === 0 ? 'en' : 'ur',
      localStartTime: times[(v * 3 + k) % times.length],
      durationMinutes: 90,
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      startsOn: pakistanDate(),
      endsOn: pakistanDate(30),
      // Every tenth session has a small capacity, so "full" and the waitlist are exercised.
      capacity: (v + k) % 10 === 0 ? 30 : null,
    })),
  );
  const sessionIds: string[] = [];
  for (let i = 0; i < sessionRows.length; i += 2000) {
    const res = expectOk<{ applied: boolean; counts: { invalid: number } }>(
      await as(api, admin, 'adminImport.sessions', {
        body: { dryRun: false, rows: sessionRows.slice(i, i + 2000) },
      }),
      'import sessions',
    );
    if (!res.applied) throw new Error(`session import not applied (${res.counts.invalid} invalid)`);
  }
  const venueSet = new Set(venueIds);
  sessionIds.push(
    ...(await pagedIds(api, admin, 'adminSessions.list', { cityId: city.id }, (row) =>
      venueSet.has(row.venueId ?? ''),
    )),
  );

  assertSignInBudget(s.users);
  log(`signing in ${s.users} synthetic attendees with fake push devices`);
  const users = await pool(Array.from({ length: s.users }), 16, async (_x, i) => {
    const person = await signIn(api, `attendee ${i}`);
    expectOk(
      await as(api, person, 'devices.register', {
        body: {
          // FCM-shaped fake tokens: a web push token must be a real subscription URL on an
          // allowed push service, which a load test must not invent.
          platform: 'android',
          provider: 'fcm',
          token: `qc-load-fake-${runTag}-${i}`,
          locale: i % 4 === 0 ? 'en' : 'ur',
        },
      }),
      'register device',
    );
    return person;
  });

  return {
    runTag,
    cityId: city.id,
    areaIds,
    center: s.center,
    venueIds,
    sessionIds,
    users,
  };
}
