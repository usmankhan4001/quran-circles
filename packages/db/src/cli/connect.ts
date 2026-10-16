import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { pgExecutor, type SqlExecutor } from '../migrate';
import * as schema from '../schema/index';

/** Matches infra/docker-compose.dev.yml and .env.example. Development credentials only. */
export const DEFAULT_DATABASE_URL = 'postgres://qc:qc@localhost:5432/qc';

/** Loads v2/.env if there is one. Variables already set in the environment win. */
export function loadDotEnv(): void {
  try {
    process.loadEnvFile(new URL('../../../../.env', import.meta.url));
  } catch {
    // No .env file: fine, defaults and the real environment are enough.
  }
}

/** Runs `fn` on one connection to DATABASE_URL and always closes it. */
export async function withDatabase<T>(fn: (db: SqlExecutor) => Promise<T>): Promise<T> {
  loadDotEnv();
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL,
  });
  await client.connect();
  try {
    return await fn(pgExecutor(client));
  } finally {
    await client.end();
  }
}

/** Like `withDatabase`, but hands `fn` a Drizzle database on the same single connection. */
export async function withDrizzle<T>(
  fn: (db: ReturnType<typeof drizzleOn>) => Promise<T>,
): Promise<T> {
  loadDotEnv();
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL,
  });
  await client.connect();
  try {
    return await fn(drizzleOn(client));
  } finally {
    await client.end();
  }
}

const drizzleOn = (client: pg.Client) => drizzle(client, { schema });

/** Prints a failure without echoing connection details, then exits non-zero. */
export function fail(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`error: ${message}`);
  process.exit(1);
}
