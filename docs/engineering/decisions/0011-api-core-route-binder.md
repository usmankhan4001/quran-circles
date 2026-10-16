# 0011: API core, a route binder driven by the endpoint registry

Status: proposed
Date: 2026-10-16
Lane: api-core

## Context

The API has to serve 64 endpoints exactly as the frozen contract describes them: method, path, request shape, response shape, error codes, rate-limit bucket and the scope action behind each one. Hand-written routes drift from a contract, and nine lanes build against it.

## Options

- Write Hono routes by hand and add tests that compare them to the contract.
- Generate the routes from an OpenAPI document.
- Bind a handler to each registry entry at start-up, so method, path, validation and response parsing come from the registry itself.

## Decision

The third. `registerHandlers` takes a map `{ endpointId: handler }` and, for each entry, registers the registry's method and path and runs the same steps in the same order:

1. rate limit by the endpoint's `rateLimit` bucket (per person, or per address when signed out);
2. a signed-in endpoint without a principal answers 401 (`unauthenticated`, `token_expired` or `account_suspended`);
3. params, query and body are parsed with the registry's schemas; failures are `validation_failed` naming paths and issue codes, never values;
4. self endpoints (`auth: 'user'`) are checked with `can` here; staff endpoints must decide in the handler through `ctx.authorize`, `ctx.scope`, `ctx.missing` or `ctx.unknownRef`. A staff handler that never decides gets `internal_error`, so a forgotten check fails closed;
5. the handler runs; its result is parsed with the endpoint's success schema before it is sent, and a mismatch is `internal_error` with only the field paths logged.

Handlers never read roles. `ctx.authorize(action, resource)` and `ctx.scope(action)` are the only doors, and they call `can` and `scopeFilter` from `@qc/contracts`. `apps/api/src/auth/no-direct-role-checks.test.ts` scans the source for anything else.

An id that does not exist answers by who is asking: `forbidden` for a person with no qualifying role at all, `not_found` for staff in scope (`ctx.missing`). When the id is in the body of an endpoint that has no `not_found` in the contract, staff get `validation_failed` on the field (`ctx.unknownRef`).

Errors are `ApiException(code)` only; the error handler maps it to the contract body with the request id. Nothing free text reaches a client. Every response carries `x-request-id`; a safe incoming id is kept.

Time is injected (`deps.now`), so tests control it. Tests run on PGlite with the real migrations. The test harness checks every call made through `h.api(id)` against the contract (status, response schema, `errorsFor`, request-id header), and one test compares the routes with the registry.

## Consequences

Adding an endpoint to the registry without a handler fails `contract.test.ts` at once. A handler cannot return a shape the registry does not describe. The cost is that every handler is written in the binder's style, and an endpoint that needs something unusual (a CSV body, a custom header) goes through `ctx.header` and the registry's `contentType`, not around the binder. The in-memory rate limiter sits behind an interface; more than one API process needs a shared store.
