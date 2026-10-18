# Change request: named prepared statements in the api's pool

Status: **done** by the api-core lane, 2026-10-18 (`apps/api/src/db.ts`, tests in `apps/api/src/test/named-statements.test.ts`). Applied as a safer version of the patch below, load-tested locally at 100 and 150 VUs. See "Applied" at the end. The original request follows unchanged.

Requested by: Gate 5 database performance investigation (orchestrator brief, 2026-10-18)
Contract: none (`apps/api/src/db.ts`, api-core)
What I need: name every statement the api sends after a hash of its text, so Postgres parses and plans it once per connection and then reuses the plan. Two limits: statements with more than 64 parameters (long `IN` lists, where every list length is a new text) stay unnamed, and each connection keeps at most 500 named statements. The patch below does it in `createPgDb` (the node-postgres path only; tests on PGlite are unaffected).

Why: after the query changes, planning was still more than half of Postgres's time on the busiest routes (pg_stat_statements with `track_planning`: about 4.6 ms of database time per request, the larger part planning; the multi-join reads plan in 1 to 3 ms and execute in under 1 ms). Measured locally on the same stack and data, one run each, production build, 2 API processes, Postgres alone on one core, 40 s steps (p95 / p99 in ms):

| 150 virtual users     | After the Gate 5 query changes | Plus named statements |
| --------------------- | ------------------------------ | --------------------- |
| throughput            | 378.7 req/s                    | 442.8 req/s           |
| all requests          | 212.9 / 303.5                  | 51.6 / 87.4           |
| nearby                | 231.2 / 310.9                  | 65.8 / 91.6           |
| session_view          | 177.3 / 236.7                  | 38.8 / 56.1           |
| session_occurrences   | 226.2 / 293.7                  | 43.0 / 64.0           |
| unread_count          | 175.0 / 233.7                  | 36.2 / 52.7           |
| register              | 423.6 / 523.1                  | 134.5 / 186.7         |
| Postgres CPU, 100 VUs | 43 %                           | 31 %                  |

The measured run used an unbounded experimental version of the same wrapper; the patch below adds the two limits and was typechecked, linted and formatted, but not load-tested again.

Risks, for the owner to weigh:

- **Generic plans.** After five runs of a named statement Postgres may switch to one generic plan for all parameter values. For our statements the measured plans stayed fast, but a skewed value (one huge venue, a long list) could get a worse generic plan. `plan_cache_mode = force_custom_plan` on the role would turn that off and still save parsing, but most of the gain is planning. pg_stat_statements on staging (now enabled) shows any statement whose mean time rises.
- **Schema changes under running processes.** Postgres re-plans a named statement by itself when a table or index changes, but refuses with "cached plan must not change result type" if a column it returns changes type. During a deploy the old api containers run while `migrate` applies migrations; a migration that changes a column's type would fail their statements until they restart (it would very likely break them anyway).
- **Memory.** Each named statement holds its plan in the backend: at most 500 per connection, about 20 connections, a few kB each.

Proposed change: the patch below (`git apply` from the repository root; on main at 91dc689).

Affected lanes: api-core (owns `apps/api/src/db.ts`), platform (staging re-run to confirm).

Workaround meanwhile: none needed; with the Gate 5 query changes the four routes pass their limits locally at 100 and 150 virtual users without it.

```diff
diff --git a/apps/api/src/db.ts b/apps/api/src/db.ts
index 34191be..1769fda 100644
--- a/apps/api/src/db.ts
+++ b/apps/api/src/db.ts
@@ -1,3 +1,4 @@
+import { createHash } from 'node:crypto';
 import { drizzle } from 'drizzle-orm/node-postgres';
 import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
 import pg from 'pg';
@@ -17,9 +18,46 @@ export interface DbHandle {
   close(): Promise<void>;
 }

+/** Statements with more parameters than this (long `IN` lists) are not named: each length is a new text. */
+const NAMED_MAX_PARAMS = 64;
+/** Named statements one connection keeps; after this it sends the rest unnamed. */
+const NAMED_MAX_PER_CONNECTION = 500;
+
+type QueryConfig = { text?: unknown; name?: unknown; values?: unknown };
+
+/**
+ * Names every statement after a hash of its text, so Postgres parses and plans it once per
+ * connection and reuses the plan, instead of planning it again on every call (load test, Gate 5:
+ * planning was more than half of the database time of the busiest routes). Postgres re-plans by
+ * itself when a table or index the statement uses changes. A statement that already has a name, a
+ * plain string query and a transaction's BEGIN or COMMIT are left as they are.
+ */
+function nameStatements(client: pg.PoolClient): void {
+  const named = new Set<string>();
+  const query = client.query.bind(client) as (...args: unknown[]) => unknown;
+  (client as unknown as { query: (...args: unknown[]) => unknown }).query = (...args) => {
+    const config = args[0] as QueryConfig | null | undefined;
+    if (
+      config !== null &&
+      typeof config === 'object' &&
+      typeof config.text === 'string' &&
+      config.name === undefined &&
+      (!Array.isArray(config.values) || config.values.length <= NAMED_MAX_PARAMS)
+    ) {
+      const name = `qc_${createHash('sha1').update(config.text).digest('hex').slice(0, 24)}`;
+      if (named.has(name) || named.size < NAMED_MAX_PER_CONNECTION) {
+        named.add(name);
+        config.name = name;
+      }
+    }
+    return query(...args);
+  };
+}
+
 /** Connects to Postgres with a small pool. The URL comes from the environment, never from code. */
 export function createPgDb(connectionString: string): DbHandle {
   const pool = new pg.Pool({ connectionString, max: 10 });
+  pool.on('connect', nameStatements);
   const db: Db = drizzle(pool, { schema });
   return { db, close: () => pool.end() };
 }
```

