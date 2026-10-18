import { loadavg } from 'node:os';
import pg from 'pg';
import type { DrainProbe, OutboxCounts } from '../load/push';
import type { CpuSampler, CpuStats } from './procstats';

/**
 * Database load for a local run: pg_stat_statements (top statements by total time, reset at the
 * start of each step), pg_stat_database deltas, and pg_stat_activity samples once a second. The
 * statements are normalised by Postgres ($1 placeholders), so no values appear in the report.
 */
/**
 * The earliest (`Math.min`) or latest (`Math.max`) of the non-null timestamps, as ISO text, or null
 * when there are none. The reducer is wrapped so it only ever sees two arguments: passing
 * `Math.min` straight to `reduce` also hands it the index and the array, which gives NaN.
 */
export function pickTime(
  values: readonly (Date | null)[],
  f: (a: number, b: number) => number,
): string | null {
  const ms = values.flatMap((v) => (v ? [v.getTime()] : []));
  const first = ms[0];
  if (first === undefined) return null;
  return new Date(ms.slice(1).reduce((a, b) => f(a, b), first)).toISOString();
}

export interface StatementRow {
  query: string;
  calls: number;
  totalMs: number;
  meanMs: number;
  maxMs: number;
  rows: number;
}

export interface DbStepStats {
  statements: { calls: number; totalMs: number; top: StatementRow[] };
  database: {
    commits: number;
    rollbacks: number;
    blocksRead: number;
    blocksHit: number;
    cacheHitRatio: number;
    tuplesReturned: number;
    tuplesFetched: number;
    tuplesInserted: number;
    tuplesUpdated: number;
    tuplesDeleted: number;
    deadlocks: number;
    tempBytes: number;
  };
  activity: {
    samples: number;
    maxConnections: number;
    maxActive: number;
    meanActive: number;
    maxWaitingOnLock: number;
  };
  /** One-minute load average of the container at the end of the step (shared with everything). */
  loadAverage1m: number;
  cpu: CpuStats | null;
}

interface DbRow {
  xact_commit: string;
  xact_rollback: string;
  blks_read: string;
  blks_hit: string;
  tup_returned: string;
  tup_fetched: string;
  tup_inserted: string;
  tup_updated: string;
  tup_deleted: string;
  deadlocks: string;
  temp_bytes: string;
}

export class DbSampler {
  private readonly pool: pg.Pool;
  private timer: NodeJS.Timeout | undefined;
  private before: DbRow | null = null;
  private samples: { total: number; active: number; lock: number }[] = [];

  /** `serverUrl`: the cluster's maintenance database; `dbName`: the stack's database. */
  constructor(
    serverUrl: string,
    private readonly dbName: string,
    private readonly cpu: CpuSampler | null = null,
  ) {
    this.pool = new pg.Pool({ connectionString: serverUrl, max: 2 });
  }

  private async dbRow(): Promise<DbRow> {
    const res = await this.pool.query<DbRow>(
      `SELECT xact_commit, xact_rollback, blks_read, blks_hit, tup_returned, tup_fetched,
              tup_inserted, tup_updated, tup_deleted, deadlocks, temp_bytes
         FROM pg_stat_database WHERE datname = $1`,
      [this.dbName],
    );
    const row = res.rows[0];
    if (!row) throw new Error(`no pg_stat_database row for ${this.dbName}`);
    return row;
  }

