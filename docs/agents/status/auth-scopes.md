# Status: auth-scopes

Updated: 2026-10-25 (SEC-22 handover semantics, done in api-core)
Branch: claude/peaceful-archimedes-ain95k (orchestrator commits; lane branch name to be set by the orchestrator)

## Done (2026-10-25: sign-in code by email, change request `email-otp`)

- Branch `lane/auth/email-otp`. Email is the identity and code channel; WhatsApp sign-in is behind `AUTH_PHONE_SIGN_IN` (default off). `requestCode` and `verifyCode` work on a `CodeTarget` (email or phone) with the same limits, caps and expiry; a new email account sends its WhatsApp number with the request (`claimed_phone_e164`) and verify answers `phone_required` / `phone_in_use`. Invites accept by verified email, or by phone only when `phone_verified_at` is set. `Me.email`, `ProfileUpdate.phone`. Tests: `modules/auth/email-sign-in.test.ts` (new), `sign-in.test.ts`, `auth-wiring.test.ts` (email in production). Details and what the owner must do: `docs/engineering/change-requests/2026-10-25-email-otp.md`.

## Done (2026-10-25: SEC-22)

- Handover access now ends when the handover invite is created, not on acceptance (`apps/api/src/modules/roles/service.ts`; details in `status/api-core.md`). `acceptInvites` (`modules/auth/invites.ts`) keeps ending a live replaced assignment, which now only matters for invites created before the change; its comment says so. No change to sign-in.

## Done (2026-10-18: change request `otp-issue-lock`, exact code ceilings across processes)

