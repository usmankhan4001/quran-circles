/**
 * The sign-in row purge lives in `@qc/db` (jobs) so the worker, which runs it every day at 03:00
 * Pakistan time, can import it (change request `auth-purge-to-db`). The API keeps this re-export
 * for `src/jobs.ts`, the auth lane's public surface and its own tests.
 */
export { purgeStaleAuthRows, type PurgeOptions, type PurgeResult } from '@qc/db';
