import { schema } from '@qc/db';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';

/**
 * The database handle the worker needs. Both node-postgres (production) and PGlite (tests)
 * satisfy it, as does a transaction.
 */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

export const tables = schema;

export type OutboxRow = typeof schema.messageOutbox.$inferSelect;

export type Clock = () => Date;
