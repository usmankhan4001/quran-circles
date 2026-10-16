# Engineering conventions

## Language and tooling

- TypeScript strict, ESM. Node 22. pnpm workspaces.
- TypeScript is pinned to 5.9 because typescript-eslint and the Expo tooling do not yet support 6 or 7. Re-evaluate in a decision record before upgrading.
- ESLint and Prettier run in CI. `pnpm format` fixes formatting.
- Tests use Vitest. Mobile and web flows use Playwright and Maestro, owned by the integration lane.

## API

- Hono routes validate every request and response with the Zod schemas in `@qc/contracts`. No handler reads raw input.
- Errors use the error codes from the contract, never free text.
- Authorisation goes through the scope engine from the auth-scopes lane. A handler never checks roles by hand.
- Rate limits on sign-in codes, registration and messaging endpoints.
- No business logic in route files: handlers call functions in the module.

## Database

- Drizzle schema in `packages/db`. SQL migrations are reversible and are never edited after they have been applied.
- All access goes through the API or the worker. Apps never connect to the database.
- Personal data lives only in the tables named in `docs/product/data-model.md`.

## Apps

- Apps talk to the API through the generated client from `@qc/contracts`. No hand-written fetch calls.
- Every string uses `@qc/i18n`. Every screen works left-to-right and right-to-left, in light and dark, at four text sizes.
- Use the components and tokens from `@qc/ui`. Do not add UI libraries without a decision record.
- No secrets in app code. Public configuration only.

## Logging and personal data

- Never log phone numbers, names, message bodies or tokens.
- Audit rows record who did what, not the personal data they touched.
- Test data is synthetic. Fixtures never contain real people.

## Tests

- Test the failure paths, not only the happy path.
- Scope and authorisation code needs a test for every role against every action it guards.
- Do not skip, disable or delete a failing test. Fix it or raise it.
- Tests use fake providers from `@qc/messaging`. They never call Meta, Google, Apple or SMS services.

## Decision records

Record any real choice in `docs/engineering/decisions/` as a short numbered file. See `decisions/README.md`.
