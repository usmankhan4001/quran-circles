import { createHash } from 'node:crypto';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import pg from 'pg';
import { schema } from '@qc/db';

export { schema };

/**
 * The database handle every module takes. It is the common type of the node-postgres driver (the
 * server) and the PGlite driver (tests), so the same module code runs against both. A transaction
 * from `db.transaction(...)` is also a `Db`.
 */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

export interface DbHandle {
  db: Db;
  close(): Promise<void>;
}

/** When a statement may be named (see `StatementNames`). */
export interface StatementNameLimits {
  /** Statements with more parameters than this are never named. */
  maxParams: number;
  /** Statements with a longer `in ($1, $2, ...)` list are never named: each length is a new text. */
  maxListLength: number;
  /** Times a statement runs unnamed on a connection before it is named there. */
  minUses: number;
  /** Named statements one connection keeps at most; after that the rest run unnamed. */
  maxPerConnection: number;
}

/**
 * Measured (Gate 5 load, 150 VUs): about 30 statements are named per connection, and each adds
 * about 100 kB to its Postgres backend, so 64 bounds a backend's extra memory near 7 MB (about
 * 140 MB for the 20 API connections, inside the 1 GB Postgres container). Lists up to a page
 * (20, the contract's default `limit`) are named: a page of session ids recurs on every list call.
 */
export const STATEMENT_NAME_LIMITS: StatementNameLimits = {
  maxParams: 64,
  maxListLength: 20,
  minUses: 3,
  maxPerConnection: 64,
};

/** `in ($1, $2, ...)`: the list of parameters, in the first group. */
const PARAM_LIST = /\bin\s*\(\s*(\$\d+(?:\s*,\s*\$\d+)*)\s*\)/gi;
/** A multi-row insert, `values (...), ($3, ...)`: every row count is a different text. */
const MULTI_ROW = /\)\s*,\s*\(\s*(?:\$\d+|default)\b/i;

/** The length of the longest `in (...)` list of parameters in a statement, 0 when it has none. */
export function longestParamList(text: string): number {
  let longest = 0;
  for (const match of text.matchAll(PARAM_LIST)) {
    longest = Math.max(longest, (match[1] ?? '').split(',').length);
  }
  return longest;
}

/**
 * Whether a statement may be named at all: its text must come back the same on many calls, so
 * naming it cannot add a prepared statement per request. Statements without parameters (BEGIN,
 * COMMIT, locks without keys) are left to the simple protocol.
 */
export function isNamable(text: string, paramCount: number, limits: StatementNameLimits): boolean {
  if (paramCount === 0 || paramCount > limits.maxParams) return false;
  if (longestParamList(text) > limits.maxListLength) return false;
  if (/^\s*insert\b/i.test(text) && MULTI_ROW.test(text)) return false;
  return true;
}

/**
 * The plan cache of one connection, as seen from the client: which statement texts are named
 * there. A text is named after a hash of itself once it has run `minUses` times unnamed on the
 * connection, at most `maxPerConnection` of them; Postgres then parses and plans it once and reuses
 * the plan (after five runs, a generic plan when it is not costlier than the custom ones).
 */
export class StatementNames {
  private readonly named = new Map<string, string>();
  private readonly uses = new Map<string, number>();
  private readonly generation = new Map<string, number>();
  private readonly hashOfName = new Map<string, string>();
  /** Statements this connection has asked the server to keep, stale ones included. */
  private prepared = 0;

  constructor(private readonly limits: StatementNameLimits = STATEMENT_NAME_LIMITS) {}

  /** The name to send for this statement, or undefined to send it unnamed. */
  nameFor(text: string, paramCount: number): string | undefined {
    if (!isNamable(text, paramCount, this.limits)) return undefined;
    const hash = createHash('sha1').update(text).digest('hex').slice(0, 24);
    const known = this.named.get(hash);
    if (known !== undefined) return known;
    const used = (this.uses.get(hash) ?? 0) + 1;
    if (used < this.limits.minUses || this.prepared >= this.limits.maxPerConnection) {
      // Bounded: texts that never come back are forgotten together.
      if (this.uses.size >= this.limits.maxPerConnection * 4) this.uses.clear();
      this.uses.set(hash, used);
      return undefined;
    }
    this.uses.delete(hash);
    const gen = this.generation.get(hash) ?? 0;
    const name = gen === 0 ? `qc_${hash}` : `qc_${hash}_${gen}`;
    this.named.set(hash, name);
    this.hashOfName.set(name, hash);
    this.prepared += 1;
    return name;
  }

  /**
   * The server can no longer run this named statement (a migration changed a column it returns,
   * or the statement is gone). The next call of the same text prepares it again under a new name.
   */
  stale(name: string): void {
    const hash = this.hashOfName.get(name);
    if (hash === undefined || this.named.get(hash) !== name) return;
    this.named.delete(hash);
    this.generation.set(hash, (this.generation.get(hash) ?? 0) + 1);
    this.uses.set(hash, this.limits.minUses - 1);
  }

  get size(): number {
    return this.prepared;
  }
}

/**
 * The errors after which a named statement cannot be run again on the connection: Postgres
 * re-plans by itself when a table or index changes, but refuses "cached plan must not change
 * result type" when a returned column's type changed, and a statement can be deallocated.
 */
export function isStaleStatementError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const { code, message } = error as { code?: unknown; message?: unknown };
  if (code === '26000') return true;
  return (
    code === '0A000' &&
    typeof message === 'string' &&
    message.includes('cached plan must not change result type')
  );
}

