/**
 * Scheduled database work shared by the API and the worker. Each job takes a database and a time
 * and nothing else, so either process can run it.
 */
export { topUpAllOccurrences, type TopUpSummary } from './top-up';
export {
  DEFAULT_CHALLENGE_RETENTION_DAYS,
  DEFAULT_SESSION_RETENTION_DAYS,
  purgeStaleAuthRows,
  type PurgeOptions,
  type PurgeResult,
} from './auth-purge';
export {
  DEFAULT_OCCURRENCE_HORIZON_DAYS,
  horizonDate,
  insertPlanned,
  planOccurrences,
  scheduleSpecOf,
  topUpOccurrences,
  withSeasonEnd,
  type JobDb,
  type PlannedOccurrence,
  type ScheduleSpec,
} from './occurrences';
export {
  UPDATE_PUSH_CHUNK,
  countPendingUpdatePushes,
  fanOutPendingUpdatePushes,
  reachUserIds,
  updatePushKey,
  updatePushPayload,
  updateScopeOf,
  venueConnectedUserIds,
  writeUpdatePushes,
  type UpdatePushOptions,
  type UpdatePushSummary,
  type UpdateScopeRef,
} from './update-push';
