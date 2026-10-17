# @qc/db

The Postgres schema (Drizzle), the migrations, the synthetic seed, the shared scheduled jobs, and
the command that creates the first national admin. Owned by the contracts lane.

Every command runs from `v2/` and reads `DATABASE_URL` (default: the development database in
`infra/docker-compose.dev.yml`). A `v2/.env` file is loaded if there is one; variables already
set in the environment win.

| Command                                                        | What it does                                  |
| -------------------------------------------------------------- | --------------------------------------------- |
| `pnpm --filter @qc/db migrate`                                 | Applies every pending migration.              |
| `pnpm --filter @qc/db rollback [--steps N \| --all]`           | Rolls back the last migration (or N, or all). |
| `pnpm --filter @qc/db seed [--anchor DATE \| --fixture-dates]` | Inserts the synthetic development data.       |
| `pnpm --filter @qc/db bootstrap-admin --phone <E.164>`         | Invites the first national admin (see below). |
| `pnpm --filter @qc/db generate`                                | Generates a migration from a schema change.   |

## First national admin (`bootstrap-admin`)

A fresh database has no staff, and the API grants roles only to callers who already hold one. To
start, invite the first national admin from the command line:

```sh
DATABASE_URL=postgres://... pnpm --filter @qc/db bootstrap-admin --phone +923000000001
```

It creates the same pending national-admin invite that the console's invite creates (valid for
7 days) and writes a `role.invite` audit row with no actor and `source: "bootstrap-admin"`. The
person then signs in to the console or the admin app with a code; sign-in turns the invite into
the role, as for any invited coordinator. No WhatsApp invitation is sent: tell the person to sign
in. Running it again for the same number replaces the pending invite.

It prints only the invite id, never the phone number. It refuses:

- when an active national admin already exists. Add more admins from the console; pass
  `--force-additional` only to recover (for example when every admin has lost their phone);
- when `APP_ENV` or `NODE_ENV` is `production`, unless `--yes` is passed;
- a number that is not E.164, or that already holds the national admin role.

The function behind it is `bootstrapNationalAdmin(db, { phone, forceAdditional, confirmProduction })`.

## Seed dates

The seed copies the contract fixtures, which are dated around Monday 15 February 2027. The seed
command moves every date by whole weeks so the fixtures' first day is the Monday of the current
week (Pakistan date): seeded sessions then have occurrences this week and next, and the feed
updates are a few days old. Weekdays and wall-clock times stay the same.

- `--anchor 2026-10-17` (or an ISO instant) seeds for the week of that date instead.
- `--fixture-dates` keeps the February 2027 dates, the ones the mock server serves.
- `seedDatabase(db, { anchor })` does the same in code; without `anchor` it keeps the fixture
  dates, so tests are deterministic.

The seed is idempotent: a second run adds nothing, whatever the anchor. Reseed an empty database
to move the dates again. It refuses to run in production.

## Tests

`pnpm --filter @qc/db test` runs everything on PGlite (in-process Postgres) with the real
migrations. `@qc/db/testing` exports `guardTransactions(pglite)`, which makes a PGlite
transaction refuse overlapping queries the way node-postgres 9 will; the API, worker and db test
databases all use it.
