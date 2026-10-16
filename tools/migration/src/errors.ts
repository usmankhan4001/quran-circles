/**
 * Errors whose message is written by this tool and never contains row data. Only these (and
 * database error codes) are ever shown to the person running the tool.
 */
export class MigrationToolError extends Error {
  override name = 'MigrationToolError';
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

interface PgErrorLike {
  code?: unknown;
  constraint?: unknown;
  table?: unknown;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/**
 * A one-line description of a failure that is safe to print. Database errors can echo the
 * failing row ("Failing row contains ..."), so only the SQLSTATE code, constraint and table
 * names are used. Anything unrecognised is reduced to its class name.
 */
export function describeFailure(error: unknown): string {
  if (error instanceof MigrationToolError) return `${error.code}: ${error.message}`;
  let current: unknown = error;
  for (let depth = 0; depth < 5 && isRecord(current); depth++) {
    const pg = current as PgErrorLike;
    if (typeof pg.code === 'string' && /^[0-9A-Z]{5}$/.test(pg.code)) {
      const parts = [`database error ${pg.code}`];
      if (typeof pg.table === 'string') parts.push(`table ${pg.table}`);
      if (typeof pg.constraint === 'string') parts.push(`constraint ${pg.constraint}`);
      return parts.join(', ');
    }
    current = (current as { cause?: unknown }).cause;
  }
  const name = error instanceof Error ? error.name : typeof error;
  return `unexpected ${name} (details withheld because they may contain personal data)`;
}
