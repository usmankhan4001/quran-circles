/**
 * Scheduled work the API does not run itself. These functions take a database and a
 * time and import nothing from the HTTP app, so a worker process can call them directly.
 *
 * - `topUpAllOccurrences(db, now, horizonDays)`: daily; keeps recurring sessions' occurrences
 *   filled `horizonDays` ahead (the API default is 90). It lives in `@qc/db`, and the worker runs it
 *   on its `occurrences-top-up` schedule; this is a re-export.
 * - `purgeStaleAuthRows(db, now)`: removes spent sign-in codes and dead sessions. It lives in
 *   `@qc/db` (jobs), and the worker runs it every day at 03:00 Pakistan time; the API does not
 *   schedule it. This is a re-export (through the auth lane's `modules/auth/cleanup`).
 */
export { topUpAllOccurrences, type TopUpSummary } from './modules/sessions/top-up';
export { purgeStaleAuthRows, type PurgeResult } from './modules/auth/cleanup';
