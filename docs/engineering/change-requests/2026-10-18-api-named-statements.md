# Change request: named prepared statements in the api's pool

Status: **proposed**, not applied. The Gate 5 investigation (2026-10-18) applied only query and index changes, as briefed ("prefer indexes and query shape over new caching"). This is plan caching, so it is the api-core lane's call.

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
