# Status: auth-scopes

Updated: 2026-10-16
Branch: claude/peaceful-archimedes-ain95k (orchestrator commits; lane branch name to be set by the orchestrator)

## Done

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

- Nothing blocking. `pnpm --filter @qc/api typecheck` and `test` currently fail only on api-core files in progress (`./modules` index missing, some `z.infer` type uses). The lane's own files typecheck clean.

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
- Not all of the lane's exports are required by api-core: `loadMe` and `UNNAMED_DISPLAY_NAME` are available if `me.get` should reuse them (api-core currently has its own copy in `modules/me/profile.ts`).

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

- Reuse detection treats any refresh token that names a live session but no longer matches as theft and revokes that session. A lost refresh response followed by a retry, or two tabs refreshing at once, therefore signs the device out. Clients must refresh single-flight and not retry a refresh blindly. A grace window needs a schema change (see the first change request).
- The in-memory rate limiter resets on restart and is per process. The resend wait with backoff, the attempt counters and expiry live in the database and hold across restarts.
- New accounts get the placeholder name `-` (see the second change request) and the default language `ur`.
- Account deletion (`me.delete`) and admin invite creation/revocation (`adminRoles.*`) are not in this lane's code; api-core has them under `modules/me` and `modules/roles`. They must use `requireAction` or the adapter, and write audit rows.
- `apps/api/src/auth/no-direct-role-checks.test.ts` scans the API source outside the auth lane and fails if a handler compares roles or reads `principal.assignments`.

## Questions for the orchestrator

- Approve the decision record 0002 (hand-built on `jose`)?
- The brief says to wait for approval of the record before implementing. I implemented in parallel on your instruction; if the record is rejected, the token and session code is isolated in `auth/tokens.ts`, `auth/crypto.ts` and `modules/auth/sessions.ts`.
- Should an expired invitation block the first sign-in once (current behaviour: 410 `invite_expired`, then the same code works) or never block it? The contract has no other way to tell the person.
- Who wires `authRoutes`, `authMiddleware` and the real `CodeSender` into `apps/api/src/index.ts` (api-core owns that file)?

## Contract change requests

- `docs/engineering/change-requests/2026-10-16-auth-session-grace.md` (previous refresh hash and `rotated_at` on `auth_sessions`)
- `docs/engineering/change-requests/2026-10-16-users-display-name.md` (`users.display_name` nullable)
- `docs/engineering/change-requests/2026-10-16-otp-locale.md` (`locale` on `otp_challenges`)
