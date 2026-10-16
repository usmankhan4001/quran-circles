# Brief: auth-scopes

Lane: auth-scopes
Work packages: WP3
Wave: 2
Priority: P0
Approval: human, for the whole lane

## Goal

Phone-code sign-in, sessions, coordinator invites, roles, and a scope engine that implements the role-and-scope matrix exactly. Every authorisation decision in the API goes through your `authorize()`. A leak here is the worst bug in the product, so this lane is tested hardest and reviewed by a human.

## You own

`apps/api/src/auth/` and `apps/api/src/modules/auth/`.

## You must not touch

The other API modules (api-core lane) and `packages/*`.

## Read first

`docs/product/decisions.md` (roles, accounts, coordinators), `docs/product/data-model.md` (role_assignments, audit_log), the frozen scope matrix in `packages/contracts`, `docs/engineering/conventions.md`.

## Deliverables

1. **Decision record first.** `docs/engineering/decisions/0002-auth-approach.md`: evaluate a library (for example Better Auth) against hand-built sessions. Pick one and say why. Wait for the orchestrator's approval before implementing.
2. **Code delivery.** Send sign-in codes through the provider interface in `@qc/messaging` (a WhatsApp authentication template, an SMS gateway fallback, and a test mode for staging and tests). Codes are short-lived, single-use and hashed at rest.
3. **Sign-in flow.** Request code, verify code, refresh, sign out, from the contract. Sessions suitable for the mobile apps, the PWA and the console.
4. **Abuse protection.** Rate limits per phone number and per address on code requests and verification attempts, lockouts with backoff, and no information leak about whether a number has an account.
5. **Roles and invites.** An admin invites a coordinator with a scope (a city or a venue). The invite is accepted by signing in with the invited number. Role assignment and revocation, audited.
6. **Scope engine.** `authorize(principal, action, resource)` driven by `scopes.ts`. A city coordinator acts on everything under their city, a venue coordinator under their venue, a national admin everywhere. Revoking a role takes effect immediately, including handover.
7. **Account deletion.** Removes personal data and keeps only anonymised counts, as the contract specifies.
8. **Test matrix.** Generated from `scopes.ts`: every role against every action against in-scope and out-of-scope resources. The suite fails if an action is added to the matrix without a test.

## Definition of done

- The scope-rule tests pass for every role, and the matrix test is generated, not hand-written.
- No endpoint authorises by checking a role directly.
- Rate limits and lockouts are tested.
- A human has reviewed the whole lane and approved it.

## Commands that must pass

```sh
pnpm check
pnpm --filter @qc/api test
```

## Decisions to respect

The verified phone number is the account (E.164). Attendees may browse without an account; registering and following require one. Coordinators are invited, never self-registered. Never log phone numbers, codes or tokens.

## Stand-ins

WhatsApp not verified yet: use the SMS fallback or the test mode. Messaging package not ready: code against the provider interface and use its fake.
