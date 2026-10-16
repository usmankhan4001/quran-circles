import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MIGRATIONS_DIR,
  MIGRATIONS_TABLE,
  MigrationError,
  listMigrations,
  migrateDown,
  migrateUp,
  migrationStatus,
} from './migrate';
import { parseRollbackArgs } from './cli/args';
import { createEmptyDb, resetDb } from './test/helpers';

// One PGlite for the whole file: booting costs seconds, resetting costs milliseconds.
const shared = createEmptyDb();
/** An empty database: the shared instance with its public schema wiped. */
const freshDb = async () => {
  await resetDb(shared);
  return shared;
};

const publicTables = async (db: ReturnType<typeof createEmptyDb>) => {
  const { rows } = await db.exec.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name`,
  );
  return rows.map((r) => r.table_name);
};

const publicIndexes = async (db: ReturnType<typeof createEmptyDb>) => {
  const { rows } = await db.exec.query<{ indexname: string }>(
    `SELECT indexname FROM pg_indexes WHERE schemaname = 'public' ORDER BY indexname`,
  );
  return rows.map((r) => r.indexname);
};

/** Writes a migrations directory from `{ "0001_a.up.sql": "...", ... }`. */
function writeMigrations(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'qc-migrations-'));
  for (const [name, sql] of Object.entries(files)) writeFileSync(join(dir, name), sql);
  return dir;
}

describe('migration files', () => {
  it('ships a matching up and down for every numbered migration', () => {
    const migrations = listMigrations();
    expect(migrations.length).toBeGreaterThan(0);
    const files = readdirSync(DEFAULT_MIGRATIONS_DIR).filter((f) => f.endsWith('.sql'));
    expect(files).toHaveLength(migrations.length * 2);
    migrations.forEach((m, i) => {
      expect(m.name.startsWith(String(i + 1).padStart(4, '0'))).toBe(true);
      expect(m.checksum).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  it('rejects a missing down file', () => {
    const dir = writeMigrations({ '0001_a.up.sql': 'SELECT 1;' });
    expect(() => listMigrations(dir)).toThrow(/no \.down\.sql/);
  });

  it('rejects a missing up file', () => {
    const dir = writeMigrations({ '0001_a.down.sql': 'SELECT 1;' });
    expect(() => listMigrations(dir)).toThrow(/no \.up\.sql/);
  });

  it('rejects gaps and repeated numbers', () => {
    const gap = writeMigrations({
      '0001_a.up.sql': 'SELECT 1;',
      '0001_a.down.sql': 'SELECT 1;',
      '0003_c.up.sql': 'SELECT 1;',
      '0003_c.down.sql': 'SELECT 1;',
    });
    expect(() => listMigrations(gap)).toThrow(/without gaps/);
    const repeat = writeMigrations({
      '0001_a.up.sql': 'SELECT 1;',
      '0001_a.down.sql': 'SELECT 1;',
      '0001_b.up.sql': 'SELECT 1;',
      '0001_b.down.sql': 'SELECT 1;',
    });
    expect(() => listMigrations(repeat)).toThrow(/without gaps/);
  });

  it('rejects badly named and empty files', () => {
    expect(() => listMigrations(writeMigrations({ 'init.sql': 'SELECT 1;' }))).toThrow(/must be named/);
    expect(() =>
      listMigrations(writeMigrations({ '0001_a.up.sql': '  \n', '0001_a.down.sql': 'SELECT 1;' })),
    ).toThrow(/empty/);
  });

  it('rejects files that manage their own transactions', () => {
    const dir = writeMigrations({
      '0001_a.up.sql': 'BEGIN;\nCREATE TABLE a (id int);\nCOMMIT;',
      '0001_a.down.sql': 'DROP TABLE a;',
    });
    expect(() => listMigrations(dir)).toThrow(/must not manage transactions/);
  });

  it('ignores files that are not SQL', () => {
    const dir = writeMigrations({
      '0001_a.up.sql': 'SELECT 1;',
      '0001_a.down.sql': 'SELECT 1;',
      'README.txt': 'notes',
    });
    expect(listMigrations(dir).map((m) => m.name)).toEqual(['0001_a']);
  });

  it('gives the same checksum for LF and CRLF files', () => {
    const lf = writeMigrations({ '0001_a.up.sql': 'SELECT 1;\nSELECT 2;\n', '0001_a.down.sql': 'SELECT 1;' });
    const crlf = writeMigrations({ '0001_a.up.sql': 'SELECT 1;\r\nSELECT 2;\r\n', '0001_a.down.sql': 'SELECT 1;' });
    expect(listMigrations(lf)[0]?.checksum).toBe(listMigrations(crlf)[0]?.checksum);
  });
});

describe('migrate up and down', () => {
  it('applies everything, undoes everything, and applies again cleanly', async () => {
    const test = await freshDb();
    const names = listMigrations().map((m) => m.name);

    expect(await migrateUp(test.exec)).toEqual(names);
    const tablesAfterFirstUp = await publicTables(test);
    const indexesAfterFirstUp = await publicIndexes(test);
    expect(tablesAfterFirstUp).toContain(MIGRATIONS_TABLE);
    expect(tablesAfterFirstUp.length).toBeGreaterThan(30);

    // A second run has nothing to do.
    expect(await migrateUp(test.exec)).toEqual([]);

    expect(await migrateDown(test.exec, { all: true })).toEqual([...names].reverse());
    expect(await publicTables(test)).toEqual([MIGRATIONS_TABLE]);
    // Only the tracking table's own primary key index may remain.
    expect(await publicIndexes(test)).toEqual([`${MIGRATIONS_TABLE}_pkey`]);

    expect(await migrateUp(test.exec)).toEqual(names);
    expect(await publicTables(test)).toEqual(tablesAfterFirstUp);
    expect(await publicIndexes(test)).toEqual(indexesAfterFirstUp);
  });

  it('leaves no functions, types or sequences behind after a full rollback', async () => {
    const test = await freshDb();
    await migrateUp(test.exec);
    await migrateDown(test.exec, { all: true });
    const sequences = await test.exec.query(
      `SELECT sequencename FROM pg_sequences WHERE schemaname = 'public'`,
    );
    const types = await test.exec.query(
      `SELECT t.typname FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public' AND t.typtype IN ('e', 'd', 'c')
          AND t.typname <> '${MIGRATIONS_TABLE}'`,
    );
    const functions = await test.exec.query(
      `SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'`,
    );
    expect(sequences.rows).toEqual([]);
    expect(types.rows).toEqual([]);
    expect(functions.rows).toEqual([]);
  });

  it('undoes each migration on its own, restoring the shape before it', async () => {
    const test = await freshDb();
    const names = listMigrations().map((m) => m.name);
    // shapes[i] is the table list with the first i migrations applied.
    const shapes: string[][] = [[MIGRATIONS_TABLE]];
    for (let i = 1; i <= names.length; i++) {
      await migrateUp(test.exec, { dir: prefixDir(i) });
      shapes.push(await publicTables(test));
    }
    for (let i = names.length; i >= 1; i--) {
      expect(await migrateDown(test.exec)).toEqual([names[i - 1]]);
      expect(await publicTables(test)).toEqual(shapes[i - 1]);
    }
  });

  it('rolls back one step by default and honours steps', async () => {
    const test = await freshDb();
    const names = listMigrations().map((m) => m.name);
    await migrateUp(test.exec);
    expect(await migrateDown(test.exec)).toEqual([names.at(-1)]);
    expect(await migrateDown(test.exec, { steps: 2 })).toEqual(names.slice(-3, -1).reverse());
    expect((await migrationStatus(test.exec)).filter((s) => s.applied)).toHaveLength(names.length - 3);
    expect(await migrateDown(test.exec, { steps: 99 })).toHaveLength(names.length - 3);
    expect(await migrateDown(test.exec)).toEqual([]);
  });

  it('refuses invalid rollback options', async () => {
    const test = await freshDb();
    await expect(migrateDown(test.exec, { all: true, steps: 1 })).rejects.toThrow(/either steps or all/);
    await expect(migrateDown(test.exec, { steps: 0 })).rejects.toThrow(/at least 1/);
    await expect(migrateDown(test.exec, { steps: 1.5 })).rejects.toThrow(/whole number/);
  });

  it('reports status with applied times', async () => {
    const test = await freshDb();
    expect((await migrationStatus(test.exec)).every((s) => !s.applied)).toBe(true);
    await migrateUp(test.exec);
    const status = await migrationStatus(test.exec);
    expect(status.every((s) => s.applied && s.appliedAt instanceof Date)).toBe(true);
  });

  it('records name, checksum and time for each applied migration', async () => {
    const test = await freshDb();
    await migrateUp(test.exec);
    const { rows } = await test.exec.query<{ name: string; checksum: string; applied_at: Date }>(
      `SELECT name, checksum, applied_at FROM ${MIGRATIONS_TABLE} ORDER BY name`,
    );
    const files = listMigrations();
    expect(rows.map((r) => r.name)).toEqual(files.map((f) => f.name));
    expect(rows.map((r) => r.checksum)).toEqual(files.map((f) => f.checksum));
    expect(rows.every((r) => r.applied_at instanceof Date)).toBe(true);
  });
});

