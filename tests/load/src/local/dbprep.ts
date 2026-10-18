import { performance } from 'node:perf_hooks';
import pg from 'pg';
import type { AnalyzeResult, StatementRow, StatementTotals, StatementsReport } from '../load/prep';

/**
 * Local database steps around the load run (see `../load/prep`): ANALYZE on the tables the seed
 * filled, and pg_stat_statements reset once just before the load steps, with per-step figures
 * taken as differences between snapshots so the run-wide counts survive to the end.
 */

/** What the runner needs from a pg client or pool (a fake in the tests). */
export interface Queryable {
  query<R extends pg.QueryResultRow>(text: string, values?: unknown[]): Promise<{ rows: R[] }>;
}

/**
 * The tables the local setup fills: the bulk push recipients (users, devices), the admin
 * bootstrap and sign-ins (role assignments, invites, codes, sessions, audit), and the seed's venue
 * and session imports, which also generate the occurrences.
 */
export const SEEDED_TABLES = [
  'venues',
  'sessions',
  'occurrences',
  'users',
  'devices',
  'otp_challenges',
  'auth_sessions',
  'role_assignments',
  'coordinator_invites',
  'audit_log',
] as const;

const quoteIdent = (name: string): string => `"${name.replace(/"/g, '""')}"`;
const round = (v: number): number => Math.round(v * 100) / 100;
const message = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/** ANALYZE on those of `tables` that exist in the `public` schema. Never throws. */
export async function analyzeTables(
  db: Queryable,
  tables: readonly string[] = SEEDED_TABLES,
  clock: () => number = () => performance.now(),
): Promise<AnalyzeResult> {
  const started = clock();
  try {
    const found = await db.query<{ name: string }>(
      `SELECT t AS name FROM unnest($1::text[]) WITH ORDINALITY AS u(t, n)
        WHERE to_regclass(format('public.%I', t)) IS NOT NULL ORDER BY n`,
      [[...tables]],
    );
    const present = found.rows.map((r) => r.name);
    const missing = tables.filter((t) => !present.includes(t));
    const absent = missing.length ? `; not in this database: ${missing.join(', ')}` : '';
    if (present.length === 0) {
      return {
        ran: false,
        tables: [],
        missing,
        ms: null,
        note: `ANALYZE skipped: none of the seeded tables exist${absent}`,
      };
    }
    await db.query(`ANALYZE ${present.map((t) => `public.${quoteIdent(t)}`).join(', ')}`);
    const ms = round(clock() - started);
    return {
      ran: true,
      tables: present,
      missing,
      ms,
      note: `ANALYZE on ${present.length} seeded tables in ${ms} ms${absent}`,
    };
  } catch (error) {
    return {
      ran: false,
      tables: [],
      missing: [],
      ms: null,
      note: `ANALYZE failed (${message(error)}); planner statistics may be stale`,
    };
  }
}

/** ANALYZE on the seeded tables of the stack's database, over its own connection. */
export async function analyzeDatabase(databaseUrl: string): Promise<AnalyzeResult> {
  const client = new pg.Client({ connectionString: databaseUrl });
  try {
    await client.connect();
    return await analyzeTables(client);
  } catch (error) {
    return {
      ran: false,
      tables: [],
      missing: [],
      ms: null,
      note: `ANALYZE failed (${message(error)}); planner statistics may be stale`,
    };
  } finally {
    await client.end().catch(() => undefined);
  }
}

/** One pg_stat_statements entry of the stack's database. */
export interface StatementSnap {
  key: string;
  query: string;
  calls: number;
  totalMs: number;
  maxMs: number;
  rows: number;
}

/**
 * The statements' work between a snapshot and `after`, largest total time first. An entry with
 * fewer calls than in the snapshot was evicted or reset in between and counts from zero.
 */
