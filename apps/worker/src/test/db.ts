import { PGlite } from '@electric-sql/pglite';
import { guardTransactions } from '@qc/db/testing';
import { sql } from 'drizzle-orm';
import { drizzle, type PgliteDatabase } from 'drizzle-orm/pglite';
import { migrateUp, pgliteExecutor, schema } from '@qc/db';
import type { Db } from '../db';

export interface TestDb {
  pg: PGlite;
  db: Db & PgliteDatabase<typeof schema>;
  /** Empties every table so the next test starts clean without re-running migrations. */
  reset(): Promise<void>;
}

/** An in-process Postgres with every real migration applied. Booting takes a few seconds. */
export async function createTestDb(): Promise<TestDb> {
  // Transactions refuse overlapping queries, as node-postgres 9 will (F-02).
  const pg = guardTransactions(new PGlite());
  await migrateUp(pgliteExecutor(pg));
  const db = drizzle(pg, { schema });
  return {
    pg,
    db,
    async reset() {
      const rows = await pg.query<{ tablename: string }>(
        `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'schema_migrations'`,
      );
      if (rows.rows.length === 0) return;
      const list = rows.rows.map((r) => `"${r.tablename}"`).join(', ');
      await db.execute(sql.raw(`TRUNCATE ${list} RESTART IDENTITY CASCADE`));
    },
  };
}