## Applied (api-core, 2026-10-18)

### Problems found in the patch

- **The 64-parameter limit did nothing.** drizzle passes a statement's values as the second argument of `client.query(config, values)`, not in `config.values`. The patch checked only `config.values`, so every statement passed the check, long `IN` lists included. The applied version counts both.
- **BEGIN, COMMIT and ROLLBACK were named.** drizzle sends them as config objects with no parameters. That was harmless but used slots. Statements without parameters are now left to the simple protocol.
- **No recovery from a stale statement.** After a migration that changes the type of a returned column, every later call of that named statement on that connection fails, because node-postgres sends only Bind once a name is parsed. Calls through `pool.query` drop the connection on any error, which recovers by accident. Inside a transaction (drizzle releases the client without the error) the connection kept failing that statement until it closed. On real Postgres 16, widening `varchar(10)` to `varchar(20)` is enough to cause it (typmod counts). Adding a column is not, because drizzle lists columns explicitly.
- **The memory estimate was too low.** Measured with `pg_log_backend_memory_contexts` on the API's own backends: each named statement adds about 100 kB, not a few kB (query tree plus the cached generic plan). The patch's 500 per connection would allow about 50 MB per backend, about 1 GB for 20 API connections, which is the whole Postgres container (1 GB).
- The patch mutated drizzle's query config object in place. The applied version copies it.

### What is applied

`nameStatements(client, limits)` on every pool connection (`pool.on('connect')`), with `StatementNames` per connection:

