import { eq, inArray, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import type pg from 'pg';
import { describe, expect, it } from 'vitest';
import { schema } from '@qc/db';
import {
  STATEMENT_NAME_LIMITS,
  StatementNames,
  isNamable,
  isStaleStatementError,
  longestParamList,
  nameStatements,
  type StatementNameLimits,
} from '../db';

/**
 * Named prepared statements on the API's pool (change request `2026-10-18-api-named-statements`).
 * CI has no Postgres server, so a fake client stands in for node-postgres and the backend: it
 * keeps the statements each name was prepared with and, after a "migration" that changes a
 * returned column's type, refuses a statement prepared before it the way Postgres does ("cached
 * plan must not change result type", SQLSTATE 0A000) until it is prepared again under a new name.
 */
interface Sent {
  name: string | undefined;
  text: string;
  values: unknown[];
}

class FakePg {
  readonly sent: Sent[] = [];
  private readonly prepared = new Map<string, { text: string; version: number }>();
  private resultVersion = 0;
  /** An error the next statement fails with (a unique violation, for example). */
  failNext: Error | null = null;

  /** A migration that changes the type of a column the statements return. */
  changeResultType(): void {
    this.resultVersion += 1;
  }

  get preparedCount(): number {
    return this.prepared.size;
  }

  query(config: unknown, values?: unknown, callback?: unknown): unknown {
    const done = typeof values === 'function' ? values : callback;
    const params = Array.isArray(values) ? values : [];
    const result = this.run(config, params);
    if (typeof done === 'function') {
      result.then(
        (r) => done(null, r),
        (e: unknown) => done(e),
      );
      return undefined;
    }
    return result;
  }

  private async run(config: unknown, values: unknown[]): Promise<{ rows: unknown[] }> {
    await Promise.resolve();
    const { text, name } =
      typeof config === 'string'
        ? { text: config, name: undefined }
        : (config as { text: string; name?: string });
    this.sent.push({ name, text, values });
    const fail = this.failNext;
    this.failNext = null;
    if (fail) throw fail;
    if (name !== undefined) {
      const known = this.prepared.get(name);
      if (!known) this.prepared.set(name, { text, version: this.resultVersion });
      else if (known.text !== text)
        throw new Error(`Prepared statements must be unique - '${name}'`);
      else if (known.version !== this.resultVersion) {
        throw Object.assign(new Error('cached plan must not change result type'), {
          code: '0A000',
        });
      }
    }
    return { rows: [] };
  }
}

const SELECT = 'select "id", "name" from "venues" where "venues"."id" = $1';
const params = (n: number): string[] => Array.from({ length: n }, (_, i) => `v${i}`);
const inList = (n: number): string =>
  `select "id" from "sessions" where "sessions"."id" in (${params(n)
    .map((_, i) => `$${i + 1}`)
    .join(', ')})`;

async function send(client: FakePg, text: string, values: unknown[] = ['x']): Promise<void> {
  await (client.query({ text, rowMode: 'array' }, values) as Promise<unknown>);
}

const last = (client: FakePg): Sent => {
  const sent = client.sent.at(-1);
  if (!sent) throw new Error('nothing sent');
  return sent;
};

describe('which statements may be named', () => {
  const limits = STATEMENT_NAME_LIMITS;

  it('measures the longest list of parameters', () => {
    expect(longestParamList(SELECT)).toBe(0);
    expect(longestParamList(inList(1))).toBe(1);
    expect(longestParamList(`${inList(3)} and "venue_id" in ($4, $5)`)).toBe(3);
    expect(longestParamList('select coalesce($1, $2)')).toBe(0);
  });

  it('names statements whose text does not grow with the request', () => {
    expect(isNamable(SELECT, 1, limits)).toBe(true);
    expect(isNamable(inList(1), 1, limits)).toBe(true);
    expect(isNamable(inList(limits.maxListLength), limits.maxListLength, limits)).toBe(true);
    expect(isNamable('insert into "audit_log" ("id", "action") values ($1, $2)', 2, limits)).toBe(
      true,
    );
  });

  it('leaves out lists longer than a page, long parameter lists, multi-row inserts and statements without parameters', () => {
    const long = limits.maxListLength + 1;
    expect(isNamable(inList(long), long, limits)).toBe(false);
    expect(isNamable(SELECT, limits.maxParams + 1, limits)).toBe(false);
    expect(
      isNamable('insert into "devices" ("id", "token") values ($1, $2), ($3, $4)', 4, limits),
    ).toBe(false);
    expect(
      isNamable(
        'insert into "devices" ("id", "at") values ($1, default), (default, $2)',
        2,
        limits,
      ),
    ).toBe(false);
    expect(isNamable('begin', 0, limits)).toBe(false);
    expect(isNamable('commit', 0, limits)).toBe(false);
  });
});

describe('StatementNames', () => {
  const limits: StatementNameLimits = {
    maxParams: 64,
    maxListLength: 20,
    minUses: 3,
    maxPerConnection: 4,
  };

  it('names a statement after it ran unnamed minUses - 1 times, then keeps the name', () => {
    const names = new StatementNames(limits);
    expect(names.nameFor(SELECT, 1)).toBeUndefined();
    expect(names.nameFor(SELECT, 1)).toBeUndefined();
    const name = names.nameFor(SELECT, 1);
    expect(name).toMatch(/^qc_[0-9a-f]{24}$/);
    for (let i = 0; i < 10; i++) expect(names.nameFor(SELECT, 1)).toBe(name);
    expect(names.size).toBe(1);
  });

  it('keeps at most maxPerConnection names; the rest run unnamed, the named keep their names', () => {
    const names = new StatementNames(limits);
    const texts = Array.from({ length: 10 }, (_, i) => `${SELECT} and "n" = ${i}`);
    const named = new Map<string, string | undefined>();
    for (let round = 0; round < 5; round++) {
      for (const text of texts) named.set(text, names.nameFor(text, 1));
    }
    const withName = [...named.values()].filter((n) => n !== undefined);
    expect(withName).toHaveLength(limits.maxPerConnection);
    expect(names.size).toBe(limits.maxPerConnection);
    for (const text of texts.slice(0, limits.maxPerConnection)) {
      expect(names.nameFor(text, 1)).toBe(named.get(text));
    }
    for (const text of texts.slice(limits.maxPerConnection)) {
      expect(names.nameFor(text, 1)).toBeUndefined();
    }
  });

  it('never names texts that differ on every call, however often they come', () => {
    const names = new StatementNames(limits);
    for (let i = 0; i < 5_000; i++) {
      expect(names.nameFor(`${SELECT} and "k" = '${i}'`, 1)).toBeUndefined();
    }
    expect(names.size).toBe(0);
    // The texts that never came back did not crowd out a statement that does.
    names.nameFor(SELECT, 1);
    names.nameFor(SELECT, 1);
    expect(names.nameFor(SELECT, 1)).toMatch(/^qc_/);
  });

  it('prepares a stale statement again under a new name, counted against the bound', () => {
    const names = new StatementNames(limits);
    for (let i = 0; i < 3; i++) names.nameFor(SELECT, 1);
    const first = names.nameFor(SELECT, 1);
    if (!first) throw new Error('not named');
    names.stale(first);
    const second = names.nameFor(SELECT, 1);
    expect(second).toBe(`${first}_1`);
    expect(names.size).toBe(2);
    names.stale(first); // an old name again changes nothing
    expect(names.nameFor(SELECT, 1)).toBe(second);
    names.stale('qc_unknown');
    expect(names.nameFor(SELECT, 1)).toBe(second);
  });
});

describe('nameStatements on a client', () => {
  it('sends a static statement named from its third call on, without changing the caller config', async () => {
    const client = new FakePg();
    nameStatements(client);
    const config = { text: SELECT, rowMode: 'array' };
    for (let i = 0; i < 5; i++) await (client.query(config, ['a']) as Promise<unknown>);
    expect(client.sent.map((s) => s.name === undefined)).toEqual([true, true, false, false, false]);
    expect(new Set(client.sent.slice(2).map((s) => s.name)).size).toBe(1);
    expect(client.sent.every((s) => s.text === SELECT && s.values[0] === 'a')).toBe(true);
    expect(config).toEqual({ text: SELECT, rowMode: 'array' });
  });

  it('counts parameters passed as the second argument (drizzle) and in the config', async () => {
    const client = new FakePg();
    nameStatements(client);
    const many = params(STATEMENT_NAME_LIMITS.maxParams + 1);
    for (let i = 0; i < 5; i++) await send(client, SELECT, many);
    for (let i = 0; i < 5; i++) {
      await (client.query({ text: `${SELECT} or $2`, values: many }) as Promise<unknown>);
    }
    expect(client.sent.every((s) => s.name === undefined)).toBe(true);
  });

  it('never names lists longer than a page, multi-row inserts, BEGIN or COMMIT, string queries or already named statements', async () => {
    const client = new FakePg();
    nameStatements(client);
    const long = STATEMENT_NAME_LIMITS.maxListLength + 1;
    for (let i = 0; i < 5; i++) {
      await send(client, inList(long), params(long));
      await send(
        client,
        'insert into "devices" ("id", "token") values ($1, $2), ($3, $4)',
        params(4),
      );
      await send(client, 'begin', []);
      await send(client, 'commit', []);
      await (client.query(SELECT, ['a']) as Promise<unknown>);
    }
    expect(client.sent.every((s) => s.name === undefined)).toBe(true);
    for (let i = 0; i < 3; i++) {
      await (client.query({ text: SELECT, name: 'mine' }, ['a']) as Promise<unknown>);
    }
    expect(client.sent.slice(-3).map((s) => s.name)).toEqual(['mine', 'mine', 'mine']);
  });

  it('keeps each connection to its own bound', async () => {
    const limits: StatementNameLimits = { ...STATEMENT_NAME_LIMITS, maxPerConnection: 2 };
    const a = new FakePg();
    const b = new FakePg();
    nameStatements(a, limits);
    nameStatements(b, limits);
    for (let round = 0; round < 4; round++) {
      for (let i = 0; i < 5; i++) {
        await send(a, `${SELECT} and "n" = ${i}`);
        await send(b, `${SELECT} and "n" = ${i}`);
      }
    }
    expect(a.preparedCount).toBe(2);
    expect(b.preparedCount).toBe(2);
    expect(a.sent.filter((s) => s.name === undefined).length).toBeGreaterThan(10);
  });

  it('recovers after a migration changed a returned column: one call fails, the next is prepared again', async () => {
    const client = new FakePg();
    const names = nameStatements(client);
    for (let i = 0; i < 4; i++) await send(client, SELECT);
    const before = last(client).name;
    expect(before).toMatch(/^qc_/);

    client.changeResultType();
    await expect(send(client, SELECT)).rejects.toMatchObject({ code: '0A000' });
    await send(client, SELECT);
    expect(last(client).name).toBe(`${before}_1`);
    await send(client, SELECT);
    expect(last(client).name).toBe(`${before}_1`);
    expect(names.size).toBe(2);
  });

  it('recovers the same way through the callback form pg-pool uses', async () => {
    const client = new FakePg();
    nameStatements(client);
    const viaCallback = (): Promise<unknown> =>
      new Promise((resolve, reject) => {
        client.query({ text: SELECT }, ['a'], (error: unknown, result: unknown) =>
          error ? reject(error) : resolve(result),
        );
      });
    for (let i = 0; i < 4; i++) await viaCallback();
    const before = last(client).name;
    client.changeResultType();
    await expect(viaCallback()).rejects.toMatchObject({ code: '0A000' });
    await viaCallback();
    expect(last(client).name).toBe(`${before}_1`);
  });

  it('passes other errors through and keeps the name', async () => {
    const client = new FakePg();
    nameStatements(client);
    for (let i = 0; i < 3; i++) await send(client, SELECT);
    const name = last(client).name;
    client.failNext = Object.assign(new Error('duplicate key'), { code: '23505' });
    await expect(send(client, SELECT)).rejects.toMatchObject({ code: '23505' });
    await send(client, SELECT);
    expect(last(client).name).toBe(name);
  });
});

describe('isStaleStatementError', () => {
  it('knows the two errors after which a named statement cannot run again', () => {
    expect(
      isStaleStatementError({ code: '0A000', message: 'cached plan must not change result type' }),
    ).toBe(true);
    expect(
      isStaleStatementError({ code: '26000', message: 'prepared statement "x" does not exist' }),
    ).toBe(true);
    expect(isStaleStatementError({ code: '0A000', message: 'something else' })).toBe(false);
    expect(isStaleStatementError({ code: '23505', message: 'duplicate key' })).toBe(false);
    expect(isStaleStatementError(null)).toBe(false);
    expect(isStaleStatementError('cached plan must not change result type')).toBe(false);
  });
});

describe('through drizzle (how the API sends its statements)', () => {
  const setup = () => {
    const client = new FakePg();
    nameStatements(client);
    const db = drizzle(client as unknown as pg.Client, { schema });
    return { client, db };
  };

  it('names a repeated select; its parameters arrive as the second argument', async () => {
    const { client, db } = setup();
    for (let i = 0; i < 4; i++) {
      await db
        .select()
        .from(schema.cities)
        .where(eq(schema.cities.id, `c${i}`));
    }
    expect(client.sent.map((s) => s.name === undefined)).toEqual([true, true, false, false]);
    expect(client.sent[3]?.values).toEqual(['c3']);
  });

  it('does not name an id list longer than a page, nor a transaction BEGIN and COMMIT', async () => {
    const { client, db } = setup();
    const ids = params(STATEMENT_NAME_LIMITS.maxListLength + 1);
    for (let i = 0; i < 4; i++) {
      await db.select().from(schema.cities).where(inArray(schema.cities.id, ids));
      await db.execute(sql`begin`);
      await db.execute(sql`commit`);
    }
    expect(client.sent).toHaveLength(12);
    expect(client.sent.every((s) => s.name === undefined)).toBe(true);
  });

  it('gives each list length its own name, only once it recurs', async () => {
    const { client, db } = setup();
    for (let n = 1; n <= 5; n++) {
      await db
        .select()
        .from(schema.cities)
        .where(inArray(schema.cities.id, params(n)));
    }
    expect(client.sent.every((s) => s.name === undefined)).toBe(true);
    await db
      .select()
      .from(schema.cities)
      .where(inArray(schema.cities.id, params(2)));
    await db
      .select()
      .from(schema.cities)
      .where(inArray(schema.cities.id, ['p', 'q']));
    expect(last(client).name).toMatch(/^qc_/);
    expect(last(client).values).toEqual(['p', 'q']);
  });
});
