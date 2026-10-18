# @qc/load: scope verification and the Ramadan-evening load test

Quality lane, WP12, brief deliverables 2 and 3 (`docs/agents/briefs/quality.md`). Everything here
runs against a running API over real HTTP, with synthetic data and fake push providers only.

There is no staging yet, so every result below comes from a local stack and is **provisional**
(see "Local results"). The same commands take a base URL, so they can be pointed at staging when
it exists.

## Commands

| Command                                             | What it does                                                                                                                                                                                                                                         |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm --filter @qc/load test`                       | The fast self-check (under a second, no network): the scenario table covers every endpoint, every request passes the contract's Zod schemas, the oracle agrees with the frozen matrix, and the load runner's journey, figures and thresholds behave. |
| `pnpm --filter @qc/load local [--only scope\|load]` | The stand-in for staging. Starts a private Postgres 16 with `pg_stat_statements`, then the e2e stack's real API and worker on free ports (no web targets, no stack file), runs both deliverables, prints the results and stops what it started.      |
| `pnpm --filter @qc/load scope --base-url <api>`     | Scope verification against any running API.                                                                                                                                                                                                          |
| `pnpm --filter @qc/load load --base-url <api>`      | The Node runner of the evening scenario against any running API (no k6 needed). Add `--worker-url` to measure the push drain from the worker's `/healthz`.                                                                                           |
| `k6 run k6/ramadan-evening.js`                      | The same scenario in k6, for staging (settings by environment, below).                                                                                                                                                                               |

Options of `local`: `--steps 10,25,50` (VUs per step), `--duration 40` (seconds per step),
`--users`, `--venues`, `--bulk-push-users`. Reports (JSON) go to
`tests/load/node_modules/.cache/qc-load/`, out of git, lint and format.

`scope` and `load` need the API's test-mode sign-in code and a national admin:

- `--fixed-code` / `QC_FIXED_CODE`: the API's `AUTH_FIXED_CODE` (the API refuses it in production).
- `--admin-phone` / `QC_ADMIN_PHONE`: a number with a pending national-admin invite, made with
  `pnpm --filter @qc/db bootstrap-admin --phone <number> [--force-additional]` on that database.
  Use a different number for each run (a number can ask for one code a minute).

### Safety

- Only `localhost` is accepted. A remote host needs `QC_ALLOW_REMOTE=staging`, set on purpose.
  Never production: the runs post national announcements, create venues and sign in people.
- All people are synthetic: +92 3xx mobile-format numbers in the ranges +92 313 to +92 318, names like
  "Scope Person", fake push tokens (`qc-load-fake-...`). Nothing is logged but statuses and timings.
- The worker runs with `MESSAGING_MODE=fake`: no push, WhatsApp or SMS leaves the machine.

### The API's limits

The runs stay inside the API's abuse limits rather than raising them (`src/limits.ts`). The
sign-in ceilings are not configurable by environment, so nothing is configured up locally:

- At most 1,000 sign-in codes an hour (10,000 a day) for all numbers together. Every synthetic
  person signs in once, so a run plans at most 900 sign-ins (`--users` / `QC_USERS` up to about
  880 with the admins and the scope callers); the seed refuses more. On staging, sign-ins by
  anyone else in the same hour count too, so run scope and load at least an hour after a large
  run, or lower `--users`.
- 10 codes a day per number and 30 code requests an hour per address: each person has their own
  number and their own synthetic address (`X-Forwarded-For`, read only with `TRUST_PROXY=true`
  and `AUTH_TRUST_PROXY=true`, as behind the production proxy).
- Refresh: 600 per 10 minutes per address. Each person refreshes from their own address about
  once per 15 minutes.
- Invites: 200 a day per inviter and 100 rows per coordinator import. The scope matrix invites
  about a dozen coordinators; the load test imports venues and sessions, not coordinators.
- Posters: 10 creates or remakes a minute per staff member. The scope matrix makes at most two
  per caller.

## Deliverable 2: scope verification

`src/scope/` generates the matrix from `@qc/contracts`:

- **Endpoints**: every id in `ENDPOINT_IDS` has at least one scenario (the self-check fails
  otherwise). Staff endpoints whose rule depends on the body get one scenario per variant (national,
  city and venue posts; the three role assignments; national, venue and circle picks).
- **Callers**: anonymous, attendee, venue coordinator of the venue, of another venue in the same
  city, of a venue in another city, city coordinator of the city, of another city, national admin,
  and a venue coordinator whose assignment was revoked after they used it. Everyone is created
  through the API: the national admin from the bootstrap invite, the others invited by the admin
  and signed in with the test code.
- **Expected outcome** (`src/scope/expect.ts`), never written by hand: public endpoints allow
  everyone; user endpoints answer 401 to anonymous, allow a person's own records and refuse
  (403 or 404) another person's, by `can(..., { ownerUserId })`; staff endpoints follow `can` and
  `scopeFilter` for the scenario's action and target, with the same 404 and "forbidden import row"
  rules as `apps/api/src/test/scope-matrix.test.ts`.
- **Extra checks**: after every caller tried another person's follow, bookmark, circle request or
  registration, the owner reads it back unchanged; after sign-out and account deletion the same
  access token must get 401.

A mismatch is any refusal where the matrix allows, any 2xx where it refuses (marked LEAK), any
5xx, and any 429 (inconclusive). The run prints the matrix (status per caller, `!` on a mismatch)
and exits 1 on a mismatch.

## Deliverable 3: the Ramadan-evening load test

### Model

The scale target is about 200 venues and under 50,000 users in the first season
(`docs/product/decisions.md`). The evening model in `scenario.json`, shared by both runners:

- **Seed** (through the API): 200 venues around one point in Lahore (bulk venue import), 3 daily
  sessions each at Taraweeh hours (bulk session import, 600 sessions, one in ten with a capacity of
  30), 800 synthetic attendees signed in with a fake FCM push device. Locally, 5,000 more synthetic
  push recipients are inserted straight into the database so the push burst has an audience.
- **Journey** (closed model, one virtual user = one person's app session, think time 0.3 to 1.5 s
  between screens): config, Nearby (`sessions.list` near a point; 40 % with section and time
  filters), "next near you" (`occurrences.list`), one to three session details with their
  occurrences, a registration in 25 % of journeys (then "my registrations"), the Updates badge and
  the ayah of the day. A repeat registration or a full session is an expected answer, not an error.
- **Steps**: 10, 25, 50, 100 VUs (40 s each, 5 s ramp). One VU makes about 3 requests a second,
  so 100 VUs is about 300 requests a second: 50,000 users with a fifth of them opening the app in
  the 15 minutes before Taraweeh, with headroom.
- **Push burst**, 10 s into every step: a national admin posts a national announcement with
  `notify: true`. The API queues one push per person with a device in the same request; the worker
  claims the rows and sends them through the fake provider. Measured: the post's latency and the
  time until every row is sent (locally from the database, remotely from the worker's `/healthz`).

### Proposed pass thresholds

| Measure                                                                        | Threshold                                | Why                                                                                                   |
| ------------------------------------------------------------------------------ | ---------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Failed requests (5xx, network errors, unexpected 4xx)                          | at most 0.5 %                            | A few minutes of trouble on a Ramadan evening is acceptable (decisions), lost registrations are not.  |
| Rate-limited answers (429) in the journey                                      | at most 0.1 %                            | Each synthetic person stays far under the per-person limits, so a 429 means a limit is keyed wrongly. |
| Nearby, filtered Nearby, "next near you" (`sessions.list`, `occurrences.list`) | p95 at most 500 ms, p99 at most 1,200 ms | The first screen on a slow 3G/4G phone; the network adds hundreds of milliseconds on top.             |
| Session detail and occurrences, config, Updates badge, ayah of the day         | p95 at most 300 ms, p99 at most 800 ms   | Single-row reads.                                                                                     |
| My registrations                                                               | p95 at most 500 ms, p99 at most 1,200 ms | A join over the person's registrations.                                                               |
| Registration (`POST /v1/registrations`)                                        | p95 at most 800 ms, p99 at most 2,000 ms | A write with capacity and waitlist checks and an outbox row.                                          |
| Push burst: the national post                                                  | at most 5,000 ms                         | The admin waits on it; it fans out in the request.                                                    |
| Push burst: drain rate                                                         | at least 100 pushes a second             | 50,000 devices in under 10 minutes; a reminder that lands after Taraweeh started is useless.          |

The numbers are in `scenario.json` (`thresholds`), so the Node runner, the k6 script and this
table use the same values. They are proposals for a human to confirm at Gate 5.

### Local results (provisional)

See `docs/agents/status/quality.md` ("Scope verification and load test") for the latest run's
figures, mismatches and findings. Local results are provisional: the API, the worker, Postgres
and the load generator all share one 4-CPU container, the worker polls every 500 ms (the e2e
stack's setting; the production default is 5 s), Postgres runs with durability off, and the
data set is the seed above rather than a full season.

## Re-run on staging (Gate 5)

Prerequisites on staging: the API in test mode (`APP_ENV` not production, `AUTH_FIXED_CODE` set,
`TRUST_PROXY=true` and `AUTH_TRUST_PROXY=true` with the proxy passing the client's
`X-Forwarded-For` through, since every synthetic person signs in from the load generator; at most
900 sign-ins in any hour, see "The API's limits"); the worker with fake push providers and its production `WORKER_POLL_MS`; staging
seeded with the `@qc/db` seed; for a realistic push burst, about 50,000 synthetic people with fake
devices (the local runner's `insertBulkPushUsers` does this with direct database access).

1. `pnpm --filter @qc/db bootstrap-admin --phone <synthetic number> --force-additional` on the
   staging database (twice: one admin for scope, one for load).
2. `QC_ALLOW_REMOTE=staging pnpm --filter @qc/load scope --base-url <api> --fixed-code <code> --admin-phone <n1>`.
   Expect 0 mismatches and 0 tampered records.
3. `QC_ALLOW_REMOTE=staging QC_BASE_URL=<api> QC_WORKER_URL=<worker> QC_FIXED_CODE=<code> QC_ADMIN_PHONE=<n2> k6 run k6/ramadan-evening.js`
   (or `pnpm --filter @qc/load load` with the same settings). The k6 thresholds are generated from
   `scenario.json`; k6 exits non-zero when one is crossed.
4. Watch the database during step 3 with `pg_stat_statements` and `pg_stat_activity` (or the
   staging monitoring) and record CPU, connections and the top statements next to the results.
