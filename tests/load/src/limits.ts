/**
 * The API's abuse limits that a load or scope run can run into, as they stand on main (72d6126,
 * `apps/api/src/auth/config.ts`, `modules/roles/service.ts`, `modules/posters/routes.ts`). None
 * of the sign-in ceilings can be raised by environment variable, so the runs stay inside them
 * instead of configuring them up.
 *
 * - Sign-in codes: at most 1,000 an hour and 10,000 a day for all numbers together (counted from
 *   the database), 10 a day per number, 30 code requests an hour per address.
 * - Refresh: 600 calls per 10 minutes per address.
 * - Invites: 200 a day per inviting person; one coordinator import holds at most 100 rows.
 * - Posters: 10 creates or remakes a minute per staff member.
 *
 * Every synthetic person signs in exactly once, from their own address, and refreshes about once
 * per 15 minutes, so only the global code ceilings matter. A local run starts a fresh database,
 * so the counts start at zero; on staging, earlier sign-ins in the same hour count too.
 */
export const API_LIMITS = {
  codesPerHourGlobal: 1_000,
  codesPerDayGlobal: 10_000,
  codesPerPhonePerDay: 10,
  codeRequestsPerAddressPerHour: 30,
  refreshPerAddressPer10Min: 600,
  invitesPerActorPerDay: 200,
  coordinatorImportRows: 100,
  posterWritesPerMinute: 10,
} as const;

/** Sign-ins a run may plan in one hour, leaving room for the scope matrix and the admins. */
export const SIGN_IN_BUDGET = 900;

/** Refuses a plan that would hit the global hourly code ceiling partway through seeding. */
export function assertSignInBudget(planned: number, budget: number = SIGN_IN_BUDGET): void {
  if (!Number.isInteger(planned) || planned < 0) {
    throw new Error(`planned sign-ins must be a whole number, got ${planned}`);
  }
  if (planned > budget) {
    throw new Error(
      `${planned} sign-ins would pass the API's global ceiling of ${API_LIMITS.codesPerHourGlobal} ` +
        `codes an hour (budget ${budget} per run). Lower --users, or wait an hour between runs.`,
    );
  }
}
