# Status: auth-scopes

Updated: 2026-10-17
Branch: claude/peaceful-archimedes-ain95k (orchestrator commits; lane branch name to be set by the orchestrator)

## Done (2026-10-17: contract 1.0.0-rc.4 follow-up, change request `auth-purge-to-db`)

- `loadMe` (`modules/auth/me.ts`) now sends `profile.dailyGoal` (`{ unit, amount }` when both profile columns are set, else null) and `profile.memorisationReviseAfterDays` (the column, or null), the same mapping as api-core's `getMe` in `modules/me/profile.ts`. The sign-in response's `Me` therefore matches `GET /v1/me`. Tests in the new `modules/auth/me.test.ts` (6): new account sends both as present nulls, a saved goal and setting come back through sign-in (parsed with `SignInResponse`), a profile row without them gives nulls, every goal unit, a revision setting without a goal, no profile row, unknown user.
- `purgeStaleAuthRows` moved to `@qc/db` (`packages/db/src/jobs/auth-purge.ts`), behaviour unchanged (codes kept 1 day past expiry, expired or revoked sessions 30 days). `modules/auth/cleanup.ts` is now a re-export from `@qc/db`, so `apps/api/src/jobs.ts` and `auth/index.ts` keep working unchanged. `cleanup.test.ts` is kept as is: it checks the re-export against rows made by the real sign-in and sign-out flow; the rule is also tested row by row in `@qc/db`. The worker schedules it daily at 03:00 Pakistan time (see `status/messaging.md`).
- `@qc/api`: 610 tests in 30 files, typecheck, eslint and prettier clean for the lane's directories.

## Done (2026-10-17: contract 1.0.0-rc.2, migration 0008)

- Refresh grace (`auth-session-grace`): rotation moves the current hash into `previous_refresh_token_hash` and sets `rotated_at`. A match on the current hash rotates (compare-and-swap, up to three tries). A match on the previous hash within 10 s returns the very same pair: the next refresh token is derived deterministically (`sessionId.HMAC(refresh key, previous token)`), checked against the stored hash, and the access token is signed with `iat = rotated_at`, so no raw token is ever stored. A previous-hash match after 10 s is reuse and revokes the session. A token matching neither is `refresh_token_invalid` and revokes nothing. Tests cover the retry, reuse after the window, parallel refresh (both get the same pair), two tabs refreshing moments apart, and a suspended account.
- `otp_challenges.locale` is written from `auth.requestCode` and copied to `users.locale` when the account is created; an existing account keeps its language.
- New accounts get `display_name` null; an invite's name applies when the name is null (or the legacy `-`). `loadMe` returns null for no name. `UNNAMED_DISPLAY_NAME` is gone.
- Codes go WhatsApp first for everyone, staff included, with SMS fallback in `@qc/messaging`'s `ProviderCodeSender`, which now returns the channel it used; the response reports it.
- `authFailureReason(c)` is exported from `apps/api/src/auth/index.ts`; api-core's probe in `middleware/auth-lane.ts` is gone.
- Invite acceptance with `replacesAssignmentId` revokes the old assignment (live, same role and place, not the accepting person) in the sign-in transaction, with a `role.revoke` audit row (`reason: 'handover'`).
- Tests: the auth lane's suites run inside `@qc/api` (542 passing in 27 files).

## Done (earlier)

- Decision record `docs/engineering/decisions/0002-auth-approach.md`: hand-built on `jose` (HS256), not Better Auth. Status is proposed; it needs the orchestrator and human approval.
- Sign-in for the four contract endpoints, validated both ways with the `@qc/contracts` schemas and answering with contract error codes: `auth.requestCode`, `auth.verifyCode`, `auth.refresh`, `auth.signOut` (`apps/api/src/modules/auth/`).
- Codes: six digits, HMAC-hashed at rest and bound to the challenge, five minutes, five attempts counted atomically before comparing, single use, a new code retires the old ones. Resend wait with backoff (60 s, 120 s, 240 s, ... capped at 15 min) kept in the database.
- Abuse protection behind the `RateLimiter` interface (in-memory implementation): per number and per address, on requests and on verification. Identical answers whether or not a number has an account.
- Access tokens: HS256, 15 minutes, claims `sub`, `sid`, `iss`, `aud`, `iat`, `exp` only. Refresh tokens: `<sessionId>.<random>`, SHA-256 stored in `auth_sessions`, rotated in place with compare-and-swap, reuse revokes the session, sliding 30 days up to 180.
- Sign out revokes the session and the access token stops at once (every request checks the session).
- Coordinator invites: after a correct code, pending invites for the number become role assignments, are marked accepted and audited, in one transaction with the account and the session. An expired invite is marked expired and sign-in answers `invite_expired` (410) without using up the code; the next try signs in as an attendee.
- Scope wiring: `authMiddleware`, `requireAction`, `authRoutes`, `AuthVariables` exported from `apps/api/src/auth/index.ts`. Roles are read from `role_assignments` (not revoked) on every request, so revocation and handover are immediate. A suspended account gets `account_suspended`.
- `purgeStaleAuthRows(db, now)` for the worker to run daily. `loadMe(db, userId)` builds the contract's `Me`.
- 201 tests, all with PGlite and the real migrations (no external Postgres). Package-scoped typecheck for the lane's files, eslint and prettier are clean.