  async start(): Promise<void> {
    await this.pool.query('SELECT pg_stat_statements_reset()');
    this.before = await this.dbRow();
    this.cpu?.begin();
    this.samples = [];
    this.timer = setInterval(() => {
      this.pool
        .query<{ total: string; active: string; lock: string }>(
          `SELECT count(*) AS total,
                  count(*) FILTER (WHERE state = 'active') AS active,
                  count(*) FILTER (WHERE wait_event_type = 'Lock') AS lock
             FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
          [this.dbName],
        )
        .then((r) => {
          const row = r.rows[0];
          if (row) {
            this.samples.push({
              total: Number(row.total),
              active: Number(row.active),
              lock: Number(row.lock),
            });
          }
        })
        .catch(() => undefined);
    }, 1000);
  }

  async stop(): Promise<DbStepStats> {
    if (this.timer) clearInterval(this.timer);
    const cpu = this.cpu?.end() ?? null;
    const after = await this.dbRow();
    const before = this.before ?? after;
    const d = (k: keyof DbRow): number => Number(after[k]) - Number(before[k]);
    const statements = await this.pool.query<{
      query: string;
      calls: string;
      total: number;
      mean: number;
      max: number;
      rows: string;
    }>(
      `SELECT left(regexp_replace(s.query, '\\s+', ' ', 'g'), 180) AS query, s.calls,
              s.total_exec_time AS total, s.mean_exec_time AS mean, s.max_exec_time AS max, s.rows
         FROM pg_stat_statements s JOIN pg_database d ON d.oid = s.dbid
        WHERE d.datname = $1 AND s.query NOT LIKE '%qc-load probe%'
        ORDER BY s.total_exec_time DESC`,
      [this.dbName],
    );
    const all = statements.rows;
    const round = (v: number): number => Math.round(v * 100) / 100;
    const hit = d('blks_hit');
    const read = d('blks_read');
    const active = this.samples.map((s) => s.active);
    return {
      statements: {
        calls: all.reduce((s, r) => s + Number(r.calls), 0),
        totalMs: round(all.reduce((s, r) => s + r.total, 0)),
        top: all.slice(0, 10).map((r) => ({
          query: r.query,
          calls: Number(r.calls),
          totalMs: round(r.total),
          meanMs: round(r.mean),
          maxMs: round(r.max),
          rows: Number(r.rows),
        })),
      },
      database: {
        commits: d('xact_commit'),
        rollbacks: d('xact_rollback'),
        blocksRead: read,
        blocksHit: hit,
        cacheHitRatio: hit + read > 0 ? round(hit / (hit + read)) : 1,
        tuplesReturned: d('tup_returned'),
        tuplesFetched: d('tup_fetched'),
        tuplesInserted: d('tup_inserted'),
        tuplesUpdated: d('tup_updated'),
        tuplesDeleted: d('tup_deleted'),
        deadlocks: d('deadlocks'),
        tempBytes: d('temp_bytes'),
      },
      activity: {
        samples: this.samples.length,
        maxConnections: Math.max(0, ...this.samples.map((s) => s.total)),
        maxActive: Math.max(0, ...active),
        meanActive: active.length ? round(active.reduce((s, v) => s + v, 0) / active.length) : 0,
        maxWaitingOnLock: Math.max(0, ...this.samples.map((s) => s.lock)),
      },
      loadAverage1m: round(loadavg()[0] ?? 0),
      cpu,
    };
  }

  async close(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    await this.pool.end();
  }
}

/**
 * Reads one update's outbox rows straight from the stack's database, and whether the worker has
 * still to write them (`updates.push_pending_since` set; the API leaves the fan-out to the worker).
 */
export function databaseProbe(databaseUrl: string): DrainProbe & { close(): Promise<void> } {
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
  return {
    kind: 'database',
    async counts(updateId: string): Promise<OutboxCounts> {
      // The mark first: the worker writes the rows and clears the mark in one transaction, so once
      // this read sees the mark cleared, the rows query below (a later snapshot) sees every row.
      // The other order could see no rows, then a cleared mark, and call the burst drained.
      const mark = await pool.query<{ pending: boolean; posted: Date }>(
        `/* qc-load probe */ SELECT push_pending_since IS NOT NULL AS pending, created_at AS posted
           FROM updates WHERE id = $1`,
        [updateId],
      );
      const res = await pool.query<{
        status: string;
        n: string;
        lost: string;
        attempts: number;
        written: Date | null;
        first: Date | null;
        last: Date | null;
      }>(
        `/* qc-load probe */ SELECT status, count(*) AS n,
                count(*) FILTER (WHERE last_error_code = 'worker_lost') AS lost,
                max(attempts) AS attempts, min(created_at) AS written,
                min(sent_at) AS first, max(sent_at) AS last
           FROM message_outbox WHERE update_id = $1 GROUP BY status`,
        [updateId],
      );
      const posted = mark.rows[0]?.posted;
      const out: OutboxCounts = {
        queued: 0,
        sending: 0,
        sent: 0,
        other: 0,
        workerLost: 0,
        maxAttempts: 0,
        pushesPending: mark.rows[0]?.pending ? 1 : 0,
        perUpdate: true,
        ...(posted
          ? {
              times: {
                postedAt: posted.toISOString(),
                writtenAt: pickTime(
                  res.rows.map((r) => r.written),
                  Math.min,
                ),
                firstSentAt: pickTime(
                  res.rows.map((r) => r.first),
                  Math.min,
                ),
                lastSentAt: pickTime(
                  res.rows.map((r) => r.last),
                  Math.max,
                ),
              },
            }
          : {}),
      };
      for (const r of res.rows) {
        const n = Number(r.n);
        out.workerLost = (out.workerLost ?? 0) + Number(r.lost);
        out.maxAttempts = Math.max(out.maxAttempts ?? 0, Number(r.attempts));
        if (r.status === 'queued' || r.status === 'sending' || r.status === 'sent')
          out[r.status] += n;
        else out.other += n;
      }
      return out;
    },
    close: () => pool.end(),
  };
}

/**
 * Local only: adds synthetic people with a fake push device straight into the stack's database,
 * so a national push burst can reach a Ramadan-sized audience without signing each one in.
 * Numbers are in a reserved synthetic range (+92 314); tokens say they are fake.
 */
export async function insertBulkPushUsers(databaseUrl: string, count: number): Promise<number> {
  if (count <= 0) return 0;
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const res = await client.query(
      `WITH u AS (
         INSERT INTO users (phone_e164, phone_verified_at, locale)
         SELECT '+92314' || lpad(g::text, 7, '0'), now(), CASE WHEN g % 4 = 0 THEN 'en' ELSE 'ur' END
           FROM generate_series(1, $1::int) AS g
         RETURNING id, locale
       )
       INSERT INTO devices (user_id, platform, provider, token, locale)
       SELECT id, 'android', 'fcm', 'qc-load-fake-bulk-' || id::text, locale FROM u`,
      [count],
    );
    return res.rowCount ?? 0;
  } finally {
    await client.end();
  }
}
