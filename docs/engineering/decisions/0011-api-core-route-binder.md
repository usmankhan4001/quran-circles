# 0011: API core, a route binder driven by the endpoint registry

Status: proposed
Date: 2026-10-16 (unknown-reference rule updated 2026-10-17 for contract 1.0.0-rc.3)
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
4. self endpoints (`auth: 'user'`) are checked with `can` here; staff endpoints must decide in the handler through `ctx.authorize`, `ctx.scope`, `ctx.missing`, `ctx.unknownRef` or (for row-by-row requests such as the bulk import) `ctx.qualify` followed by `ctx.allowed` per row. A staff handler that never decides gets `internal_error`, so a forgotten check fails closed;
5. the handler runs; its result is parsed with the endpoint's success schema before it is sent, and a mismatch is `internal_error` with only the field paths logged.

Handlers never read roles. `ctx.authorize(action, resource)` and `ctx.scope(action)` are the only doors, and they call `can` and `scopeFilter` from `@qc/contracts`. `apps/api/src/auth/no-direct-role-checks.test.ts` scans the source for anything else.

An id that does not exist answers by who is asking: `forbidden` for a person with no qualifying role at all, `not_found` for anyone who holds a role that qualifies for the action somewhere. The same rule covers every place an id can appear:

- in the path (`ctx.missing`), for example `adminSessions.get` or `registrations.forSession`;
- in the body or the query (`ctx.unknownRef`), for example the venue of `adminSessions.create`, the place or `replacesAssignmentId` of `adminRoles.invite`, or the `cityId` and `venueId` filters of `adminRegistrations.export`.

The contract lists `not_found` on every endpoint that does this (since 1.0.0-rc.2 for the body references, and 1.0.0-rc.3 for the export's query filters), and the test harness fails any call that answers a code its endpoint does not list. Before rc.2 the body case answered `validation_failed` on the field; that is gone. Ids are random UUIDs, so telling staff that one does not exist reveals nothing, while an outsider still learns nothing at all. A known record outside the caller's scope stays `forbidden` on writes and filters (and `not_found` on the scoped single-record reads, so the record's existence is not revealed).

Two exceptions keep their own shape. The bulk import decides row by row, so an unknown id there is the row issue `invalid_reference` (with `forbidden` checked first, so an outsider never learns whether the id exists), never a whole-request error. And a handover whose `replacesAssignmentId` names an ended assignment or one at another place answers `not_found`, the same as an unknown id, so a coordinator learns nothing about other places.

Errors are `ApiException(code)` only; the error handler maps it to the contract body with the request id. Nothing free text reaches a client. Every response carries `x-request-id`; a safe incoming id is kept.

Time is injected (`deps.now`), so tests control it. Tests run on PGlite with the real migrations. The test harness checks every call made through `h.api(id)` against the contract (status, response schema, `errorsFor`, request-id header), and one test compares the routes with the registry.

## Consequences

Adding an endpoint to the registry without a handler fails `contract.test.ts` at once. A handler cannot return a shape the registry does not describe. The cost is that every handler is written in the binder's style, and an endpoint that needs something unusual (a CSV body, a custom header) goes through `ctx.header` and the registry's `contentType`, not around the binder. The in-memory rate limiter sits behind an interface; more than one API process needs a shared store.
