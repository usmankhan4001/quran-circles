import { MigrationToolError } from './errors';

/**
 * Read-only exporters for V1. They only ever SELECT (or send a GET), inside a READ ONLY
 * transaction, from the three tables the migration needs. `push_subscriptions` is never named:
 * push subscriptions are not carried over. Connection details come from the environment at run
 * time; nothing is stored in the repository.
 */

/** Structural match for a single `pg` client or a PGlite instance. */
export interface QueryClient {
  query(text: string, values?: unknown[]): Promise<{ rows: unknown[] }>;
}

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;
const quoteIdent = (name: string): string => {
  if (!IDENTIFIER.test(name)) throw new MigrationToolError('bad_identifier', 'Unsafe table name');
  return `"${name}"`;
};

export const V1_TABLES = {
  /** Supabase table of venues (the app calls them programs). */
  venues: 'programs',
  /** Neon registration table. The misspelling is V1's own. */
  registrations: 'registeration',
  subscribers: 'whatsapp_subscribers',
} as const;

const VENUE_COLUMNS = ['id', 'created_at', 'name', 'venue', 'address', 'lat', 'lng', 'contact'];
const REGISTRATION_COLUMNS = [
  'id',
  'timestamp',
  'location',
  'read',
  'want',
  'name',
  'mobile',
  'age',
  'profession',
  'education',
  'area',
];
const REQUIRED_REGISTRATION_COLUMNS = ['id', 'name', 'mobile', 'location'];
const SUBSCRIBER_COLUMNS = ['phone', 'venue', 'name'];

async function readOnly<T>(client: QueryClient, work: () => Promise<T>): Promise<T> {
  await client.query('BEGIN READ ONLY');
  try {
    return await work();
  } finally {
    // Nothing was written, so ending the transaction is always a rollback.
    await client.query('ROLLBACK');
  }
}

async function existingColumns(client: QueryClient, table: string): Promise<Set<string>> {
  const result = await client.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = $1`,
    [table],
  );
  return new Set((result.rows as { column_name: string }[]).map((r) => r.column_name));
}

async function selectColumns(
  client: QueryClient,
  table: string,
  wanted: readonly string[],
  required: readonly string[],
  orderBy: string,
): Promise<unknown[]> {
  const present = await existingColumns(client, table);
  const missing = required.filter((c) => !present.has(c));
  if (present.size === 0 || missing.length > 0) {
    throw new MigrationToolError(
      'v1_shape',
      `V1 table ${table} is missing or lacks required columns (${missing.length})`,
    );
  }
  const columns = wanted.filter((c) => present.has(c)).map(quoteIdent);
  const result = await client.query(
    `SELECT ${columns.join(', ')} FROM ${quoteIdent(table)} ORDER BY ${orderBy}`,
  );
  return result.rows;
}

/** Venues from V1's Supabase Postgres, over a read-only connection. */
export function exportVenuesFromPostgres(client: QueryClient): Promise<unknown[]> {
  return readOnly(client, () =>
    selectColumns(client, V1_TABLES.venues, VENUE_COLUMNS, ['id', 'address'], '1'),
  );
}

/** Registrations and WhatsApp subscribers from V1's Neon Postgres, over a read-only connection. */
export function exportNeonTables(
  client: QueryClient,
  tables: { registrations?: string; subscribers?: string } = {},
): Promise<{ registrations: unknown[]; subscribers: unknown[] }> {
  return readOnly(client, async () => ({
    registrations: await selectColumns(
      client,
      tables.registrations ?? V1_TABLES.registrations,
      REGISTRATION_COLUMNS,
      REQUIRED_REGISTRATION_COLUMNS,
      '1',
    ),
    subscribers: await selectColumns(
      client,
      tables.subscribers ?? V1_TABLES.subscribers,
      SUBSCRIBER_COLUMNS,
      ['phone'],
      '1',
    ),
  }));
}

export interface RestOptions {
  url: string;
  anonKey: string;
  fetchImpl?: typeof fetch;
}

const PAGE = 1000;

/**
 * Venues through Supabase's REST interface with GET requests only. V1's venue table is readable
 * with the public key the app already ships, so no database password is needed for this one.
 */
export async function exportVenuesFromRest(options: RestOptions): Promise<unknown[]> {
  const base = new URL(options.url);
  if (base.protocol !== 'https:') {
    throw new MigrationToolError('bad_url', 'The Supabase URL must be https');
  }
  const doFetch = options.fetchImpl ?? fetch;
  const rows: unknown[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const endpoint = new URL('/rest/v1/' + V1_TABLES.venues, base);
    endpoint.searchParams.set('select', VENUE_COLUMNS.join(','));
    endpoint.searchParams.set('order', 'created_at.asc,id.asc');
    endpoint.searchParams.set('limit', String(PAGE));
    endpoint.searchParams.set('offset', String(offset));
    const response = await doFetch(endpoint, {
      method: 'GET',
      headers: { apikey: options.anonKey, authorization: `Bearer ${options.anonKey}` },
    });
    if (!response.ok) {
      // The body is not read or shown: it could echo anything.
      throw new MigrationToolError('venue_export_failed', `Supabase answered HTTP ${response.status}`);
    }
    const page: unknown = await response.json();
    if (!Array.isArray(page)) {
      throw new MigrationToolError('venue_export_failed', 'Supabase did not return a list');
    }
    rows.push(...page);
    if (page.length < PAGE) return rows;
  }
}
