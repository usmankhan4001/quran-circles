# Status: contracts

Updated: 2026-10-16
Branch: claude/peaceful-archimedes-ain95k

## Done

- API contract: 64 endpoints in `packages/contracts/src/endpoints.ts`, with Zod request and response schemas, error lists, rate-limit buckets and idempotency flags.
- OpenAPI 3.1 generated into `packages/contracts/openapi.json` (`pnpm --filter @qc/contracts gen`), kept in sync by a test.
- Scope matrix in `packages/contracts/src/scopes.ts` (`can`, `scopeFilter`), generated table in `packages/contracts/SCOPES.md`, tested for every role against every action.
- Error codes (24, stable statuses) with English and Urdu draft messages in `packages/i18n` (`errors.<code>`).
- Message formats: outbox payloads, 8 template ids with variables and English/Urdu draft wording, push payload, deep links.
- Typed client (`createApiClient`) and a mock server generated from the contract (`pnpm --filter @qc/contracts mock`, port 4010), serving fixtures for discovery endpoints and generated data for the rest, with every error case reachable through `x-mock-error`.
- Fixtures: synthetic provinces, the nine V1 cities, areas, sample venues, circles, sessions, occurrences, content, updates.
- Contract tests: registry vs OpenAPI vs scopes vs mock vs client; fixtures validate against schemas.
- Key rules in `docs/engineering/i18n-keys.md`.
- Database schema and migrations: built by a parallel agent in `packages/db` (see the db section of the lane report).

## In progress

- Seed from fixtures in `packages/db` after the schema lands.

## Blocked

- Gate 1 needs a human to review the role-and-scope matrix (`packages/contracts/SCOPES.md`). Wave 2 lanes were started provisionally at the owner's request; any change to the matrix after review is a contract change request.

## Questions for the orchestrator

- Posters, message-template editing, content-page editing, reports, bulk import and the demand map are not in the P0 contract. The lanes that need them (console WP7/WP15/WP19, renderer WP16) file change requests.
- Confirm the Hijri offset range (-2 to +2 days) and the OTP rules: 6 digits, channel WhatsApp with SMS fallback.
- Contract version is `1.0.0-rc.1` until Gate 1 is signed.

## Contract change requests

- None yet.
