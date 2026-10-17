import type { PGlite, Transaction } from '@electric-sql/pglite';

/**
 * Test-only (`@qc/db/testing`). node-postgres runs one query at a time per client: a second
 * `client.query()` while one is running is queued, pg 8 prints "DeprecationWarning: Calling
 * client.query() when the client is already executing a query", and pg 9 will throw. Inside a
 * transaction every query goes to the same client, so `Promise.all` over a transaction handle is
 * exactly that (integration finding F-02). PGlite serializes everything and never shows it.
 *
 * `guardTransactions` makes the client PGlite hands to a transaction throw
 * `OverlappingQueryError` when a query starts before the previous one has finished, as pg 9 will.
 * Queries outside a transaction are not checked: in production they go to a pool, where running
 * them side by side is fine.
 */
export class OverlappingQueryError extends Error {
  constructor() {
    super(
      'Overlapping queries on one transaction client: a query started while another was still ' +
        'running (Promise.all over a transaction?). node-postgres 9 makes this an error; run ' +
        'the queries one after another inside a transaction.',
    );
    this.name = 'OverlappingQueryError';
  }
}

/** Patches `pg.transaction` in place so each transaction's client refuses overlapping queries. */
export function guardTransactions<T extends PGlite>(pg: T): T {
  const original = pg.transaction.bind(pg);
  const guarded = <R>(callback: (tx: Transaction) => Promise<R>): Promise<R> =>
    original((tx) => callback(guardClient(tx)));
  pg.transaction = guarded as T['transaction'];
  return pg;
}

function guardClient(tx: Transaction): Transaction {
  let running = false;
  const exclusive =
    <A extends unknown[], R>(fn: (...args: A) => Promise<R>) =>
    async (...args: A): Promise<R> => {
      if (running) throw new OverlappingQueryError();
      running = true;
      try {
        return await fn(...args);
      } finally {
        running = false;
      }
    };
  return {
    query: exclusive(tx.query.bind(tx)) as Transaction['query'],
    sql: exclusive(tx.sql.bind(tx)) as Transaction['sql'],
    exec: exclusive(tx.exec.bind(tx)),
    rollback: () => tx.rollback(),
    listen: (channel, callback) => tx.listen(channel, callback),
    get closed() {
      return tx.closed;
    },
  };
}
