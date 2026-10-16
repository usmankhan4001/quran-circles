# 0002: Sign-in approach

Status: proposed (implemented in the auth-scopes lane; waiting for orchestrator and human approval)
Date: 2026-10-16
Lane: auth-scopes

## Context

Sign-in is a phone code (WhatsApp, SMS fallback), with short-lived access tokens, rotating refresh tokens, coordinator invites that turn into roles on first verified sign-in, and an API contract that is already frozen (`auth.requestCode`, `auth.verifyCode`, `auth.refresh`, `auth.signOut`). The tables are frozen too: `users`, `otp_challenges`, `auth_sessions`, `role_assignments`, `coordinator_invites`. Authorisation is a separate concern and already exists as `can()` in `@qc/contracts`.

## Options

1. **Better Auth.** A full library with its own tables (user, session, account, verification), its own endpoints and a phone-number plugin.
2. **Hand-built on `jose`.** Our own small service over the frozen tables. `jose` signs and verifies the access token. Everything else is about 600 lines of plain code that we can test line by line.
3. **Hand-built with opaque access tokens.** Look every token up in the database. No signing library.

## Decision

Option 2, hand-built, with `jose` (pinned) for HS256 access tokens.

- Better Auth would need its own schema beside ours, or a mapping layer onto `users` and `auth_sessions`, and it brings endpoints and response shapes that are not the contract's. The contract and the tables are frozen, so we would spend the effort fighting the library. It also adds a large dependency to the most sensitive code in the product, and the part we most need to control (rate limits, single-use codes, invite acceptance in one transaction, handover) is exactly the part a library would hide.
- Opaque access tokens (option 3) would cost one database read per request for the token alone. We already read the session and the role assignments per request, so a signed token adds little, but a signed short-lived token keeps the check cheap to reason about and lets other services verify it later.

Design in brief:

- **Codes.** Six random digits (`crypto.randomInt`). Stored as `HMAC-SHA256(key, challengeId:code)` where the key is derived from the server secret, so a database leak does not give the codes away. Five attempts per code, counted with an atomic update before the comparison so parallel guesses cannot race. Five minutes to live. Single use. Asking for a new code retires the old ones.
- **Abuse.** A `RateLimiter` interface (in-memory implementation now) is applied per phone number and per address, on both code requests and verification. A cool-down between codes for the same number grows with the number of recent codes (60 s, 120 s, 240 s, ... capped at 15 min), kept in the database so it survives a restart. Request responses are identical whether or not the number has an account.
- **Access token.** HS256, 15 minutes. Claims: `sub` (user id), `sid` (session id), `iss`, `aud`, `iat`, `exp`. No phone number, name or role. Roles are read from `role_assignments` on every request, so revoking a role (handover) takes effect on the next request.
- **Refresh token.** `<sessionId>.<32 random bytes, base64url>`. Only the SHA-256 of the whole token is stored in `auth_sessions.refresh_token_hash`. Each refresh swaps the hash in place with a compare-and-swap update. Presenting a token whose session exists but whose hash no longer matches is reuse: the session is revoked. Sliding 30 days, absolute 180 days.
- **Sign-out** revokes the session; the access token stops working at once because the middleware checks the session on every request.
- **Test mode.** A fixed code is possible only through configuration, and only when `APP_ENV` is not `production`. An unset `APP_ENV` counts as production.
- **Invites.** After a code verifies, a pending invite for that number becomes a role assignment, the invite is marked accepted and an audit row is written, in one transaction with the account creation. An expired invite is marked expired and sign-in answers `invite_expired` without using up the code.

## Consequences

- We own the sign-in code and must keep its tests thorough. A human reviews the whole lane.
- A lost refresh response followed by a retry with the old token looks like reuse and signs that device out. A short grace window needs one more column; see the change request `2026-10-16-auth-session-grace.md`.
- The in-memory rate limiter is per process. That is correct for one API container. A Postgres-backed limiter can replace it behind the same interface if the API ever runs several containers; the database-backed cool-down and attempt counters already hold across restarts.
- Revisit if we add a second sign-in method (for example email) or if third-party identity (Apple, Google) becomes a requirement.