export function diffStatements(
  before: ReadonlyMap<string, StatementSnap> | null,
  after: readonly StatementSnap[],
  limit: number,
): StatementTotals {
  const rows: StatementRow[] = [];
  for (const a of after) {
    const b = before?.get(a.key);
    const base = b && a.calls >= b.calls ? b : null;
    const calls = a.calls - (base?.calls ?? 0);
    if (calls <= 0) continue;
    const totalMs = Math.max(0, a.totalMs - (base?.totalMs ?? 0));
    rows.push({
      query: a.query,
      calls,
      totalMs: round(totalMs),
      meanMs: round(totalMs / calls),
      maxMs: round(a.maxMs),
      rows: Math.max(0, a.rows - (base?.rows ?? 0)),
    });
  }
  rows.sort((x, y) => y.totalMs - x.totalMs);
  return {
    calls: rows.reduce((s, r) => s + r.calls, 0),
    totalMs: round(rows.reduce((s, r) => s + r.totalMs, 0)),
    top: rows.slice(0, limit),
  };
}

/**
 * The SQLSTATEs that mean "no pg_stat_statements here": extension not created in this database
 * (undefined function or view), library not preloaded, or a role that may not read it.
 */
const UNAVAILABLE: Record<string, string> = {
  '42883': 'extension not installed in this database',
  '42P01': 'extension not installed in this database',
  '55000': 'not loaded with shared_preload_libraries',
  '42501': 'this role may not read it (only qc can)',
};

function unavailableReason(error: unknown): string | null {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code: unknown }).code)
      : '';
  return UNAVAILABLE[code] ?? null;
}

/**
 * pg_stat_statements for one database, read through a connection to the database that holds the
 * view (`postgres` locally and on staging). When it is missing, every call answers quietly with
 * nothing and `report()` carries the reason; other errors are thrown.
 */
export class StatementStats {
  private missing: string | null = null;
  private resetAt: string | null = null;

  constructor(
    private readonly db: Queryable,
    private readonly dbName: string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  get available(): boolean {
    return this.missing === null;
  }

  private async attempt<T>(run: () => Promise<T>): Promise<T | null> {
    if (this.missing !== null) return null;
    try {
      return await run();
    } catch (error) {
      const reason = unavailableReason(error);
      if (reason === null) throw error;
      this.missing = `pg_stat_statements not available (${reason}); statement figures skipped`;
      return null;
    }
  }

  /** Starts the counts again; false (and a note for the report) when it is not available. */
  async reset(): Promise<boolean> {
    const done = await this.attempt(async () => {
      await this.db.query('SELECT pg_stat_statements_reset()');
      return true;
    });
    if (done) this.resetAt = this.now().toISOString();
    return done === true;
  }

  async snapshot(): Promise<Map<string, StatementSnap> | null> {
    const rows = await this.read();
    return rows ? new Map(rows.map((r) => [r.key, r])) : null;
  }

  /** The work since `before` (null: since the reset). Null when not available. */
  async since(
    before: ReadonlyMap<string, StatementSnap> | null,
    limit: number,
  ): Promise<StatementTotals | null> {
    const rows = await this.read();
    return rows ? diffStatements(before, rows, limit) : null;
  }

  /** The whole run since the reset, for the report. */
  async report(limit = 15): Promise<StatementsReport> {
    const totals = await this.since(null, limit);
    if (!totals) {
      return { available: false, note: this.missing ?? 'pg_stat_statements not available' };
    }
    return {
      available: true,
      resetAt: this.resetAt,
      note: this.resetAt
        ? 'since the reset just before the first step'
        : 'since the last reset or restart (no reset by this run)',
      ...totals,
    };
  }

  private async read(): Promise<StatementSnap[] | null> {
    return this.attempt(async () => {
      const res = await this.db.query<{
        key: string;
        query: string;
        calls: string;
        total: number;
        max: number;
        rows: string;
      }>(
        `SELECT s.userid::text || ':' || coalesce(s.queryid::text, md5(s.query)) || ':' || s.toplevel::text AS key,
                left(regexp_replace(s.query, '\\s+', ' ', 'g'), 180) AS query, s.calls,
                s.total_exec_time AS total, s.max_exec_time AS max, s.rows
           FROM pg_stat_statements s JOIN pg_database d ON d.oid = s.dbid
          WHERE d.datname = $1 AND s.query NOT LIKE '%qc-load probe%'`,
        [this.dbName],
      );
      return res.rows.map((r) => ({
        key: r.key,
        query: r.query,
        calls: Number(r.calls),
        totalMs: Number(r.total),
        maxMs: Number(r.max),
        rows: Number(r.rows),
      }));
    });
  }
}
