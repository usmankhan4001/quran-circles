import { beforeAll, describe, expect, it } from 'vitest';
import { DEMO_POSTER_TEMPLATES } from '@qc/contracts';
import * as fixtures from '@qc/contracts/fixtures';
import { createMigratedDb, type TestDb } from './test/helpers';

/**
 * The migrations must leave the renderer's templates in `poster_templates` on a fresh install
 * (migration 0014 wrote them; production has no seed). When this fails after a change to
 * `DEMO_POSTER_TEMPLATES` in packages/contracts/src/posters.ts, add a migration: the API lists
 * templates from the table, not from the contract.
 */
let test: TestDb;
beforeAll(async () => {
  test = await createMigratedDb();
});

describe('the poster template catalog after the migrations', () => {
  it('has one row per renderer template, matching the contract, with the fixture ids', async () => {
    const { rows } = await test.pg.query<{
      id: string;
      key: string;
      name_en: string;
      name_ur: string;
      version: number;
      formats: string[];
      provisional: boolean;
      is_active: boolean;
    }>(
      `SELECT id, key, name_en, name_ur, version, formats, provisional, is_active
         FROM poster_templates ORDER BY key`,
    );
    const expected = fixtures.posterTemplates
      .map((t) => ({
        id: t.id,
        key: t.key,
        name_en: t.name.en,
        name_ur: t.name.ur,
        version: t.version,
        formats: [...t.formats],
        provisional: t.provisional,
        is_active: true,
      }))
      .sort((a, b) => a.key.localeCompare(b.key));
    expect(rows).toEqual(expected);
    expect(rows).toHaveLength(DEMO_POSTER_TEMPLATES.length);
  });
});