- A statement is named only if it has 1 to 64 parameters, no `in ($1, ...)` list longer than 20 (the contract's default page size), and is not a multi-row insert.
- It is named only from its third use on that connection (`minUses: 3`). Texts that do not recur (rare filter combinations, odd list lengths) never take a slot. The counter map is bounded and cleared when full.
- At most **64** named statements per connection; after that, new texts run unnamed, as before. That is about 7 MB extra per backend, about 140 MB for 20 API connections, worst case. Measured in use: about 30 per connection, +3.2 MB per backend.
- On `0A000 cached plan must not change result type` or `26000` (statement gone), the name is marked stale and the next call prepares the same text under a new name (`qc_<hash>_1`). The failing call still fails, since inside a transaction it cannot be retried. That is one failed call per connection and statement after such a migration.
- `maxLifetimeSeconds: 3600` on the pool: connections are replaced hourly, which bounds how long plans, stale statements and accumulated list variants live.
- Already named statements, string queries and cursors pass through unchanged. PGlite (tests) is not affected. The worker has its own pool (`apps/worker/src/main.ts`), so its outbox claim and fan-out are not affected; `@qc/db` functions are named only when the API runs them.

### Risks checked

- **Generic plans.** On the seeded data plus a skewed venue (one venue with 202 sessions), the 14 most frequent API statements were run with 40 real parameter sets each under `force_custom_plan`, `force_generic_plan` and auto. Only one has a bad generic plan: the `home_next` occurrence list (generic 10.5 ms against custom 0.63 ms mean). Auto mode never uses it: 40 custom plans out of 40, with the generic plan estimated at 413 against 15.75 custom. The load runs show the same (plans equal calls for that statement). The page lists also stay on custom plans. The statements that switch to generic plans (nearby, session view, unread count, auth lookups, consents) are as fast or faster on average, the skewed venue included. Worst single ratio is 2.8x on statements under 0.4 ms, which is noise. `plan_cache_mode` is left at the default. Watch mean execution time in pg_stat_statements on staging. The outbox claim runs in the worker, which is not affected.
- **Schema changes.** Redeploys always restart the API after `migrate`: every deploy uses a new image tag and the `api` service depends on `migrate` completing (`infra/scripts/deploy.sh`, compose). The old containers run against the new schema only for the seconds between `migrate` and their replacement. A migration run by hand outside a deploy, or a rollback of the images, is covered by the stale-statement recovery and the hourly connection lifetime.
- **Advisory locks.** Transaction-scoped locks (`invite_allowance`, `poster_create`, daily ayah) take their key as a parameter, so it is one statement text. Real Postgres: a lock taken by a named statement blocks a second connection until commit, and no lock is held afterwards. The sign-in lane's `ISSUE_LOCK` has no parameters and stays unnamed.

### Load test (local, `@qc/load` runner, HEAD snapshot)

Production-like local setup: `API_PROCESSES=2`, Postgres 16 pinned alone to one core, everything else on the other 3, ANALYZE after the seed, 40 s steps. Main at 12d5c64 against this change, two runs each (p95 / p99 ms, req/s):

| 150 VUs             | main run 1    | main run 2    | applied run 1 | applied run 2 |
| ------------------- | ------------- | ------------- | ------------- | ------------- |
| req/s               | 367.4         | 374.3         | 448.2         | 440.3         |
| all                 | 212.4 / 302.2 | 217.9 / 309.0 | 43.1 / 79.4   | 52.1 / 92.8   |
| nearby              | 238.1 / 321.5 | 237.5 / 310.1 | 58.6 / 85.3   | 63.0 / 90.7   |
| session_view        | 173.0 / 226.2 | 184.5 / 240.7 | 31.4 / 53.4   | 38.3 / 72.0   |
| session_occurrences | 215.7 / 287.8 | 228.9 / 302.1 | 35.8 / 54.1   | 43.9 / 83.8   |
| unread_count        | 177.1 / 242.0 | 179.6 / 240.6 | 31.0 / 48.4   | 34.4 / 69.2   |
| register            | 414.9 / 487.2 | 411.8 / 580.8 | 123.1 / 183.7 | 144.7 / 210.3 |
| home_next           | 240.5 / 304.2 | 249.6 / 354.7 | 64.4 / 96.9   | 74.4 / 107.4  |
| Postgres core busy  | n/m           | 89 %          | 63 %          | 65 %          |

| 100 VUs             | main run 1    | main run 2    | applied run 1 | applied run 2 |
| ------------------- | ------------- | ------------- | ------------- | ------------- |
| req/s               | 286.5         | 291.4         | 299.0         | 300.6         |
| all                 | 94.9 / 157.2  | 70.9 / 121.6  | 39.4 / 75.2   | 32.4 / 60.9   |
| nearby              | 115.8 / 152.1 | 90.0 / 131.9  | 46.8 / 73.9   | 43.5 / 78.1   |
| session_view        | 70.5 / 115.9  | 54.8 / 92.7   | 31.6 / 56.2   | 24.9 / 39.6   |
| session_occurrences | 86.0 / 144.5  | 62.8 / 98.7   | 33.5 / 55.2   | 27.4 / 45.5   |
| unread_count        | 74.0 / 113.6  | 53.9 / 87.3   | 27.6 / 41.9   | 23.6 / 36.1   |
| register            | 262.0 / 338.9 | 201.9 / 289.9 | 144.6 / 199.9 | 85.3 / 137.9  |
| home_next           | 116.3 / 167.0 | 88.1 / 129.8  | 61.5 / 95.8   | 48.6 / 70.7   |
| Postgres core busy  | n/m           | 75 %          | 50 %          | 50 %          |

- Database time at 150 VUs: planning 57.9 s, then 13.4 s; execution 58.5 s, then 30.5 s. Plans per statement call 0.73, then 0.28.
- API processes (primary plus 2 workers) RSS: main max 558 to 609 MB; applied 534 to 621 MB. No change; the client side keeps only the names. API CPU is unchanged (98 to 115 % of a core on main, 98 to 132 % applied, for 20 % more requests).
- Postgres memory of the 20 API backends: main 3.1 to 3.4 MB each; applied 5.5 to 6.7 MB each, about 64 MB more in total.
- Failed requests: 0 in every run.
- Also measured: naming without any `IN` lists gave 429 and 446 req/s, with p95 70.5 and 46.7 ms at 150 VUs. The page lists save their parse step, but they keep custom plans.
- "n/m": the first main run had only the stock Postgres CPU sampler, which misses exited backends. The pinned core's busy time came from `/proc/stat` in the later runs.