## In progress

- Nothing.

## Blocked

- Nothing. `pnpm --filter @qc/api typecheck` and `test` pass (2026-10-17).

## Interface for the api-core lane (all from `apps/api/src/auth/index.ts`)

```ts
authMiddleware(deps: AuthDeps): MiddlewareHandler<{ Variables: AuthVariables }>
requireAction(action: ScopeAction, resolveResource?: (c) => ResourceScope | Promise<ResourceScope>)
authRoutes(deps: AuthDeps): Hono<{ Variables: AuthVariables }>   // mount at the root
type AuthVariables = { principal: Principal | null; requestId: string }
```

- `authRoutes` serves the contract's own paths (`/v1/auth/code`, `/v1/auth/verify`, `/v1/auth/refresh`, `/v1/auth/sign-out`). Mount it with `app.route('/', authRoutes(deps))`, not under `/v1/auth`.
- `authMiddleware` never rejects. Without a valid token `principal` is null, so public endpoints work with a stale token. `requireAction` answers: no principal 401 `unauthenticated` (or `token_expired` / `account_suspended` when that is the reason), a principal who may not 403 `forbidden`. It is safe to run `authMiddleware` twice; it sets `requestId` itself if the host did not.
- `resolveResource` must return the true city and venue of the thing acted on (a venue-level resource carries both). The engine trusts what it is given.
- `AuthDeps = { db, config, codeSender, rateLimiter?, logger?, now?, clientIp? }`. `db` is the same `PgDatabase<PgQueryResultHKT, typeof schema>` as api-core's `Db`. Build the config with `loadAuthConfigFromEnv(process.env)`.
- Environment: `AUTH_SECRET` (required, 32+ characters), `APP_ENV` (`production` | `staging` | `development` | `test`; unset means production), `AUTH_FIXED_CODE` (test mode, six digits, refused when `APP_ENV` is production), `AUTH_TRUST_PROXY=true` behind Caddy (uses the last `X-Forwarded-For` entry for rate limits).
- `authFailureReason(c)` returns `unauthenticated`, `token_expired` or `account_suspended` for a request without a principal. `loadMe` is available if `me.get` should reuse it.

## CodeSender interface (for the messaging lane)

```ts
interface CodeSender {
  send(message: {
    phone: string;
    code: string;
    locale: 'en' | 'ur';
    channel: 'whatsapp' | 'sms';
  }): Promise<{ channel: 'whatsapp' | 'sms' } | void>;
}
```

- Throw when the provider did not accept the message: the lane answers `service_unavailable`, removes the challenge and logs only the error type. Return `{ channel }` when you fell back (for example WhatsApp to SMS) so the response tells the person where to look.
- The real implementation should send the `auth_code` template (`TEMPLATE_VARIABLES.auth_code`: `code`, `minutes` = 5) in `locale`. The lane never logs the phone or code, and the sender must not either.
- Included: `FakeCodeSender` (records messages, can fail on demand) and `DiscardCodeSender` (sends nothing; for staging with a fixed code). The lane imports nothing from `@qc/messaging` yet; wiring the real sender is the orchestrator's or messaging lane's one-line change in start-up.

## Behaviour worth knowing

- Reuse detection: the previous refresh token is accepted for 10 seconds after a rotation and answers with the same pair, so a lost response or two tabs refreshing together no longer sign the device out. After the window it is theft and revokes the session. A token two rotations old matches neither hash and is refused without revoking anything.
- The in-memory rate limiter resets on restart and is per process. The resend wait with backoff, the attempt counters and expiry live in the database and hold across restarts.
- New accounts get no name (null) and the language chosen on the code screen.
- Account deletion (`me.delete`) and admin invite creation/revocation (`adminRoles.*`) are not in this lane's code; api-core has them under `modules/me` and `modules/roles`. They must use `requireAction` or the adapter, and write audit rows.
- `apps/api/src/auth/no-direct-role-checks.test.ts` scans the API source outside the auth lane and fails if a handler compares roles or reads `principal.assignments`.

## Questions for the orchestrator

- Approve the decision record 0002 (hand-built on `jose`)?
- The brief says to wait for approval of the record before implementing. I implemented in parallel on your instruction; if the record is rejected, the token and session code is isolated in `auth/tokens.ts`, `auth/crypto.ts` and `modules/auth/sessions.ts`.
- Should an expired invitation block the first sign-in once (current behaviour: 410 `invite_expired`, then the same code works) or never block it? The contract has no other way to tell the person.
- Who wires `authRoutes`, `authMiddleware` and the real `CodeSender` into `apps/api/src/index.ts` (api-core owns that file)?

## Contract change requests

- Applied 2026-10-17: `auth-session-grace`, `users-display-name`, `otp-locale`, `auth-failure-reason`.
