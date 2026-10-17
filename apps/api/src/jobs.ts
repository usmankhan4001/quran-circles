/**
 * Scheduled work the API owns but does not run itself. These functions take a database and a
 * time and import nothing from the HTTP app, so a worker process can call them directly.
 *
 * - `topUpAllOccurrences(db, now, horizonDays)`: daily; keeps recurring sessions' occurrences
 *   filled `horizonDays` ahead (the API default is 90).
 * - `purgeStaleAuthRows(db, now)`: daily; removes spent sign-in codes and dead sessions.
 */
export { topUpAllOccurrences, type TopUpSummary } from './modules/sessions/top-up';
export { purgeStaleAuthRows, type PurgeResult } from './modules/auth/cleanup';
