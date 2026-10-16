import { sql } from 'drizzle-orm';
import { check, timestamp, uuid } from 'drizzle-orm/pg-core';

/** Primary key: uuid with a database-side default. */
export const pk = () => uuid('id').primaryKey().defaultRandom();

/** UTC instant. Always `timestamp with time zone`; the app shows Pakistan time. */
export const tstz = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

export const createdAt = () => tstz('created_at').notNull().defaultNow();
export const updatedAt = () => tstz('updated_at').notNull().defaultNow();

/** E.164: a plus sign, a non-zero first digit, 8 to 15 digits in all. */
export const E164_REGEX = '^\\+[1-9][0-9]{7,14}$';

/** Placeholder used so nullable scope columns can take part in unique indexes. */
export const NIL_UUID = sql.raw(`'00000000-0000-0000-0000-000000000000'::uuid`);

const quote = (value: string) => `'${value.replaceAll("'", "''")}'`;

export const sqlList = (values: readonly string[]) => values.map(quote).join(', ');

/**
 * CHECK constraint for a column backed by a closed vocabulary from `@qc/contracts`.
 * Named `<table>_<column>_chk` so tests (and humans) can find it. Nullable columns pass
 * the check when NULL, as SQL CHECK semantics do.
 */
export const enumCheck = (table: string, column: string, values: readonly string[]) =>
  check(`${table}_${column}_chk`, sql.raw(`"${column}" IN (${sqlList(values)})`));

/** Every element of an array column must belong to a closed vocabulary. */
export const enumArrayCheck = (table: string, column: string, values: readonly string[]) =>
  check(
    `${table}_${column}_chk`,
    sql.raw(`"${column}" <@ ARRAY[${sqlList(values)}]::text[]`),
  );

/** Phone numbers are stored normalised as E.164. Nullable columns pass when NULL. */
export const e164Check = (table: string, column: string) =>
  check(`${table}_${column}_chk`, sql.raw(`"${column}" ~ '${E164_REGEX}'`));

/** Days of the week are 0 (Sunday) to 6 (Saturday). */
export const daysOfWeekCheck = (table: string, column: string) =>
  check(
    `${table}_${column}_range_chk`,
    sql.raw(`"${column}" <@ ARRAY[0,1,2,3,4,5,6]::smallint[]`),
  );

/**
 * Scope shape shared by role assignments, invites, updates and the audit log.
 * National: no city or venue. City: a city and no venue. Venue: a venue; the city may be
 * stored too so feeds and audit views can filter by city without a join.
 */
export const scopeShapeCheck = (table: string) =>
  check(
    `${table}_scope_shape_chk`,
    sql.raw(
      `(scope_type = 'national' AND city_id IS NULL AND venue_id IS NULL) ` +
        `OR (scope_type = 'city' AND city_id IS NOT NULL AND venue_id IS NULL) ` +
        `OR (scope_type = 'venue' AND venue_id IS NOT NULL)`,
    ),
  );

/** A role only makes sense at its own scope. */
export const roleScopeCheck = (table: string) =>
  check(
    `${table}_role_scope_chk`,
    sql.raw(
      `(role = 'national_admin' AND scope_type = 'national') ` +
        `OR (role = 'city_coordinator' AND scope_type = 'city') ` +
        `OR (role = 'venue_coordinator' AND scope_type = 'venue')`,
    ),
  );

/** Inclusive numeric range. NULL passes (CHECK semantics), so use NOT NULL for presence. */
export const rangeCheck = (table: string, column: string, min: number, max: number) =>
  check(`${table}_${column}_range_chk`, sql.raw(`"${column}" BETWEEN ${min} AND ${max}`));

/** Free-form CHECK with raw SQL using bare column names. */
export const rawCheck = (name: string, expression: string) => check(name, sql.raw(expression));
