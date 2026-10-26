# Getting started

How to set up the repository, run each part on your own machine and run the tests. Every command runs from the repository root unless it says otherwise. For what each folder holds, see the [repository map](engineering/repo-map.md).

## What you need

- **Node 22** (the major version is in `.nvmrc`; `package.json` asks for 22 or newer). Use nvm, fnm or Volta.
- **pnpm 10** through Corepack: `corepack enable`. The exact version is pinned in `package.json` (`packageManager`).
- **Docker**, for the local Postgres. The dev compose file runs Postgres 17 and the production compose file pins 17.6, so use 17 if you bring your own server (set `DATABASE_URL` in `.env`). The CI end-to-end job still starts Postgres 16, and `architecture.md` and `deployment.md` still say 16.
- Optional: the Expo Go app or an emulator for the phone apps; k6 for the k6 version of the load test.

**Windows:** the shell snippets below are Bash. Use Git Bash or WSL for the multi-line API and worker commands, or set the variables with `$env:NAME = 'value'` in PowerShell first. The repository is stored with LF line endings; see [Contributing](../CONTRIBUTING.md#line-endings-on-windows).

## Install and check

```sh
corepack enable
pnpm install
pnpm check
```

`pnpm check` runs the typecheck, lint, every package's unit tests and the Prettier check. It must pass before any change is merged. The poster renderer's tests render with real headless Chromium; if they fail on a fresh machine, install the browser once with `pnpm --filter @qc/poster-renderer exec playwright-core install --only-shell chromium`.

## Option 1: apps against the mock API (no database)

`@qc/contracts` ships a mock server that answers every endpoint in the contract with realistic fake data. It is the quickest way to work on screens. Run each command in its own terminal.

```sh
pnpm --filter @qc/user-app mock                                   # mock API on http://localhost:4010
EXPO_PUBLIC_API_URL=http://localhost:4010 pnpm --filter @qc/user-app web
EXPO_PUBLIC_API_URL=http://localhost:4010 pnpm --filter @qc/admin-app web
pnpm --filter @qc/console dev                                     # Vite, proxies /v1 to the mock on :4010
```

Use `start` instead of `web` to open the Expo apps on a phone or an emulator. `pnpm --filter @qc/contracts mock` runs the same mock server from the contracts package.

## Option 2: the real stack on a local Postgres

### 1. Database

```sh
docker compose -f infra/docker-compose.dev.yml up -d              # Postgres 17 on 127.0.0.1:5432
cp .env.example .env                                              # development-only values (PowerShell: Copy-Item .env.example .env)
pnpm --filter @qc/db migrate                                      # apply the SQL migrations
pnpm --filter @qc/db seed                                         # synthetic places, venues and sessions
```

The seed is synthetic and idempotent. See [`packages/db/README.md`](../packages/db/README.md) for rollback, reseeding and `bootstrap-admin`.

### 2. API

The API and the worker have no `dev` script. Run them from their own folder with `tsx`, and load the root `.env` with `--env-file`. The API needs a few settings beyond `.env`. For local work use test mode: every sign-in code is the fixed value and nothing is sent.

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

A fresh database has no staff. Create a pending national-admin invite for a test number and a test email address:

```sh
pnpm --filter @qc/db bootstrap-admin --phone +923000000001 --email admin@example.org
```

Sign-in codes go by email. Open the console (or the admin app) and sign in with that email address and the fixed code `123456`. The first sign-in with an email also asks for a WhatsApp number; enter the same test number. The invite turns into the national-admin role at that sign-in. The command prints only the invite id.

### 4. Worker (optional)

The worker sends reminders and push, tops up session occurrences and hands poster jobs to the renderer. With `MESSAGING_MODE=fake` it sends nothing real.

```sh
cd apps/worker
APP_ENV=development MESSAGING_MODE=fake WORKER_HTTP_PORT=8082 \
pnpm exec tsx --env-file=../../.env src/main.ts
```

`WORKER_HTTP_PORT` defaults to 8081, which is also Expo's web port, so pick another one when you run both. The worker answers `/healthz` on that port.

### 5. Poster renderer (optional)

The renderer treats an unset `APP_ENV` as production and then refuses to start without a token, so set `APP_ENV=development`:

```sh
APP_ENV=development pnpm --filter @qc/poster-renderer start       # http://localhost:8090
pnpm --filter @qc/poster-renderer render:sample [out-dir]         # writes sample posters (default: a folder under the OS temp dir)
```

For the worker to use it, put `RENDERER_URL`, `RENDERER_TOKEN` and `POSTER_STORAGE_DIR` in `.env` (commented examples are in `.env.example`) and start the renderer with the same `RENDERER_TOKEN` in its own environment; it does not read `.env`. Without all three the worker still starts, and poster jobs fail with a log line naming the missing ones.

### 6. Apps against the local API

```sh
EXPO_PUBLIC_API_URL=http://localhost:3000 pnpm --filter @qc/user-app web
EXPO_PUBLIC_API_URL=http://localhost:3000 pnpm --filter @qc/admin-app web
CONSOLE_API_PROXY_TARGET=http://localhost:3000 pnpm --filter @qc/console dev
```

When an app runs in a browser on another port, add its origin to the API's `CORS_ORIGINS` (comma-separated).

## Tests and other checks

| Command                                      | What it runs                                                                                        |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `pnpm test`                                  | Unit and integration tests of every package except `@qc/e2e` (Vitest), no network                   |
| `pnpm --filter @qc/api test`                 | One package's tests. The API's database tests use in-process PGlite, so they need no Postgres       |
| `pnpm e2e`                                   | End-to-end: starts a private Postgres, the API, the worker and the web builds, then runs Playwright |
| `pnpm --filter @qc/e2e stack`                | Starts the e2e stack and keeps it running; then `E2E_REUSE_STACK=1 pnpm e2e`                        |
| `pnpm --filter @qc/load local`               | Scope verification and the load scenario against a private local stack                              |
| `pnpm --filter @qc/ui catalog`               | Builds the component catalog page (`packages/ui/build/catalog/index.html`)                          |
| `pnpm --filter @qc/messaging email:previews` | Renders every branded email template for a visual check                                             |
| `node docs/public/build.mjs --out <folder>`  | Builds the public documentation site (see [`docs/public/README.md`](public/README.md))              |
| `pnpm env:check`                             | Checks that every variable in the `.env.example` files is documented in `infra/ENV.md`              |

The e2e suite needs a Postgres. Set `E2E_DATABASE_URL` to the dev database from step 1 (`postgres://qc:qc@localhost:5432/qc`; the suite creates its own database on that server and drops it afterwards), or have the Postgres server binaries (`initdb`, `pg_ctl`) on your machine. The e2e and load suites are kept out of `pnpm check` because they start real services. Their own READMEs ([`tests/e2e`](../tests/e2e/README.md), [`tests/load`](../tests/load/README.md)) list the options.

## Rules worth knowing before your first change

- Every user-facing string goes through `@qc/i18n`, with the English and Urdu keys added together.
- Screens must work left to right and right to left, at all four text sizes, in light and dark.
- Never put secrets, real phone numbers or personal data in code, tests, fixtures, logs or docs.
- Each directory has one owning lane. Read [Contributing](../CONTRIBUTING.md) before editing outside your own.
- Do not push to `main`. Dokploy pulls it with auto-deploy on, so every push is a release. The rules are in [Contributing](../CONTRIBUTING.md#branches-and-releases).

## Troubleshooting

- **`DATABASE_URL is not set`**: you started the API without `--env-file`, or `.env` is missing.
- **`../../.env: not found`**: Node could not open the file you gave to `--env-file`. Run `cp .env.example .env` from the repository root, and start the API or worker from `apps/api` or `apps/worker`.
- **`AUTH_SECRET is not set`**: the API needs `AUTH_SECRET` (32 or more characters) in every environment.
- **`Invalid renderer environment: RENDERER_TOKEN is required`**: start the renderer with `APP_ENV=development`.
- **`Bind for 127.0.0.1:5432 failed: port is already allocated`**: another Postgres already uses port 5432. Stop it, or point `DATABASE_URL` at it and skip step 1.
- **Port 8081 in use**: Expo web and the worker both default to it; set `WORKER_HTTP_PORT`.
- **Format check fails**: run `pnpm format` and commit the result.
