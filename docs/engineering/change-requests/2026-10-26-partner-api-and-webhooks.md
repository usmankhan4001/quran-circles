# Change request: partner API key, change feed and outbound webhooks

Requested by: docs (public documentation, ERPNext integration guide)
Contract: API (new endpoints, a signed delivery format), scopes (a new actor and actions), schema (keys, webhook endpoints, deliveries), error codes (a few)
Status: **proposal, not approved.** It touches sign-in, scope checks and personal data, so it needs an owner decision, the auth-scopes and messaging lanes, a security review and a human approval. Nothing here is built. It is the shape the ERPNext guide (`docs/public/content/en/erpnext.md`) points to.

## What I need

A way for a partner system (first case: Muhammad's ERPNext site) to read Quran Circles data, and later to be told when it changes, without borrowing a person's login.

## Why

Checked against `packages/contracts` (version 1.0.0-rc.5), `apps/api`, `apps/worker` and the repository's documents:

- The only sign-in is a person with a phone number and a WhatsApp code (`auth.requestCode`, `auth.verifyCode`). There is no service account, API key or client secret.
- Public endpoints cover venues, sessions, occurrences and places only. People, registrations and attendance are staff-only (`registration.list`, `registration.export`, `attendance.read`).
- There is no "changed since" filter on any list, and no outbound webhook. The only webhook is Meta's into the worker (`apps/worker/src/whatsapp/handler.ts`).
- CORS allows only Quran Circles' own web addresses.
- A shared coordinator login would expose every registrant's number in its scope and break the audit trail.

## Proposed change

All of it is open to change. The owner has said the direction, records and fields for ERPNext are not defined yet, so this is a possible shape, not a decision. Build in this order, each step reviewable on its own.

### 1. Partner keys (scopes, schema)

- New actor `integration` in `scopes.ts`, separate from the three staff roles, with a small action set. First release, read only: `partner.read_sessions`, and (only if approved after the privacy question) `partner.read_registrations`. Never role, invite, message, export, import or settings actions.
- Table `partner_keys`: `id`, `name`, `key_hash` (SHA-256 of a random 32-byte secret, shown once), `prefix` (first 8 characters, for display), `scope_type` (`national` or `city`), `city_id`, `actions` (list), `rate_limit_per_minute`, `allowed_cidrs` (optional list), `created_by`, `created_at`, `last_used_at`, `revoked_at`.
- `Authorization: Bearer <prefix>.<secret>`, compared by hash in constant time; the principal carries the key's actions and place, so `can()` and `scopeFilter()` stay the single decision.
- A national admin creates, rotates and revokes keys in the console; each is one audit row. A revoked key stops at once.
- Own rate-limit bucket (`partner`), keyed by key id, never by address alone. Never logged: the key, the secret or any returned personal data.

### 2. Change feed (API)

- `GET /v1/partner/sessions?updatedSince=<instant>&cursor=&limit=` returns sessions with their venue and next dates, plus `deletedAt` or a status for cancelled and archived ones, so nothing disappears silently.
- If approved: `GET /v1/partner/registrations?updatedSince=...` returning `id`, `sessionId`, `occurrenceId`, `section`, `status`, `createdAt`, `cancelledAt` and, only with a documented legal basis and consent, a hashed or minimal person reference instead of name and number.
- Ordered by `updatedAt, id`, cursor-based, page size capped at 100, stable under writes.
- New columns or indexes: `updated_at` indexes on the tables read; tombstones where rows are hard-deleted today.

### 3. Outbound webhooks (worker, schema)

- Table `webhook_endpoints` (`url` must be HTTPS and must pass the same private-address checks as web push, SEC-01), `secret_hash` or an encrypted secret, `events`, `partner_key_id`, `active`; table `webhook_deliveries` (`id`, `endpoint_id`, `event`, `payload`, `status`, `attempts`, `next_attempt_at`, `last_status_code`).
- Events (final list from the ERPNext questions): `registration.created`, `registration.cancelled`, `session.created`, `session.updated`, `session.cancelled`, `attendance.recorded`.
- Delivered by the worker through the outbox pattern (ADR 0005): idempotency key per delivery, retry with backoff for 24 hours, then a dead-letter state an admin can see and replay.
- Headers: `X-QC-Event`, `X-QC-Delivery` (id), `X-QC-Timestamp` (Unix seconds), `X-QC-Signature` (hex HMAC-SHA256 over `timestamp + "." + raw body`). Receivers reject timestamps older than 5 minutes and compare in constant time.
- Payloads carry ids and the changed fields only, never free text from members.

### 4. Error codes and i18n

Probably none new: `unauthenticated`, `forbidden`, `rate_limited` cover keys. If a revoked key needs a distinct answer, one new code (`key_revoked`, 401).

## Affected lanes

contracts (schema, endpoints, scopes, openapi), db (migrations), auth-scopes (key verification, the actor), api-core (feed endpoints), messaging (webhook delivery), console (key and endpoint management pages, English and Urdu strings), quality (security review, load test of the feed), docs (guide update).

## Workaround meanwhile

The ERPNext guide offers Option 1: a scheduled pull of the **public** catalogue (venues, sessions, occurrences) into ERPNext, which needs no change here. The guide lists what is not possible until this lands.

## Decisions needed

1. Does the owner want a partner API at all in this phase, or only Option 1?
2. May any personal data (even a hashed reference) leave Quran Circles for ERPNext? This also changes the privacy policy.
3. Which events, and does ERPNext need real time?
4. Who builds the Frappe side?