- Reviewed and applied `docs/engineering/change-requests/2026-10-18-otp-issue-lock.md` (marked done there, with what changed from its patch). `requestCode` in `modules/auth/otp.ts` now counts the resend wait and the three ceilings and stores the code in one transaction behind `pg_advisory_xact_lock(hashtext('qc.auth'), hashtext('otp_issue'))` (two-key form: cannot collide with other modules' single-key locks). It is the only advisory lock in the lane, taken before any row lock, never awaited by anything holding a row lock, so no deadlock with verify, refresh, sign-out or the purge.
- Better than the patch: one counting statement (`count(*) filter`) instead of four, so the lock is held briefly; a first look without the lock, so at a reached ceiling a flood is refused in parallel and never queues on the lock; an in-process queue (`oneAtATime`, keyed by the db handle) so each process parks at most one pooled connection on the lock. The code is still sent after commit, outside the lock (a direct `CodeSender` call; there is no outbox for codes). A failed send deletes its row and frees the slot.
- Tests (`sign-in.test.ts`, +5): the CR's parallel test (8 at once under a cap of 3, and one number twice at once); the daily window under parallel requests; the lock is the transaction-scoped form and runs inside the transaction, and a request at a reached ceiling opens no transaction; at most one issuing transaction open at a time, carrying on after refusals; a code being sent counts, a parallel request is answered during the send (it would hang if the send held the lock), and a failed send frees the slot. Checked: three fail on the old code; the first-look and queue tests fail on mutants without those parts; a mutant that sends inside the transaction fails the send test.
- Measured on real Postgres 16 with the real API (scratch script, not committed), 1,100 code requests from 100 addresses at 60 at a time after 40 earlier codes: **exactly 1,000 stored with 2 processes and with 1 process**. The old code in the same run stored 1,026 and 1,019 (2 processes).
- Latency (2 processes, shared 4-CPU machine, so treat these as rough): code requests one at a time p50 about 10 ms, the same as before. During the 1,100 burst, successful code requests p50 270 ms (old 150 to 170 ms): they now queue one at a time, about 230 codes a second against a need of 1,000 an hour. An unrelated GET during the burst p50 4 ms (old 34 ms; 81 ms with the lock but no in-process queue). Flood past the ceiling p50 66 ms (old 65 to 77 ms). Mean wait on the database lock 2.5 ms. The counting statement costs 0.2 ms with about 1,000 rows and 3 to 4 ms at a full day of codes (20,000 rows, sequential scan: there is no `created_at` index). The old code ran three such scans per request.
- `@qc/api` 736 passing in 35 files; the lane's suites 255 (`src/modules/auth`, `src/auth`, `src/test/auth-wiring.test.ts`). Typecheck, eslint, prettier clean; full `pnpm check` green (exit 0).

## Done (2026-10-18: security review SEC-04, SEC-07, SEC-20)

- **SEC-04 (owner decision, from the orchestrator): Pakistani mobile numbers only.** The contract's `RequestCodeBody.phone` is now `PakistaniMobilePhone` (contracts commit de8d579). Second guard in the service: `assertSignInCountry` in `modules/auth/otp.ts` runs first in `requestCode` and refuses anything not matching the contract's `PAKISTAN_MOBILE_PATTERN` (`+923` and nine digits) with `validation_failed` `{path: 'phone', code: 'phone_not_pakistan_mobile'}` (the contract's own code), before any limiter is touched, any row written or any send. `readBody` in `modules/auth/routes.ts` now builds issues with the contract's `issuesFromZod`, so the schema refusal also carries `phone_not_pakistan_mobile` (not Zod's `custom`). Verify, the mobile apps and the SMS fallback are unchanged.
- **Global cost backstop (SEC-04) and per-number daily cap (SEC-07)**, counted from `otp_challenges` in the database (index `(phone_e164, created_at)`; the purge keeps rows a day past expiry, so a 24-hour count is complete), so they survive restarts and hold across processes: new `AuthConfig.codeCaps` `{ perPhonePerDay: 10, globalPerHour: 1000, globalPerDay: 10000 }`. Checked in `requestCode` after the existing per-IP and per-number limiters and the resend wait. Over a cap: `rate_limited` with `retryAfterSeconds` until the oldest counted code leaves the window. Reaching a global cap logs `auth.code_global_cap_reached` at warn with `{window, limit}` only, as the alert hook for platform. A code whose delivery failed is deleted and not counted.
- **Refresh throttle (SEC-07):** `POST /v1/auth/refresh` takes a hit on `refresh:ip:<hashed address>` before the body is read; new `rateLimits.refreshPerIp` default 600 per 10 minutes (generous because many people share one carrier NAT address; the access token lives 15 minutes). Over it: `rate_limited` with `Retry-After`; the refused call does not consume the refresh token.
- **SEC-20, one client-address rule:** new `apps/api/src/auth/client-address.ts` (`rightmostForwarded`, `clientAddress(c, trustProxy)`): behind the trusted proxy, the rightmost `X-Forwarded-For` entry (the hop Caddy appends); otherwise the socket address. `defaultClientIp` (auth lane) and api-core's rate-limit key in `modules/shared/route.ts` both use it now (the binder used the leftmost entry before).
- Tests: `sign-in.test.ts` +7 (country refusal through the route with the contract code for four numbers incl. a Pakistani landline, nothing counted or sent; the service guard called directly; per-number daily cap surviving a limiter reset and freeing after the window; default 10; global hourly cap with the warn entry and no number in logs; global daily cap; failed delivery not counted), `sessions.test.ts` +2 (refresh throttle per address with junk tokens counted, other address unaffected, window frees; generous default), new `auth/client-address.test.ts` (2: rightmost rule, sign-in and shared helper agree on forged headers with and without trust). `auth-wiring.test.ts` +2 (real server answers `phone_not_pakistan_mobile`; the shared binder reports contract codes).
- `@qc/api` 694 passing in 33 files (with `--maxWorkers=3`; at full parallelism under the shared machine's load, one scope-matrix test hit its 30 s timeout and passes alone in 14 s). Typecheck, eslint and prettier clean on `apps/api`.

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
- The in-memory rate limiter (`auth/rate-limiter.ts`: per-IP and per-number code requests, verify attempts, refresh) resets on restart and is per process. The resend wait with backoff, attempt counters, expiry, the per-number daily cap and the global caps live in the database and hold across restarts and processes; since `otp-issue-lock` (2026-10-18) they are counted and the code stored under one advisory lock, so they are exact under parallel requests on any number of processes. With `API_PROCESSES` above 1 the in-memory limits are kept by the cluster primary (api-core, `middleware/shared-limits.ts`). A Postgres-backed limiter is **not** warranted while the API runs as one container (prod compose today): the costly paths (codes sent) are already capped in the database, and the remaining in-memory limits only slow guessing and flooding, which the database-backed per-challenge attempt limit (5) and daily cap (10 codes, so at most about 50 guesses a day per number) bound anyway. It becomes necessary before running several API containers (compose replicas), behind the existing `RateLimiter` interface; several processes in one container already share the primary's limiter.
- Registry buckets (SEC-07): the contract's `rateLimit: 'auth_code'` on code and verify is not applied; the auth lane's own limits above replace it (they are stricter and keyed per number and per address). The contract text should say so (change request below).
- New accounts get no name (null) and the language chosen on the code screen.
- Account deletion (`me.delete`) and admin invite creation/revocation (`adminRoles.*`) are not in this lane's code; api-core has them under `modules/me` and `modules/roles`. They must use `requireAction` or the adapter, and write audit rows.
- `apps/api/src/auth/no-direct-role-checks.test.ts` scans the API source outside the auth lane and fails if a handler compares roles or reads `principal.assignments`.

## Questions for the orchestrator

- `otp-issue-lock`: the request said codes go "through the outbox as today". They do not: `requestCode` calls `CodeSender.send` directly after commit (no outbox), which is what the lock needs (nothing slow under it). I did not change that. `infra/ENV.md` (platform) mentions this request until it lands; it has landed, so platform can drop that note.
- Optional, not needed for the ceilings: an index on `otp_challenges (created_at)` (db lane) would make the count cheaper than its 3 to 4 ms sequential scan at a full day of codes. At 1,000 codes an hour the lock is idle almost all the time, so I do not propose it now.

- SEC-04 global caps: defaults are 1,000 codes an hour and 10,000 a day for the whole country. Confirm with the owner's Meta/SMS budget; when hit, everyone's sign-in waits, so platform should alert on `auth.code_global_cap_reached`. IPv6 /64 grouping for the IP key (also in SEC-04's fix list) is not done; the +92-mobile rule and the global caps now bound the cost.
- `TRUST_PROXY` (api-core) and `AUTH_TRUST_PROXY` (auth) are still two variables, both `true` in prod compose. They now share one rule; merging them into one variable is a platform/index.ts follow-up.

- Approve the decision record 0002 (hand-built on `jose`)?
- The brief says to wait for approval of the record before implementing. I implemented in parallel on your instruction; if the record is rejected, the token and session code is isolated in `auth/tokens.ts`, `auth/crypto.ts` and `modules/auth/sessions.ts`.
- Should an expired invitation block the first sign-in once (current behaviour: 410 `invite_expired`, then the same code works) or never block it? The contract has no other way to tell the person.
- Who wires `authRoutes`, `authMiddleware` and the real `CodeSender` into `apps/api/src/index.ts` (api-core owns that file)?

## Contract change requests

- New (2026-10-18), `auth-limits-doc`: document on `auth.requestCode`, `auth.verifyCode` and `auth.refresh` that the auth lane's limits replace the `auth_code` bucket (per number and per address, a per-number daily cap of 10 codes, global hourly and daily ceilings, refresh per address), all answering `rate_limited` with `retryAfterSeconds`.

- Applied 2026-10-17: `auth-session-grace`, `users-display-name`, `otp-locale`, `auth-failure-reason`.
