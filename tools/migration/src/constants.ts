/** Tag carried by every legacy row this tool writes. Matches the column default. */
export const SEASON_TAG = 'ramadan-2026';

/** Report layout version. Bump when the shape changes. */
export const REPORT_SCHEMA_VERSION = 1;

/** Key for rows that cannot be attributed to a known V2 city. */
export const UNASSIGNED = 'unassigned';

/** Arbitrary constant so two migration runs against one database take turns. */
export const ADVISORY_LOCK_KEY = 727_474_009;

/** Field length limits. V1 accepted unauthenticated inserts, so over-long values are rejected, not trimmed. */
export const LIMITS = {
  name: 200,
  shortText: 500,
  address: 1000,
} as const;