type Callback = (error: Error | null, result?: unknown) => void;
type QueryFn = (config: unknown, values?: unknown, callback?: unknown) => unknown;
interface QueryConfig {
  text: string;
  name?: unknown;
  values?: unknown;
  submit?: unknown;
}

function isPlainConfig(config: unknown): config is QueryConfig {
  return (
    typeof config === 'object' &&
    config !== null &&
    typeof (config as QueryConfig).text === 'string' &&
    (config as QueryConfig).name === undefined &&
    typeof (config as QueryConfig).submit !== 'function'
  );
}

/**
 * Names the static statements a client sends (see `StatementNames`), so Postgres plans each of
 * them once per connection instead of on every call (Gate 5: planning was more than half of the
 * database time of the busiest routes). A statement that already has a name, a plain string query,
 * a cursor and every statement `isNamable` refuses go out as they came. A named statement
 * that fails as stale is prepared again under a new name on its next call; the failing call itself
 * still fails (inside a transaction it could not be retried).
 */
export function nameStatements(
  client: { query: unknown },
  limits: StatementNameLimits = STATEMENT_NAME_LIMITS,
): StatementNames {
  const names = new StatementNames(limits);
  const original = (client.query as QueryFn).bind(client);
  const query: QueryFn = (config, values, callback) => {
    if (!isPlainConfig(config)) return original(config, values, callback);
    const params = Array.isArray(values)
      ? values
      : Array.isArray(config.values)
        ? (config.values as unknown[])
        : [];
    const name = names.nameFor(config.text, params.length);
    if (name === undefined) return original(config, values, callback);
    const named = { ...config, name };
    const onError = (error: unknown): void => {
      if (isStaleStatementError(error)) names.stale(name);
    };
    const wrap =
      (done: Callback): Callback =>
      (error, result) => {
        if (error) onError(error);
        done(error, result);
      };
    if (typeof values === 'function') return original(named, wrap(values as Callback));
    if (typeof callback === 'function') return original(named, values, wrap(callback as Callback));
    const result = original(named, values) as Promise<unknown>;
    return result.catch((error: unknown) => {
      onError(error);
      throw error;
    });
  };
  client.query = query;
  return names;
}

/**
 * Connects to Postgres with a small pool. The URL comes from the environment, never from code.
 * Each connection names its static statements (`nameStatements`) and is replaced after an hour,
 * which also bounds how long its plans and prepared statements live.
 */
export function createPgDb(connectionString: string): DbHandle {
  const pool = new pg.Pool({ connectionString, max: 10, maxLifetimeSeconds: 3600 });
  pool.on('connect', (client) => {
    nameStatements(client);
  });
  const db: Db = drizzle(pool, { schema });
  return { db, close: () => pool.end() };
}
