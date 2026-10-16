# Brief: contracts

Lane: contracts
Work packages: WP1
Wave: 1 (runs alone)
Priority: P0
Approval: human, for the whole lane

## Goal

Write and freeze the contracts every other lane builds on: the database schema, the API contract, the role-and-scope matrix, message and notification formats, error codes, and the generated client and mock server. A mistake here costs every lane, so this wave gets the closest human review.

## You own

`packages/contracts/`, `packages/db/`, and `docs/engineering/i18n-keys.md`.

## You must not touch

`apps/`, `packages/ui/`, `packages/messaging/`, `packages/content/`. You may add error-code message keys to `packages/i18n/`.

## Read first

All of `docs/product/`, `docs/engineering/contracts-process.md`, `docs/engineering/conventions.md`.

## Deliverables

1. **Schema.** Drizzle tables for everything in `docs/product/data-model.md`, with foreign keys, uniqueness (verified phone, one active circle request per person per area), indexes for the list queries (venues by city and area, sessions by day, registrations by session), and UTC timestamps.
2. **Migrations.** Reversible SQL, plus `pnpm --filter @qc/db migrate` and `rollback`.
3. **Seed.** Pakistan's provinces, the V1 cities (Rawalpindi, Islamabad, Multan, Faisalabad, Wah Cantt, Murree, Kot Addu, Abbottabad, Lahore), and a small synthetic set of areas, venues and sessions for development. No real people.
4. **API contract.** Zod schemas, with OpenAPI generated from them, for every P0 endpoint: sign-in (request code, verify, refresh, sign out, delete account); places; venues; sessions and occurrences with filters for city, area, day and time, section and language; registrations (create, list mine, cancel, list for a session in scope, export); consents; follows and alerts; updates and feed with unread counts and mark-read; devices; admin operations (invite coordinator, assign role, create or edit venue, create or edit circle with approval, change session time, post update, mark attendance); profile, bookmarks and reading positions; the Hijri offset setting.
5. **Scope matrix.** `scopes.ts` lists every action by role and resource scope, and a generated markdown table. It is the one source for the API, the apps and the tests.
6. **Message formats.** Outbox payload types, template ids and their variables, push payload shape, deep link formats.
7. **Error codes.** Stable names, HTTP statuses, and English and Urdu message keys (Urdu as draft).
8. **Key rules.** `docs/engineering/i18n-keys.md`: namespaces by screen, plurals, placeholders.
9. **Client and mock.** A generated typed API client, and a mock server generated from the contract that serves realistic synthetic data for every endpoint, including error cases.
10. **Contract tests.** The mock's responses validate against the schemas, and a test fails when an endpoint exists in one place but not the other.

## Definition of done

Matches Gate 1: the schema migrates up and back cleanly; the contract covers every P0 endpoint; a human has reviewed the scope matrix; the mock serves every endpoint; error codes and message formats are agreed. After the gate, the contracts change only through a change request.

## Commands that must pass

```sh
pnpm check
pnpm --filter @qc/db migrate && pnpm --filter @qc/db rollback
pnpm --filter @qc/contracts test
```

Run migrations against the dev Postgres from `infra/docker-compose.dev.yml`.

## Decisions to respect

Plain Postgres, no vendor SDKs. Phone numbers in E.164. UTC everywhere. Area is required at registration. Consent rows carry channel, purpose, granted and revoked times. Teacher is an optional name on a circle, not an account. See `docs/product/decisions.md`.

## Stand-ins

None. This lane runs alone, and nothing else starts until Gate 1.
