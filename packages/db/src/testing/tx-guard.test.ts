import { sql } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import * as schema from '../schema/index';
import { createMigratedDb, type TestDb } from '../test/helpers';
import { OverlappingQueryError } from './tx-guard';

let test: TestDb;

beforeAll(async () => {
  // createEmptyDb (under createMigratedDb) applies the guard to every db test.
  test = await createMigratedDb();
});

describe('guardTransactions', () => {
  it('refuses overlapping queries on a transaction client, and rolls the transaction back', async () => {
    const attempt = test.db.transaction(async (tx) => {
      await tx.insert(schema.provinces).values({ code: 'GUARD', nameEn: 'G', nameUr: 'G' });
      await Promise.all([tx.select().from(schema.provinces), tx.select().from(schema.cities)]);
    });
    // Drizzle wraps the driver's error; the guard's error is its cause.
    await expect(attempt).rejects.toMatchObject({ cause: expect.any(OverlappingQueryError) });
    const { rows } = await test.pg.query(`SELECT 1 FROM provinces WHERE code = 'GUARD'`);
    expect(rows).toHaveLength(0);
  });

  it('allows the same queries one after another, including in a savepoint', async () => {
    const counts = await test.db.transaction(async (tx) => {
      const a = await tx.select().from(schema.provinces);
      const b = await tx.select().from(schema.cities);
      const c = await tx.transaction(async (inner) => inner.execute(sql`select 1 as one`));
      return [a.length, b.length, c.rows.length];
    });
    expect(counts).toEqual([0, 0, 1]);
  });

  it('leaves queries outside a transaction alone (a pool runs them on separate clients)', async () => {
    const [a, b] = await Promise.all([
      test.db.select().from(schema.provinces),
      test.db.select().from(schema.cities),
    ]);
    expect([a.length, b.length]).toEqual([0, 0]);
  });
});
