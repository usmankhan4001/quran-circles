# @qc/api

The HTTP API: the only way the apps and the console reach the data. Built with Hono on Node, validated end to end with the Zod schemas in `@qc/contracts`.

Owned by the **api-core** lane ([brief](../../docs/agents/briefs/api-core.md)), except `src/auth/` and `src/modules/auth/`, which belong to **auth-scopes** ([brief](../../docs/agents/briefs/auth-scopes.md)).

## Layout

| Path              | What it is                                                                                                                                                   |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/index.ts`    | The server entry: reads the environment, connects to Postgres and pg-boss, starts listening                                                                  |
| `src/app.ts`      | Builds the Hono app (used by the server and the tests)                                                                                                       |
| `src/auth/`       | Phone codes, tokens, sessions, rate limits (decision 0002)                                                                                                   |
| `src/middleware/` | CORS, logging, rate limits, request ids, error handling, the sign-in adapter                                                                                 |
| `src/modules/`    | One folder per area: places, venues, sessions, circles, registrations, attendance, updates, posters, reading, roles, import, oversight, settings, me, system |

Every endpoint is registered through the route binder in `src/modules/shared` ([decision 0011](../../docs/engineering/decisions/0011-api-core-route-binder.md)): rate limit, sign-in, parse, authorise through the scope matrix, run, validate the response.

## Run and test

```sh
pnpm --filter @qc/api test                       # no setup: database tests use in-process PGlite
```

To run the server locally see [Getting started](../../docs/getting-started.md#2-api). Every variable it reads is in [`infra/ENV.md`](../../infra/ENV.md).
