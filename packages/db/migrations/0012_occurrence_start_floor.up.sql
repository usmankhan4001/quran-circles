-- 0012_occurrence_start_floor
-- Load test (Gate 5, staging and local): every read of upcoming occurrences ("next near you",
-- a session's next start in Nearby and in every session view, a session's occurrences) asked for
-- `ends_at >= now` in `starts_at` order, so Postgres walked the `starts_at` index through every
-- past occurrence first: one more row per session per day, 18,000 at the end of a Ramadan with
-- 600 sessions and growing every season. The API now adds the exact lower bound
--   starts_at >= least(now - 1 day, earliest start of an occurrence longer than a day that is
--                      still running)
-- (`occurrenceStartFloor` in apps/api/src/modules/sessions/views.ts). Generated occurrences last
-- at most a day (a session's duration is 1 to 1,440 minutes); only an organiser's edit can make
-- one longer. This partial index holds exactly those longer ones, so the second half of the bound
-- is one probe of a normally empty index. Additive: one index, no data change.

CREATE INDEX "occurrences_multiday_starts_idx" ON "occurrences" USING btree ("starts_at") WHERE "ends_at" - "starts_at" > interval '1 day';
