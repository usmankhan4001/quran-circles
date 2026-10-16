import { PGlite } from '@electric-sql/pglite';
import { cities, provinces } from '@qc/contracts/fixtures';
import { migrateUp, pgliteExecutor, type SqlExecutor } from '@qc/db';

export interface TestTarget {
  pg: PGlite;
  exec: SqlExecutor;
}

/**
 * A real Postgres in-process (PGlite) with every V2 migration applied and the nine V1 cities
 * seeded (provinces and cities only; no areas, venues or sessions), as a launch database would be.
 */
export async function createSeededTarget(): Promise<TestTarget> {
  const pg = new PGlite();
  const exec = pgliteExecutor(pg);
  await migrateUp(exec);
  for (const p of provinces) {
    await pg.query('INSERT INTO provinces (id, code, name_en, name_ur) VALUES ($1, $2, $3, $4)', [
      p.id,
      p.code,
      p.name.en,
      p.name.ur,
    ]);
  }
  for (const c of cities) {
    await pg.query(
      'INSERT INTO cities (id, province_id, slug, name_en, name_ur, timezone) VALUES ($1, $2, $3, $4, $5, $6)',
      [c.id, c.provinceId, c.slug, c.name.en, c.name.ur ?? c.name.en, c.timezone],
    );
  }
  return { pg, exec };
}

/** Empties everything the migration writes, keeping the seeded cities. */
export async function clearMigrated(target: TestTarget): Promise<void> {
  await target.pg.exec(
    'TRUNCATE legacy_registrations, legacy_whatsapp_subscribers, venues, areas CASCADE',
  );
}

export async function countRows(target: TestTarget, table: string): Promise<number> {
  const result = await target.pg.query<{ n: string }>(`SELECT count(*)::text AS n FROM ${table}`);
  return Number(result.rows[0]?.n);
}
