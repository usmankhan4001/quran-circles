import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { schema } from '@qc/db';
import { OverlappingQueryError } from '@qc/db/testing';
import { createHarness, type Harness } from './harness';

/**
 * F-02: node-postgres runs one query at a time per client, and pg 9 throws on overlap. The
 * harness's PGlite refuses overlapping queries inside a transaction the same way, so every API
 * test fails if a handler runs `Promise.all` over a transaction handle. This keeps the guard on.
 */
let h: Harness;
beforeAll(async () => {
  h = await createHarness();
});
afterAll(() => h.close());

describe('transaction guard in the API test harness', () => {
  it('refuses Promise.all over a transaction handle', async () => {
    const attempt = h.db.transaction(async (tx) => {
      await Promise.all([tx.select().from(schema.cities), tx.select().from(schema.venues)]);
    });
    await expect(attempt).rejects.toMatchObject({ cause: expect.any(OverlappingQueryError) });
  });

  it('allows the same reads side by side outside a transaction', async () => {
    const [cities, venues] = await Promise.all([
      h.db.select().from(schema.cities),
      h.db.select().from(schema.venues),
    ]);
    expect(cities.length).toBeGreaterThan(0);
    expect(venues.length).toBeGreaterThan(0);
  });
});
