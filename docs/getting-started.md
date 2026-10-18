# Getting started

How to set up the repository, run each part on your own machine and run the tests. Every command runs from the repository root unless it says otherwise.

## What you need

- **Node 22** (the exact version is in `.nvmrc`). Use nvm, fnm or Volta.
- **pnpm 10** through Corepack: `corepack enable`. The version is pinned in `package.json`.
- **Docker**, for the local Postgres. Any Postgres 16 works if you prefer your own.
- Optional: the Expo Go app or an emulator for the phone apps; k6 for the load test.

## Install and check

```sh
corepack enable
pnpm install
pnpm check
```

`pnpm check` runs the typecheck, lint, every package's unit tests and the Prettier check. It must pass before any change is merged. The poster renderer's tests render with real headless Chromium; if they fail on a fresh machine, install the browser once with `pnpm --filter @qc/poster-renderer exec playwright-core install --only-shell chromium`.

## Option 1: apps against the mock API (no database)

`@qc/contracts` ships a mock server that answers every endpoint in the contract with realistic fake data. It is the quickest way to work on screens.

```sh
pnpm --filter @qc/user-app mock                                   # mock API on http://localhost:4010
EXPO_PUBLIC_API_URL=http://localhost:4010 pnpm --filter @qc/user-app web
EXPO_PUBLIC_API_URL=http://localhost:4010 pnpm --filter @qc/admin-app web
pnpm --filter @qc/console dev                                     # Vite, proxies /v1 to the mock
```

Use `start` instead of `web` to open the Expo apps on a phone or an emulator.

## Option 2: the real stack on a local Postgres

### 1. Database

```sh
docker compose -f infra/docker-compose.dev.yml up -d              # Postgres 16 on 127.0.0.1:5432
cp .env.example .env                                              # development-only values
pnpm --filter @qc/db migrate                                      # apply the SQL migrations
pnpm --filter @qc/db seed                                         # synthetic places, venues and sessions
```

The seed is synthetic and idempotent. See [`packages/db/README.md`](../packages/db/README.md) for rollback, reseeding and `bootstrap-admin`.

### 2. API

The API needs a few settings beyond `.env`. For local work use test mode, which accepts a fixed sign-in code and sends nothing:

```sh
cd apps/api
APP_ENV=development \
AUTH_SECRET=dev-only-secret-at-least-32-characters-long \
AUTH_FIXED_CODE=123456 \
MESSAGING_MODE=fake CODE_DELIVERY_MODE=test \
pnpm exec tsx --env-file=../../.env src/index.ts
```

Check it with `curl http://localhost:3000/health`, which answers `{"ok":true,"service":"api"}`. Every variable is described in [`infra/ENV.md`](../infra/ENV.md).

### 3. First admin

A fresh database has no staff. Create a pending national-admin invite for a test number, then sign in to the console or the admin app with that number and the fixed code:

```sh
pnpm --filter @qc/db bootstrap-admin --phone +923000000001
```

### 4. Worker (optional)

The worker sends reminders and push, tops up session occurrences and hands poster jobs to the renderer. With `MESSAGING_MODE=fake` it sends nothing real.

```sh
cd apps/worker
APP_ENV=development MESSAGING_MODE=fake WORKER_HTTP_PORT=8082 \
pnpm exec tsx --env-file=../../.env src/main.ts
```

`WORKER_HTTP_PORT` defaults to 8081, which is also Expo's web port, so pick another one when you run both.

### 5. Poster renderer (optional)

```sh
pnpm --filter @qc/poster-renderer start                           # http://localhost:8090
pnpm --filter @qc/poster-renderer render:sample                   # writes sample posters
```

For the worker to use it, set `RENDERER_URL`, `RENDERER_TOKEN` and `POSTER_STORAGE_DIR` (names in `.env.example`).

### 6. Apps against the local API

```sh
EXPO_PUBLIC_API_URL=http://localhost:3000 pnpm --filter @qc/user-app web
CONSOLE_API_PROXY_TARGET=http://localhost:3000 pnpm --filter @qc/console dev
```

When an app runs in a browser on another port, add its origin to the API's `CORS_ORIGINS` (comma-separated).

## Tests

| Command                        | What it runs                                                                              |
| ------------------------------ | ----------------------------------------------------------------------------------------- |
| `pnpm test`                    | Unit and integration tests of every package (Vitest), no network                          |
| `pnpm --filter @qc/api test`   | One package's tests                                                                       |
| `pnpm e2e`                     | End-to-end: starts Postgres, the API, the worker and the web builds, then runs Playwright |
| `pnpm --filter @qc/e2e stack`  | Starts the e2e stack and keeps it running; then `E2E_REUSE_STACK=1 pnpm e2e`              |
| `pnpm --filter @qc/load local` | Scope verification and the load scenario against a private local stack                    |
| `pnpm --filter @qc/ui catalog` | Builds the component catalog page (`packages/ui/build/catalog/index.html`)                |

The e2e and load suites are kept out of `pnpm check` because they start real services. Their own READMEs ([`tests/e2e`](../tests/e2e/README.md), [`tests/load`](../tests/load/README.md)) list the options.

## Rules worth knowing before your first change

- Every user-facing string goes through `@qc/i18n`, with the English and Urdu keys added together.
- Screens must work left to right and right to left, at all four text sizes, in light and dark.
- Never put secrets, real phone numbers or personal data in code, tests, fixtures, logs or docs.
- Each directory has one owning lane. Read [Contributing](../CONTRIBUTING.md) before editing outside your own.

## Troubleshooting

- **`DATABASE_URL is not set`**: you started the API without `--env-file`, or `.env` is missing.
- **`AUTH_SECRET is not set`**: the API needs `AUTH_SECRET` (32 or more characters) in every environment.
- **Port 8081 in use**: Expo web and the worker both default to it; set `WORKER_HTTP_PORT`.
- **Format check fails**: run `pnpm format` and commit the result.
