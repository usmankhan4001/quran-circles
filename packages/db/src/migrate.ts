import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The smallest database surface the migration runner needs. `exec` runs a script of several
 * statements with no parameters. `query` runs one statement with optional `$1` parameters.
 * Both must talk to the SAME connection, because each migration runs inside BEGIN/COMMIT.
 */
export interface SqlExecutor {
  exec(sql: string): Promise<void>;
  query<Row = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: Row[] }>;
}

/** Structural match for a single `pg` connection (`pg.Client`, or a client from `pool.connect()`). */
export interface PgClientLike {
  query(text: string, values?: unknown[]): Promise<{ rows: unknown[] }>;
}

/** Structural match for `PGlite`. */
export interface PgliteLike {
  exec(sql: string): Promise<unknown>;
  query<Row>(sql: string, params?: unknown[]): Promise<{ rows: Row[] }>;
}

/** Adapter for node-postgres. Pass ONE connection, not a pool. */
export function pgExecutor(client: PgClientLike): SqlExecutor {
  return {
    async exec(sql) {
      // No values: pg uses the simple query protocol, which allows many statements at once.
      await client.query(sql);
    },
    async query<Row>(sql: string, params?: unknown[]) {
      const result = await client.query(sql, params);
      return { rows: result.rows as Row[] };
    },
  };
}

/** Adapter for PGlite, the in-process Postgres used by tests. */
export function pgliteExecutor(db: PgliteLike): SqlExecutor {
  return {
    async exec(sql) {
      await db.exec(sql);
    },
    async query<Row>(sql: string, params?: unknown[]) {
      const result = await db.query<Row>(sql, params);
      return { rows: result.rows };
    },
  };
}

export const DEFAULT_MIGRATIONS_DIR = fileURLToPath(new URL('../migrations', import.meta.url));

/** Name of the table that records applied migrations. */
export const MIGRATIONS_TABLE = 'schema_migrations';

export interface Migration {
  /** `0001_places`: the shared prefix of the two files. */
  name: string;
  upSql: string;
  downSql: string;
  /** SHA-256 of the up file with normalised line endings. */
  checksum: string;
}

export interface MigrateOptions {
  /** Directory holding the NNNN_name.up.sql / .down.sql pairs. */
  dir?: string;
  /** Progress lines. Never contains data from the database. */
  log?: (line: string) => void;
}

export interface RollbackOptions extends MigrateOptions {
  /** How many of the most recent migrations to undo. Defaults to 1. */
  steps?: number;
  /** Undo everything. Cannot be combined with `steps`. */
  all?: boolean;
}

export interface MigrationStatus {
  name: string;
  applied: boolean;
  appliedAt: Date | null;
}

export class MigrationError extends Error {
  override name = 'MigrationError';
}

const FILE_PATTERN = /^(\d{4})_([a-z0-9_]+)\.(up|down)\.sql$/;
const TRANSACTION_STATEMENT = /^\s*(begin|commit|rollback|start\s+transaction)\b/im;
// Arbitrary constant so two runners against one database take turns.
const ADVISORY_LOCK_KEY = 727_474_001;

const normalise = (sql: string) => sql.replaceAll('\r\n', '\n');
const checksumOf = (sql: string) => createHash('sha256').update(normalise(sql)).digest('hex');

/** Reads and validates the migration files. Throws `MigrationError` on any inconsistency. */
export function listMigrations(dir: string = DEFAULT_MIGRATIONS_DIR): Migration[] {
  const pairs = new Map<string, { up?: string; down?: string }>();
  for (const file of readdirSync(dir).sort()) {
    if (!file.endsWith('.sql')) continue;
    const match = FILE_PATTERN.exec(file);
    if (!match) {
      throw new MigrationError(
        `Migration file "${file}" must be named NNNN_name.up.sql or .down.sql`,
      );
    }
    const [, number, slug, direction] = match as unknown as [string, string, string, 'up' | 'down'];
    const name = `${number}_${slug}`;
    const entry = pairs.get(name) ?? {};
    entry[direction] = readFileSync(join(dir, file), 'utf8');
    pairs.set(name, entry);
  }

  const migrations: Migration[] = [];
  const names = [...pairs.keys()].sort();
  names.forEach((name, index) => {
    const entry = pairs.get(name)!;
    if (entry.up === undefined) throw new MigrationError(`Migration ${name} has no .up.sql file`);
    if (entry.down === undefined)
      throw new MigrationError(`Migration ${name} has no .down.sql file`);
    const expected = String(index + 1).padStart(4, '0');
    if (!name.startsWith(`${expected}_`)) {
      throw new MigrationError(
        `Migration numbers must run ${expected}, ... without gaps or repeats (found ${name})`,
      );
    }
    for (const [label, sql] of [
      ['up', entry.up],
      ['down', entry.down],
    ] as const) {
      if (sql.trim() === '') throw new MigrationError(`Migration ${name} ${label} file is empty`);
      if (TRANSACTION_STATEMENT.test(sql)) {
        throw new MigrationError(
          `Migration ${name} ${label} file must not manage transactions; the runner does`,
        );
      }
    }
    migrations.push({ name, upSql: entry.up, downSql: entry.down, checksum: checksumOf(entry.up) });
  });
  return migrations;
}

