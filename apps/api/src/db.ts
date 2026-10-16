import { drizzle } from 'drizzle-orm/node-postgres';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import pg from 'pg';
import { schema } from '@qc/db';

export { schema };

/**
 * The database handle every module takes. It is the common type of the node-postgres driver (the
 * server) and the PGlite driver (tests), so the same module code runs against both. A transaction
 * from `db.transaction(...)` is also a `Db`.
 */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

export interface DbHandle {
  db: Db;
  close(): Promise<void>;
}

/** Connects to Postgres with a small pool. The URL comes from the environment, never from code. */
export function createPgDb(connectionString: string): DbHandle {
  const pool = new pg.Pool({ connectionString, max: 10 });
  const db: Db = drizzle(pool, { schema });
  return { db, close: () => pool.end() };
}