describe('migration safety', () => {
  const twoTables = {
    '0001_a.up.sql': 'CREATE TABLE a (id int PRIMARY KEY);',
    '0001_a.down.sql': 'DROP TABLE a;',
    '0002_b.up.sql': 'CREATE TABLE b (id int PRIMARY KEY);',
    '0002_b.down.sql': 'DROP TABLE b;',
  };

  it('refuses to run when an applied migration file changed', async () => {
    const dir = writeMigrations(twoTables);
    const test = await freshDb();
    await migrateUp(test.exec, { dir });
    writeFileSync(join(dir, '0001_a.up.sql'), 'CREATE TABLE a (id int PRIMARY KEY, extra int);');
    await expect(migrateUp(test.exec, { dir })).rejects.toThrow(/changed after it was applied/);
    await expect(migrateDown(test.exec, { dir })).rejects.toThrow(/changed after it was applied/);
    await expect(migrationStatus(test.exec, { dir })).rejects.toThrow(MigrationError);
    // Nothing was touched.
    expect(await publicTables(test)).toEqual(['a', 'b', MIGRATIONS_TABLE]);
  });

  it('refuses to run when an applied migration lost its file', async () => {
    const dir = writeMigrations(twoTables);
    const test = await freshDb();
    await migrateUp(test.exec, { dir });
    const smaller = writeMigrations({
      '0001_a.up.sql': twoTables['0001_a.up.sql'],
      '0001_a.down.sql': twoTables['0001_a.down.sql'],
    });
    await expect(migrateUp(test.exec, { dir: smaller })).rejects.toThrow(/has no file/);
  });

  it('applies new migrations added after earlier ones were applied', async () => {
    const dir = writeMigrations({
      '0001_a.up.sql': twoTables['0001_a.up.sql'],
      '0001_a.down.sql': twoTables['0001_a.down.sql'],
    });
    const test = await freshDb();
    await migrateUp(test.exec, { dir });
    writeFileSync(join(dir, '0002_b.up.sql'), twoTables['0002_b.up.sql']);
    writeFileSync(join(dir, '0002_b.down.sql'), twoTables['0002_b.down.sql']);
    expect(await migrateUp(test.exec, { dir })).toEqual(['0002_b']);
  });

  it('rolls a failing migration back completely and records nothing for it', async () => {
    const dir = writeMigrations({
      ...twoTables,
      '0002_b.up.sql': 'CREATE TABLE b (id int PRIMARY KEY);\nCREATE TABLE c (id int REFERENCES missing(id));',
    });
    const test = await freshDb();
    await expect(migrateUp(test.exec, { dir })).rejects.toThrow(/0002_b failed and was rolled back/);
    expect(await publicTables(test)).toEqual(['a', MIGRATIONS_TABLE]);
    const applied = await test.exec.query(`SELECT name FROM ${MIGRATIONS_TABLE}`);
    expect(applied.rows).toEqual([{ name: '0001_a' }]);
    // The connection is usable afterwards: fix the file and carry on.
    writeFileSync(join(dir, '0002_b.up.sql'), twoTables['0002_b.up.sql']);
    expect(await migrateUp(test.exec, { dir })).toEqual(['0002_b']);
  });

  it('keeps the migration applied when its down fails', async () => {
    const dir = writeMigrations({ ...twoTables, '0002_b.down.sql': 'DROP TABLE does_not_exist;' });
    const test = await freshDb();
    await migrateUp(test.exec, { dir });
    await expect(migrateDown(test.exec, { dir })).rejects.toThrow(/0002_b failed and was rolled back/);
    expect((await migrationStatus(test.exec, { dir })).map((s) => s.applied)).toEqual([true, true]);
    expect(await publicTables(test)).toEqual(['a', 'b', MIGRATIONS_TABLE]);
  });

  it('refuses applied migrations that are not a continuous run', async () => {
    const dir = writeMigrations(twoTables);
    const test = await freshDb();
    await migrateUp(test.exec, { dir });
    await test.exec.exec(`DELETE FROM ${MIGRATIONS_TABLE} WHERE name = '0001_a'`);
    await expect(migrateUp(test.exec, { dir })).rejects.toThrow(/not a continuous run/);
  });
});

