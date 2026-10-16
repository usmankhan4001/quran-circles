import { getTableName, is } from 'drizzle-orm';
import { PgTable, getTableConfig } from 'drizzle-orm/pg-core';
import { beforeAll, describe, expect, it } from 'vitest';
import * as schema from './schema/index';
import { MIGRATIONS_TABLE } from './migrate';
import { createMigratedDb, type TestDb } from './test/helpers';

const tables = Object.values(schema).filter((value): value is PgTable => is(value, PgTable));

let test: TestDb;
beforeAll(async () => {
  test = await createMigratedDb();
});

const sorted = (values: Iterable<string>) => [...values].sort();

/** Drizzle's SQL type names mapped to what information_schema reports. */
function expectedDataType(sqlType: string): string {
  const aliases: Record<string, string> = {
    time: 'time without time zone',
    bigserial: 'bigint',
    serial: 'integer',
  };
  if (sqlType.endsWith('[]')) return `${expectedDataType(sqlType.slice(0, -2))}[]`;
  return aliases[sqlType] ?? sqlType;
}

/** information_schema reports arrays as ARRAY plus an element type in udt_name. */
function actualDataType(dataType: string, udtName: string): string {
  if (dataType !== 'ARRAY') return dataType;
  const elements: Record<string, string> = {
    _int2: 'smallint',
    _int4: 'integer',
    _int8: 'bigint',
    _text: 'text',
    _uuid: 'uuid',
    _bool: 'boolean',
  };
  const element = elements[udtName];
  if (!element) throw new Error(`Unmapped array type ${udtName}`);
  return `${element}[]`;
}

