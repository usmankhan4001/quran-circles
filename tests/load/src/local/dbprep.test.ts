import type pg from 'pg';
import { describe, expect, it } from 'vitest';
import { formatStatements } from '../load/prep';
import {
  SEEDED_TABLES,
  StatementStats,
  analyzeTables,
  diffStatements,
  type Queryable,
  type StatementSnap,
} from './dbprep';

/** Fake database: answers by the first matching handler and records every statement. */
function fakeDb(handlers: [RegExp, (values?: unknown[]) => unknown[] | Error][]) {
  const sent: { text: string; values?: unknown[] }[] = [];
  const db: Queryable = {
    query<R extends pg.QueryResultRow>(text: string, values?: unknown[]) {
      sent.push({ text, values });
      const hit = handlers.find(([re]) => re.test(text));
      const out = hit ? hit[1](values) : [];
      if (out instanceof Error) return Promise.reject(out);
      return Promise.resolve({ rows: out as R[] });
    },
  };
  return { db, sent };
}

const pgError = (code: string, text: string): Error => Object.assign(new Error(text), { code });

const row = (key: string, calls: number, total: number, max = 1, rows = calls): object => ({
  key,
  query: `SELECT ${key} FROM t WHERE id = $1`,
  calls: String(calls),
  total,
  max,
  rows: String(rows),
});

describe('analyzeTables', () => {
  it('analyses the seeded tables that exist, in order, quoted, and times it', async () => {
    const { db, sent } = fakeDb([
      [/to_regclass/, () => ['venues', 'sessions', 'occurrences'].map((name) => ({ name }))],
    ]);
    let t = 100;
    const result = await analyzeTables(db, ['venues', 'sessions', 'occurrences', 'gone'], () => {
      t += 250;
      return t;
    });
    expect(sent[0]?.values).toEqual([['venues', 'sessions', 'occurrences', 'gone']]);
    expect(sent[1]?.text).toBe('ANALYZE public."venues", public."sessions", public."occurrences"');
    expect(result).toEqual({
      ran: true,
      tables: ['venues', 'sessions', 'occurrences'],
      missing: ['gone'],
      ms: 250,
      note: 'ANALYZE on 3 seeded tables in 250 ms; not in this database: gone',
    });
  });

  it('covers the tables the seed fills, occurrences among them', () => {
    expect(SEEDED_TABLES).toEqual(
      expect.arrayContaining(['venues', 'sessions', 'occurrences', 'users', 'devices']),
    );
  });

  it('skips ANALYZE when none of the tables exist', async () => {
    const { db, sent } = fakeDb([[/to_regclass/, () => []]]);
    const result = await analyzeTables(db, ['a', 'b']);
    expect(sent.some((s) => s.text.startsWith('ANALYZE'))).toBe(false);
    expect(result.ran).toBe(false);
    expect(result.missing).toEqual(['a', 'b']);
    expect(result.note).toMatch(/skipped/);
  });

  it('reports a failed ANALYZE instead of throwing', async () => {
    const { db } = fakeDb([
      [/to_regclass/, () => [{ name: 'venues' }]],
      [/^ANALYZE/, () => pgError('42501', 'permission denied')],
    ]);
    const result = await analyzeTables(db, ['venues']);
    expect(result.ran).toBe(false);
    expect(result.note).toMatch(/^ANALYZE failed \(permission denied\); planner statistics/);
  });
});

describe('diffStatements', () => {
  const snap = (key: string, calls: number, totalMs: number, maxMs = 1): StatementSnap => ({
    key,
    query: key,
    calls,
    totalMs,
    maxMs,
    rows: calls,
  });

  it('gives the work since the snapshot, largest total first, and drops idle statements', () => {
    const before = new Map([
      ['a', snap('a', 10, 100)],
      ['b', snap('b', 5, 50)],
      ['idle', snap('idle', 3, 30)],
    ]);
    const out = diffStatements(
      before,
      [snap('a', 20, 160, 9), snap('b', 6, 250), snap('idle', 3, 30), snap('new', 2, 10)],
      10,
    );
    expect(out.top.map((r) => [r.query, r.calls, r.totalMs, r.meanMs])).toEqual([
      ['b', 1, 200, 200],
      ['a', 10, 60, 6],
      ['new', 2, 10, 5],
    ]);
    expect(out.top[1]?.maxMs).toBe(9);
    expect(out.calls).toBe(13);
    expect(out.totalMs).toBe(270);
  });

  it('counts an entry from zero when it has fewer calls than in the snapshot (evicted)', () => {
    const out = diffStatements(new Map([['a', snap('a', 50, 500)]]), [snap('a', 4, 40)], 10);
    expect(out.top[0]).toMatchObject({ calls: 4, totalMs: 40 });
  });

  it('keeps the top `limit` but totals over everything', () => {
    const after = Array.from({ length: 20 }, (_, i) => snap(`q${i}`, 1, i + 1));
    const out = diffStatements(null, after, 15);
    expect(out.top).toHaveLength(15);
    expect(out.top[0]?.query).toBe('q19');
    expect(out.calls).toBe(20);
    expect(out.totalMs).toBe(210);
  });
});

