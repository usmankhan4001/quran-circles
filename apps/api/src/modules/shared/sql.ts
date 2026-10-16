import { inArray, sql, type AnyColumn, type SQL } from 'drizzle-orm';

/** `column IN (...)` that is simply false for an empty list. */
export function anyOf<C extends AnyColumn>(column: C, values: readonly string[]): SQL {
  return values.length === 0 ? sql`false` : inArray(column, [...values]);
}

/** A timestamp value as SQL, parsed on the database side so every driver agrees. */
export const tsParam = (date: Date): SQL => sql`${date.toISOString()}::timestamptz`;
