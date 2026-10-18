# Change request: ANALYZE after seeding, before the load steps

Status: **quality part applied** (2026-10-18, `tests/load`); **staging part open** (platform, see "Staging: where the step goes").

Requested by: Gate 5 database performance investigation (orchestrator brief, 2026-10-18)
Contract: none (`tests/load`, quality lane; staging procedure, platform)
What I need: run `ANALYZE` on the application database after `seedEvening` and before the first load step, in the local runner (`tests/load/src/local/cli.ts`, it already has the database URL) and in the staging Gate 5 procedure (as `qc`: `infra/scripts/compose.sh exec -T postgres psql -U qc -d qc -c ANALYZE`, or wait two minutes after seeding).

Why: the seed writes about 200 venues, 600 sessions and 8,000 occurrences into nearly empty tables seconds before the load starts. Autovacuum has not analysed them yet, so the planner still believes the tables are tiny and picks poor plans. In the first local baseline (stock runner, no ANALYZE, code before the Gate 5 changes) the home screen's occurrence list (`home_next`) averaged 70 ms a call and was 83 % of all database time. The same code and seed with one `ANALYZE` before the steps spent 12.1 s of execution time in Postgres over the 100-user step instead of 113.5 s (145,476 and 135,007 statements), and every route's p95 dropped with it (all requests 190.9 ms without, 70.6 ms with fresh statistics; `home_next` 278.3 and 80.2 ms). A real evening runs on analysed tables, so measuring right after the seed reports a slower system than production would be.

Proposed change: one `ANALYZE` (a few hundred milliseconds on the seeded data) and a log line, in the local runner and in the staging steps.

Affected lanes: quality (`tests/load`), platform (staging steps).

Workaround meanwhile: run `ANALYZE` by hand after the seed, before the steps.

## Applied in `tests/load` (quality, 2026-10-18)

- Local runner (`pnpm --filter @qc/load local`): after `seedEvening`, `ANALYZE` on the tables the local setup filled (`SEEDED_TABLES` in `tests/load/src/local/dbprep.ts`: venues, sessions, occurrences, users, devices, otp_challenges, auth_sessions, role_assignments, coordinator_invites, audit_log; only those that exist), with a log line and an `analyze` block in the report. A failed `ANALYZE` is logged as a warning and reported; the run goes on.
- `pg_stat_statements`: reset once just before the first step; per-step figures are now differences between snapshots, so the counts survive to the end, and the report and the text summary end with the top 15 statements by total time over the whole load (`statements`). When it is missing (not preloaded, not installed in the database that holds the view, or a role that may not read it), the figures are skipped quietly and the report says why.
- Remote runner (`pnpm --filter @qc/load load`) and k6 reach the API only: their report says `ANALYZE` was not run and `pg_stat_statements` was not read. New `--after-seed-wait <s>` / `QC_AFTER_SEED_WAIT_S` (0 to 900, default 0) pauses between the seed and the first step, and logs `seeded; waiting ...`, so autovacuum or an operator can analyse the seeded tables (the CR's "wait two minutes" alternative). The local k6 path passes `--after-seed-wait` through.
- Local check: the seeded tables went from `reltuples` -1 to their real counts; a small `local --only load` run analysed all 10 tables in 12 ms and printed the top 15.

## Staging: where the step goes (platform; not edited by quality)

The evening data is not written by the staging `seed` service. That service runs the `@qc/db` seed when the stack is deployed, before any load run. The `gate5` service (`infra/docker-compose.staging.yml`) runs the load runner, and the runner seeds venues, sessions, occurrences and attendees through the API and starts the first step seconds later, in one process. So the step belongs **inside the `gate5` run, between the runner's seed and its first step**. An `ANALYZE` at the end of the `seed` service (or of `packages/db` `seed.ts`) would cover only the base seed and would not fix this baseline. It is harmless for the db lane to add, but it is not the fix.

Proposed for platform, in order of preference:

1. **Now, no new access:** in the `gate5` service environment add `QC_AFTER_SEED_WAIT_S: ${QC_GATE5_AFTER_SEED_WAIT_S:-150}`. Staging Postgres runs the default autovacuum (one-minute naptime). The seeded tables pass the analyse threshold, so autovacuum analyses them during the pause. During the same pause, an operator can make it deterministic and start the statement counts. When the gate5 log shows `seeded; waiting`, run as `qc`: `infra/scripts/compose.sh exec -T postgres psql -U qc -d qc -c ANALYZE`, then `... psql -U qc -d postgres -c "SELECT pg_stat_statements_reset()"`. After the run, read the top 15 with the query in `infra/README.md` "Query statistics" (`LIMIT 15`). Without the reset, the counts include the seed.
2. **Deterministic and automatic (needs an orchestrator decision):** the runner would accept database URLs only on staging, through opt-in variables such as `QC_ANALYZE_DATABASE_URL` (application database, a role allowed to `ANALYZE` the tables) and `QC_STATS_DATABASE_URL` (`postgres` database as `qc`). With them, it would run the same `ANALYZE`, reset and top-15 report as the local runner. This needs `gate5` on the `backend` network and the `qc` password in the tools container, and it ends "remote runs reach the API only". Quality has not built it. If the orchestrator wants it, it is a quality change, plus this platform wiring.

Not changed: `infra/`, `packages/db`.
