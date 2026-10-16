import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MigrationToolError } from './errors';
import {
  exportNeonTables,
  exportVenuesFromPostgres,
  exportVenuesFromRest,
  type QueryClient,
} from './export';
import { buildPlan } from './plan';
import { readMapping } from './places';
import { parseCsvObjects } from './csv';
import { offlineTarget } from './target';
import {
  syntheticMappingCsv,
  syntheticRegistrations,
  syntheticSubscribers,
  syntheticVenues,
} from './synthetic';

/** A stand-in for V1's databases with synthetic rows and a push table that must stay untouched. */
async function createV1(): Promise<PGlite> {
  const pg = new PGlite();
  await pg.exec(`
    CREATE TABLE programs (
      id uuid PRIMARY KEY, created_at timestamptz NOT NULL, name text NOT NULL, venue text,
      address text NOT NULL, lat double precision NOT NULL, lng double precision NOT NULL,
      contact text, organizer text, timing text, category text NOT NULL, google_maps_link text);
    CREATE TABLE registeration (
      id serial PRIMARY KEY, timestamp text, location text, read text, want text, name text,
      mobile text, age text, profession text, education text, area text);
    CREATE TABLE whatsapp_subscribers (phone text PRIMARY KEY, venue text, name text);
    CREATE TABLE push_subscriptions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), endpoint text, p256dh text, auth text);
    INSERT INTO push_subscriptions (endpoint, p256dh, auth) VALUES ('https://push.example.test/dummy', 'dummy', 'dummy');
  `);
  for (const v of syntheticVenues()) {
    await pg.query(
      `INSERT INTO programs (id, created_at, name, venue, address, lat, lng, contact, organizer, timing, category, google_maps_link)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        v.id,
        v.created_at,
        v.name,
        v.venue,
        v.address,
        v.lat,
        v.lng,
        v.contact,
        v.organizer,
        v.timing,
        v.category,
        v.google_maps_link,
      ],
    );
  }
  for (const r of syntheticRegistrations()) {
    await pg.query(
      `INSERT INTO registeration (id, timestamp, location, read, want, name, mobile, age, profession, education, area)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        r.id,
        r.timestamp,
        r.location,
        r.read,
        r.want,
        r.name,
        r.mobile,
        r.age,
        r.profession,
        r.education,
        r.area,
      ],
    );
  }
  for (const s of syntheticSubscribers()) {
    await pg.query(
      `INSERT INTO whatsapp_subscribers (phone, venue, name) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
      [s.phone, s.venue, s.name],
    );
  }
  return pg;
}

let v1: PGlite;
beforeAll(async () => {
  v1 = await createV1();
});
afterAll(async () => {
  await v1.close();
});

/** Wraps a client and records every statement it is asked to run. */
function recording(client: QueryClient) {
  const statements: string[] = [];
  return {
    statements,
    client: {
      query: async (text: string, values?: unknown[]) => {
        statements.push(text);
        return client.query(text, values);
      },
    } satisfies QueryClient,
  };
}

describe('exporting from V1 Postgres, read-only', () => {
  it('reads venues, registrations and subscribers', async () => {
    const venues = await exportVenuesFromPostgres(v1);
    const neon = await exportNeonTables(v1);
    expect(venues).toHaveLength(14);
    expect(neon.registrations).toHaveLength(17);
    expect(neon.subscribers).toHaveLength(6);
  });

  it('asks only for the columns the migration needs', async () => {
    const [venue] = (await exportVenuesFromPostgres(v1)) as Record<string, unknown>[];
    expect(Object.keys(venue!).sort()).toEqual(
      ['address', 'contact', 'created_at', 'id', 'lat', 'lng', 'name', 'venue'].sort(),
    );
    const { registrations } = await exportNeonTables(v1);
    expect(Object.keys(registrations[0] as object).sort()).toEqual(
      [
        'age',
        'area',
        'education',
        'id',
        'location',
        'mobile',
        'name',
        'profession',
        'read',
        'timestamp',
        'want',
      ].sort(),
    );
  });

  it('only ever runs SELECTs inside a read-only transaction, and never names the push table', async () => {
    const { client, statements } = recording(v1);
    await exportVenuesFromPostgres(client);
    await exportNeonTables(client);
    expect(statements.filter((s) => s.startsWith('BEGIN'))).toEqual([
      'BEGIN READ ONLY',
      'BEGIN READ ONLY',
    ]);
    expect(statements.filter((s) => s === 'ROLLBACK')).toHaveLength(2);
    const others = statements.filter((s) => !s.startsWith('BEGIN') && s !== 'ROLLBACK');
    expect(others.every((s) => /^\s*SELECT\b/i.test(s))).toBe(true);
    expect(statements.join('\n').toLowerCase()).not.toContain('push');
    expect(statements.join('\n')).not.toMatch(
      /\b(insert|update|delete|drop|alter|create|truncate)\b/i,
    );
  });

  it('the transaction really cannot write', async () => {
    let attempt: unknown;
    const writer: QueryClient = {
      query: async (text, values) => {
        const result = await v1.query(text, values);
        if (text.startsWith('SELECT "phone"')) {
          // The last read of the export: try to write in the same transaction.
          attempt = await v1
            .query(`INSERT INTO whatsapp_subscribers (phone) VALUES ('+923000000999')`)
            .catch((error: unknown) => error);
        }
        return result;
      },
    };
    await exportNeonTables(writer);
    expect(attempt).toMatchObject({ code: '25006' }); // read_only_sql_transaction
    const count = await v1.query<{ n: string }>(
      'SELECT count(*)::text AS n FROM whatsapp_subscribers',
    );
    expect(Number(count.rows[0]?.n)).toBe(6);
  });

  it('ends the transaction even when a table is missing', async () => {
    const { client, statements } = recording(v1);
    await expect(
      exportNeonTables(client, { registrations: 'no_such_table' }),
    ).rejects.toMatchObject({ code: 'v1_shape' });
    expect(statements.at(-1)).toBe('ROLLBACK');
  });

  it('refuses an unsafe table name instead of splicing it into SQL', async () => {
    await expect(
      exportNeonTables(v1, { registrations: 'registeration; DROP TABLE programs' }),
    ).rejects.toBeInstanceOf(MigrationToolError);
    const still = await v1.query('SELECT 1 FROM programs LIMIT 1');
    expect(still.rows).toHaveLength(1);
  });

  it('reads an older registration table that lacks the later columns', async () => {
    const old = new PGlite();
    await old.exec(`
      CREATE TABLE registeration (id serial PRIMARY KEY, timestamp text, location text, read text, want text, name text, mobile text, age text, profession text);
      CREATE TABLE whatsapp_subscribers (phone text PRIMARY KEY, venue text, name text);
      INSERT INTO registeration (location, name, mobile) VALUES ('Sample Masjid Al-Noor', 'Test Person 1', '923000000101');`);
    const { registrations } = await exportNeonTables(old);
    expect(Object.keys(registrations[0] as object)).not.toContain('education');
    const plan = buildPlan({
      venues: syntheticVenues(),
      registrations,
      subscribers: [],
      mapping: readMapping(parseCsvObjects(syntheticMappingCsv())),
      target: offlineTarget(),
      createAreas: true,
    });
    expect(plan.counts.totals.registrations.toInsert).toBe(1);
    await old.close();
  });

  it('refuses a registration table without the columns it cannot do without', async () => {
    const broken = new PGlite();
    await broken.exec(`CREATE TABLE registeration (id serial PRIMARY KEY, location text);
                       CREATE TABLE whatsapp_subscribers (phone text PRIMARY KEY);`);
    await expect(exportNeonTables(broken)).rejects.toMatchObject({ code: 'v1_shape' });
    await broken.close();
  });

  it('what it exports flows straight into the plan', async () => {
    const venues = await exportVenuesFromPostgres(v1);
    const { registrations, subscribers } = await exportNeonTables(v1);
    const plan = buildPlan({
      venues,
      registrations,
      subscribers,
      mapping: readMapping(parseCsvObjects(syntheticMappingCsv())),
      target: offlineTarget(),
      createAreas: true,
    });
    expect(plan.counts.totals.venues).toMatchObject({ read: 14, toInsert: 9, duplicate: 1 });
    expect(plan.counts.totals.registrations.toInsert).toBe(10);
    expect(plan.counts.totals.subscribers.toInsert).toBe(4);
  });
});

describe('exporting venues over HTTPS (Supabase REST), GET only', () => {
  const rows = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ id: `id-${i}`, address: 'a' }));

  function fakeFetch(total: number, status = 200) {
    const calls: { url: URL; init: RequestInit | undefined }[] = [];
    const impl = (async (input: URL | string, init?: RequestInit) => {
      const url = new URL(String(input));
      calls.push({ url, init });
      const offset = Number(url.searchParams.get('offset'));
      const limit = Number(url.searchParams.get('limit'));
      const body =
        status === 200
          ? rows(total).slice(offset, offset + limit)
          : { message: 'Test Person 1 +923000000101' };
      return new Response(JSON.stringify(body), { status });
    }) as typeof fetch;
    return { impl, calls };
  }
  const options = { url: 'https://v1.example.test', anonKey: 'dummy-public-key' };

  it('reads every page with GET and the public key, and nothing else', async () => {
    const { impl, calls } = fakeFetch(2300);
    const result = await exportVenuesFromRest({ ...options, fetchImpl: impl });
    expect(result).toHaveLength(2300);
    expect(calls.map((c) => c.url.searchParams.get('offset'))).toEqual(['0', '1000', '2000']);
    for (const call of calls) {
      expect(call.init?.method).toBe('GET');
      expect(call.init?.body).toBeUndefined();
      expect(call.url.pathname).toBe('/rest/v1/programs');
      expect(call.url.searchParams.get('select')).toBe(
        'id,created_at,name,venue,address,lat,lng,contact',
      );
    }
    expect(new Headers(calls[0]!.init?.headers).get('apikey')).toBe('dummy-public-key');
  });

  it('stops after one page when the table is small', async () => {
    const { impl, calls } = fakeFetch(3);
    expect(await exportVenuesFromRest({ ...options, fetchImpl: impl })).toHaveLength(3);
    expect(calls).toHaveLength(1);
  });

  it('refuses http', async () => {
    await expect(
      exportVenuesFromRest({ ...options, url: 'http://v1.example.test' }),
    ).rejects.toMatchObject({ code: 'bad_url' });
  });

  it('reports the status without echoing the response body', async () => {
    const { impl } = fakeFetch(1, 401);
    const error = await exportVenuesFromRest({ ...options, fetchImpl: impl }).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(MigrationToolError);
    expect(String((error as Error).message)).toContain('401');
    expect(String((error as Error).message)).not.toContain('Test Person');
  });

  it('rejects an answer that is not a list', async () => {
    const impl = (async () => new Response('{"oops":1}', { status: 200 })) as typeof fetch;
    await expect(exportVenuesFromRest({ ...options, fetchImpl: impl })).rejects.toMatchObject({
      code: 'venue_export_failed',
    });
  });
});