describe('schema parity: Drizzle definition against the migrated database', () => {
  it('has the same tables on both sides', async () => {
    const { rows } = await test.exec.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name <> $1`,
      [MIGRATIONS_TABLE],
    );
    expect(sorted(rows.map((r) => r.table_name))).toEqual(sorted(tables.map(getTableName)));
    expect(tables.length).toBeGreaterThanOrEqual(36);
  });

  it('has the same columns, nullability, types and default presence in every table', async () => {
    const { rows } = await test.exec.query<{
      table_name: string;
      column_name: string;
      is_nullable: 'YES' | 'NO';
      data_type: string;
      udt_name: string;
      column_default: string | null;
    }>(
      `SELECT table_name, column_name, is_nullable, data_type, udt_name, column_default
         FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name <> $1`,
      [MIGRATIONS_TABLE],
    );
    const actual = new Map(
      rows.map((r) => [
        `${r.table_name}.${r.column_name}`,
        {
          notNull: r.is_nullable === 'NO',
          type: actualDataType(r.data_type, r.udt_name),
          hasDefault: r.column_default !== null,
        },
      ]),
    );

    const expected = new Map<string, { notNull: boolean; type: string; hasDefault: boolean }>();
    for (const table of tables) {
      const { name, columns } = getTableConfig(table);
      for (const column of columns) {
        expected.set(`${name}.${column.name}`, {
          notNull: column.notNull,
          type: expectedDataType(column.getSQLType()),
          hasDefault: column.hasDefault,
        });
      }
    }

    // No extra and no missing columns, then every column matches in detail.
    expect(sorted(actual.keys())).toEqual(sorted(expected.keys()));
    for (const [key, want] of expected) {
      expect({ column: key, ...actual.get(key) }).toEqual({ column: key, ...want });
    }
  });

  it('uses timestamptz for every instant and never a bare timestamp', () => {
    for (const table of tables) {
      for (const column of getTableConfig(table).columns) {
        expect(column.getSQLType(), `${getTableName(table)}.${column.name}`).not.toBe('timestamp');
        expect(column.getSQLType(), `${getTableName(table)}.${column.name}`).not.toMatch(
          /^timestamp(?!.*with time zone)/,
        );
      }
    }
  });

  it('uses uuid primary keys with a database default, except the documented ones', () => {
    const exceptions = new Map([
      ['profiles', 'user_id'],
      ['reading_positions', 'user_id'],
      ['settings', 'key'],
      ['update_reads', 'user_id,update_id'],
      ['audit_log', 'id'],
    ]);
    for (const table of tables) {
      const name = getTableName(table);
      const config = getTableConfig(table);
      const keyColumns = [
        ...config.columns.filter((c) => c.primary).map((c) => c.name),
        ...config.primaryKeys.flatMap((pk) => pk.columns.map((c) => c.name)),
      ];
      const exception = exceptions.get(name);
      if (exception) {
        expect(keyColumns.join(','), name).toBe(exception);
        continue;
      }
      const id = config.columns.find((c) => c.name === 'id');
      expect(keyColumns, name).toEqual(['id']);
      expect(id?.getSQLType(), name).toBe('uuid');
      expect(id?.hasDefault, name).toBe(true);
    }
  });

  it('has the same constraints and indexes, by name, on every table', async () => {
    const constraints = await test.exec.query<{ tbl: string; conname: string }>(
      `SELECT conrelid::regclass::text AS tbl, conname
         FROM pg_constraint
        WHERE connamespace = 'public'::regnamespace AND contype IN ('p', 'u', 'f', 'c')`,
    );
    const indexes = await test.exec.query<{ tablename: string; indexname: string }>(
      `SELECT tablename, indexname FROM pg_indexes WHERE schemaname = 'public'`,
    );
    const actual = new Map<string, Set<string>>();
    const add = (table: string, name: string) => {
      if (!actual.has(table)) actual.set(table, new Set());
      actual.get(table)!.add(name);
    };
    for (const r of constraints.rows) add(r.tbl, r.conname);
    // Constraint-backed indexes share the constraint's name, so a set takes care of the overlap.
    for (const r of indexes.rows) add(r.tablename, r.indexname);
    actual.delete(MIGRATIONS_TABLE);

    const expected = new Map<string, Set<string>>();
    for (const table of tables) {
      const config = getTableConfig(table);
      const names = new Set<string>();
      if (config.columns.some((c) => c.primary)) names.add(`${config.name}_pkey`);
      for (const pk of config.primaryKeys) names.add(pk.getName());
      for (const column of config.columns) if (column.isUnique) names.add(column.uniqueName!);
      for (const unique of config.uniqueConstraints) names.add(unique.name ?? unique.getName());
      for (const index of config.indexes) names.add(index.config.name!);
      for (const check of config.checks) names.add(check.name);
      for (const fk of config.foreignKeys) names.add(fk.getName());
      expected.set(config.name, names);
    }

    expect(sorted(actual.keys())).toEqual(sorted(expected.keys()));
    for (const [table, names] of expected) {
      expect({ table, names: sorted(actual.get(table) ?? []) }).toEqual({ table, names: sorted(names) });
    }
  });

  it('keeps every constraint and index name within the 63-character identifier limit', () => {
    for (const table of tables) {
      const config = getTableConfig(table);
      const names = [
        ...config.indexes.map((i) => i.config.name!),
        ...config.checks.map((c) => c.name),
        ...config.foreignKeys.map((f) => f.getName()),
        ...config.uniqueConstraints.map((u) => u.name ?? u.getName()),
      ];
      for (const name of names) expect(name.length, name).toBeLessThanOrEqual(63);
    }
  });

  it('has the same foreign keys, targets and delete actions', async () => {
    const { rows } = await test.exec.query<{
      conname: string;
      tbl: string;
      target: string;
      confdeltype: string;
    }>(
      `SELECT conname, conrelid::regclass::text AS tbl, confrelid::regclass::text AS target, confdeltype
         FROM pg_constraint
        WHERE connamespace = 'public'::regnamespace AND contype = 'f'`,
    );
    const actions: Record<string, string> = { a: 'no action', c: 'cascade', n: 'set null', r: 'restrict' };
    const actual = rows.map((r) => ({
      name: r.conname,
      table: r.tbl,
      target: r.target,
      onDelete: actions[r.confdeltype],
    }));
    const expected = tables.flatMap((table) =>
      getTableConfig(table).foreignKeys.map((fk) => ({
        name: fk.getName(),
        table: getTableName(table),
        target: getTableName(fk.reference().foreignTable),
        onDelete: fk.onDelete ?? 'no action',
      })),
    );
    const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);
    expect(actual.sort(byName)).toEqual(expected.sort(byName));
    expect(actual.length).toBeGreaterThan(50);
  });

  it('exports every table through the schema namespace and the package index', async () => {
    const index = await import('./index');
    const exported = Object.values(index.schema).filter((v): v is PgTable => is(v, PgTable));
    expect(sorted(exported.map(getTableName))).toEqual(sorted(tables.map(getTableName)));
    for (const table of tables) {
      expect(Object.values(index).includes(table), getTableName(table)).toBe(true);
    }
  });
});
