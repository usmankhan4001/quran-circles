import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { cities as fixtureCities } from '@qc/contracts/fixtures';
import type { SqlExecutor } from '@qc/db';
import { parseCsvObjects } from './csv';
import { MigrationToolError } from './errors';
import { readMapping } from './places';
import { planFingerprint, runMigration, type RunOptions } from './run';
import { takeSnapshot, verifySnapshots } from './snapshot';
import {
  syntheticMappingCsv,
  syntheticRegistrations,
  syntheticSubscribers,
  syntheticVenues,
} from './synthetic';
import { clearMigrated, countRows, createSeededTarget, type TestTarget } from './test/db';

let target: TestTarget;
beforeAll(async () => {
  target = await createSeededTarget();
});
afterAll(async () => {
  await target.pg.close();
});
beforeEach(async () => {
  await clearMigrated(target);
});

const input = (overrides: Partial<RunOptions['input']> = {}): RunOptions['input'] => ({
  venues: syntheticVenues(),
  registrations: syntheticRegistrations(),
  subscribers: syntheticSubscribers(),
  mapping: readMapping(parseCsvObjects(syntheticMappingCsv())),
  createAreas: true,
  ...overrides,
});

const NOW = new Date('2026-10-16T09:00:00Z');
const run = (apply: boolean, inputOverrides: Partial<RunOptions['input']> = {}, db: SqlExecutor | null = target.exec) =>
  runMigration({ db, apply, now: NOW, input: input(inputOverrides) });

const tables = ['areas', 'venues', 'legacy_registrations', 'legacy_whatsapp_subscribers', 'users'];
async function rowCounts() {
  const out: Record<string, number> = {};
  for (const t of tables) out[t] = await countRows(target, t);
  return out;
}

describe('dry run', () => {
  it('writes nothing', async () => {
    const before = await rowCounts();
    const { report } = await run(false);
    expect(report.mode).toBe('dry-run');
    expect(report.applied).toBeUndefined();
    expect(await rowCounts()).toEqual(before);
  });

  it('runs inside a read-only transaction, so even a bug could not write', async () => {
    const statements: string[] = [];
    const spy: SqlExecutor = {
      exec: async (sql) => {
        statements.push(sql);
        await target.exec.exec(sql);
      },
      query: async (sql, params) => {
        statements.push(sql);
        return target.exec.query(sql, params);
      },
    };
    await run(false, {}, spy);
    expect(statements[0]).toBe('BEGIN READ ONLY');
    expect(statements.at(-1)).toBe('ROLLBACK');
    expect(statements.some((s) => /^\s*(insert|update|delete)/i.test(s))).toBe(false);
  });

  it('works offline against the nine fixture cities and an empty target', async () => {
    const { report } = await run(false, {}, null);
    expect(report.target).toBe('offline');
    expect(report.totals.venues.toInsert).toBeGreaterThan(0);
  });

  it('refuses to apply offline', async () => {
    await expect(run(true, {}, null)).rejects.toBeInstanceOf(MigrationToolError);
  });
});

describe('counts per category', () => {
  it('classifies the synthetic venues', async () => {
    const { report } = await run(false);
    const v = report.totals.venues;
    expect(v.read).toBe(14);
    expect(v).toMatchObject({
      invalidRow: 1, // 14: no address
      duplicate: 1, // 8
      unapproved: 1, // 10
      unknownCity: 1, // 11: karachi is not in V2
      invalidCoordinates: 1, // 9: swapped
      toInsert: 9 - 1 - 1 - 1 + 0, // placeholder replaced below
    });
  });
});