describe('StatementStats', () => {
  const now = () => new Date('2026-03-20T18:00:00.000Z');

  it('resets before the load, diffs per step and reports the top 15 since the reset', async () => {
    let reads = 0;
    const { db, sent } = fakeDb([
      [/pg_stat_statements_reset/, () => [{}]],
      [
        /FROM pg_stat_statements/,
        () => {
          reads += 1;
          // first read: the step's start snapshot; second: the step's end; third: the report.
          if (reads === 1) return [row('a', 2, 4)];
          return Array.from({ length: 18 }, (_, i) => row(`q${i}`, 1, i)).concat([
            row('a', 12, 104),
          ]);
        },
      ],
    ]);
    const stats = new StatementStats(db, 'qc_load', now);
    expect(await stats.reset()).toBe(true);
    const before = await stats.snapshot();
    const step = await stats.since(before, 10);
    expect(step?.top[0]).toMatchObject({ calls: 10, totalMs: 100, meanMs: 10 });
    expect(step?.top).toHaveLength(10);
    const report = await stats.report(15);
    expect(report).toMatchObject({
      available: true,
      resetAt: '2026-03-20T18:00:00.000Z',
      calls: 30,
      totalMs: 104 + 153,
    });
    if (!report.available) throw new Error('expected statements');
    expect(report.top).toHaveLength(15);
    expect(report.top[0]?.totalMs).toBe(104);
    // The stack's database only, without the drain probe's own statements.
    const read = sent.find((s) => /FROM pg_stat_statements/.test(s.text));
    expect(read?.values).toEqual(['qc_load']);
    expect(read?.text).toMatch(/NOT LIKE '%qc-load probe%'/);
    const lines = formatStatements(report, 15);
    expect(lines[0]).toMatch(/since the reset just before the first step.*top 15 by total time/);
    expect(lines).toHaveLength(2 + 15);
  });

  it.each([
    ['42883', 'function pg_stat_statements_reset() does not exist', /not installed/],
    ['55000', 'pg_stat_statements must be loaded via "shared_preload_libraries"', /preload/],
    ['42501', 'permission denied for function pg_stat_statements_reset', /only qc/],
  ])('skips quietly when it is missing (%s) and says so in the report', async (code, text, why) => {
    const { db, sent } = fakeDb([[/pg_stat_statements/, () => pgError(code, text)]]);
    const stats = new StatementStats(db, 'qc_load', now);
    expect(await stats.reset()).toBe(false);
    expect(stats.available).toBe(false);
    expect(await stats.snapshot()).toBeNull();
    expect(await stats.since(null, 10)).toBeNull();
    const report = await stats.report(15);
    expect(report.available).toBe(false);
    expect(report.note).toMatch(why);
    expect(report.note).toMatch(/statement figures skipped/);
    // Asked once; after that nothing more is sent.
    expect(sent).toHaveLength(1);
    expect(formatStatements(report)).toEqual([`db statements: ${report.note}`]);
  });

  it('notices a missing view on the first read when it was never reset', async () => {
    const { db } = fakeDb([
      [/FROM pg_stat_statements/, () => pgError('42P01', 'relation does not exist')],
    ]);
    const stats = new StatementStats(db, 'qc_load', now);
    expect(await stats.snapshot()).toBeNull();
    expect((await stats.report()).available).toBe(false);
  });

  it('throws other errors (a lost connection is not a missing extension)', async () => {
    const { db } = fakeDb([[/pg_stat_statements/, () => new Error('Connection terminated')]]);
    const stats = new StatementStats(db, 'qc_load', now);
    await expect(stats.reset()).rejects.toThrow('Connection terminated');
  });
});