describe('rollback arguments', () => {
  it('defaults to one migration', () => {
    expect(parseRollbackArgs([])).toEqual({ all: false });
  });
  it('reads --all', () => {
    expect(parseRollbackArgs(['--all'])).toEqual({ all: true });
  });
  it('reads --steps in both spellings and -n', () => {
    expect(parseRollbackArgs(['--steps', '3'])).toEqual({ all: false, steps: 3 });
    expect(parseRollbackArgs(['--steps=2'])).toEqual({ all: false, steps: 2 });
    expect(parseRollbackArgs(['-n', '4'])).toEqual({ all: false, steps: 4 });
  });
  it('ignores a bare -- from the package manager', () => {
    expect(parseRollbackArgs(['--', '--all'])).toEqual({ all: true });
  });
  it('rejects bad input', () => {
    expect(() => parseRollbackArgs(['--steps'])).toThrow(/whole number/);
    expect(() => parseRollbackArgs(['--steps', '0'])).toThrow(/whole number/);
    expect(() => parseRollbackArgs(['--steps=abc'])).toThrow(/whole number/);
    expect(() => parseRollbackArgs(['--all', '--steps', '2'])).toThrow(/not both/);
    expect(() => parseRollbackArgs(['--force'])).toThrow(/Unknown argument/);
  });
});

/** A temp directory holding only the first `count` real migrations, so they can be applied one by one. */
function prefixDir(count: number): string {
  const dir = mkdtempSync(join(tmpdir(), 'qc-prefix-'));
  mkdirSync(dir, { recursive: true });
  for (const migration of listMigrations().slice(0, count)) {
    for (const direction of ['up', 'down'] as const) {
      const file = `${migration.name}.${direction}.sql`;
      writeFileSync(join(dir, file), readFileSync(join(DEFAULT_MIGRATIONS_DIR, file)));
    }
  }
  return dir;
}