interface AppliedRow {
  name: string;
  checksum: string;
  applied_at: Date | string;
}

async function ensureTrackingTable(db: SqlExecutor): Promise<void> {
  await db.exec(
    `CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
       name text PRIMARY KEY,
       checksum text NOT NULL,
       applied_at timestamptz NOT NULL DEFAULT now()
     )`,
  );
}

/**
 * Reads what is applied and checks it against the files: every applied migration must have a
 * file with an unchanged checksum, and the applied set must be a prefix of the file list.
 */
async function loadApplied(db: SqlExecutor, files: Migration[]): Promise<AppliedRow[]> {
  const { rows } = await db.query<AppliedRow>(
    `SELECT name, checksum, applied_at FROM ${MIGRATIONS_TABLE} ORDER BY name`,
  );
  rows.forEach((row, index) => {
    const file = files.find((m) => m.name === row.name);
    if (!file) {
      throw new MigrationError(
        `Applied migration ${row.name} has no file. Was it deleted or renamed?`,
      );
    }
    if (file.checksum !== row.checksum) {
      throw new MigrationError(
        `Migration ${row.name} changed after it was applied. Never edit an applied migration; add a new one.`,
      );
    }
    if (files[index]?.name !== row.name) {
      throw new MigrationError(
        `Applied migrations are not a continuous run from ${files[0]?.name ?? 'the first'}`,
      );
    }
  });
  return rows;
}

async function withLock<T>(db: SqlExecutor, fn: () => Promise<T>): Promise<T> {
  await db.query('SELECT pg_advisory_lock($1)', [ADVISORY_LOCK_KEY]);
  try {
    return await fn();
  } finally {
    await db.query('SELECT pg_advisory_unlock($1)', [ADVISORY_LOCK_KEY]);
  }
}

async function inTransaction(
  db: SqlExecutor,
  name: string,
  work: () => Promise<void>,
): Promise<void> {
  await db.exec('BEGIN');
  try {
    await work();
    await db.exec('COMMIT');
  } catch (error) {
    try {
      await db.exec('ROLLBACK');
    } catch {
      // The original error is the one worth reporting.
    }
    const reason = error instanceof Error ? error.message : String(error);
    throw new MigrationError(`Migration ${name} failed and was rolled back: ${reason}`);
  }
}

/** Applies every pending migration, oldest first. Returns the names it applied. */
export async function migrateUp(db: SqlExecutor, opts: MigrateOptions = {}): Promise<string[]> {
  const files = listMigrations(opts.dir);
  const log = opts.log ?? (() => {});
  return withLock(db, async () => {
    await ensureTrackingTable(db);
    const applied = await loadApplied(db, files);
    const pending = files.slice(applied.length);
    for (const migration of pending) {
      await inTransaction(db, migration.name, async () => {
        await db.exec(migration.upSql);
        await db.query(`INSERT INTO ${MIGRATIONS_TABLE} (name, checksum) VALUES ($1, $2)`, [
          migration.name,
          migration.checksum,
        ]);
      });
      log(`applied ${migration.name}`);
    }
    if (pending.length === 0) log('already up to date');
    return pending.map((m) => m.name);
  });
}

/**
 * Undoes the most recent migrations, newest first. One by default; `{ steps: n }` for more,
 * `{ all: true }` for everything. Returns the names it undid.
 */
export async function migrateDown(db: SqlExecutor, opts: RollbackOptions = {}): Promise<string[]> {
  if (opts.all && opts.steps !== undefined) {
    throw new MigrationError('Use either steps or all, not both');
  }
  if (opts.steps !== undefined && (!Number.isInteger(opts.steps) || opts.steps < 1)) {
    throw new MigrationError('steps must be a whole number of at least 1');
  }
  const files = listMigrations(opts.dir);
  const log = opts.log ?? (() => {});
  return withLock(db, async () => {
    await ensureTrackingTable(db);
    const applied = await loadApplied(db, files);
    const count = opts.all ? applied.length : Math.min(opts.steps ?? 1, applied.length);
    const targets = applied.slice(applied.length - count).reverse();
    for (const row of targets) {
      const migration = files.find((m) => m.name === row.name)!;
      await inTransaction(db, migration.name, async () => {
        await db.exec(migration.downSql);
        await db.query(`DELETE FROM ${MIGRATIONS_TABLE} WHERE name = $1`, [migration.name]);
      });
      log(`rolled back ${migration.name}`);
    }
    if (targets.length === 0) log('nothing to roll back');
    return targets.map((t) => t.name);
  });
}

/** Every migration file with whether, and when, it was applied. */
export async function migrationStatus(
  db: SqlExecutor,
  opts: MigrateOptions = {},
): Promise<MigrationStatus[]> {
  const files = listMigrations(opts.dir);
  return withLock(db, async () => {
    await ensureTrackingTable(db);
    const applied = await loadApplied(db, files);
    return files.map((file) => {
      const row = applied.find((a) => a.name === file.name);
      return {
        name: file.name,
        applied: row !== undefined,
        appliedAt: row ? new Date(row.applied_at) : null,
      };
    });
  });
}
