# Change request: ANALYZE after seeding, before the load steps

Status: **proposed**.

Requested by: Gate 5 database performance investigation (orchestrator brief, 2026-10-18)
Contract: none (`tests/load`, quality lane; staging procedure, platform)
What I need: run `ANALYZE` on the application database after `seedEvening` and before the first load step, in the local runner (`tests/load/src/local/cli.ts`, it already has the database URL) and in the staging Gate 5 procedure (as `qc`: `infra/scripts/compose.sh exec -T postgres psql -U qc -d qc -c ANALYZE`, or wait two minutes after seeding).

Why: the seed writes about 200 venues, 600 sessions and 8,000 occurrences into nearly empty tables seconds before the load starts. Autovacuum has not analysed them yet, so the planner still believes the tables are tiny and picks poor plans. In the first local baseline (stock runner, no ANALYZE, code before the Gate 5 changes) the home screen's occurrence list (`home_next`) averaged 70 ms a call and was 83 % of all database time. The same code and seed with one `ANALYZE` before the steps spent 12.1 s of execution time in Postgres over the 100-user step instead of 113.5 s (145,476 and 135,007 statements), and every route's p95 dropped with it (all requests 190.9 ms without, 70.6 ms with fresh statistics; `home_next` 278.3 and 80.2 ms). A real evening runs on analysed tables, so measuring right after the seed reports a slower system than production would be.

Proposed change: one `ANALYZE` (a few hundred milliseconds on the seeded data) and a log line, in the local runner and in the staging steps.

Affected lanes: quality (`tests/load`), platform (staging steps).

Workaround meanwhile: run `ANALYZE` by hand after the seed, before the steps.
