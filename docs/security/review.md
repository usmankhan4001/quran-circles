# Security review (WP12, deliverable 1)

- Date: 2026-10-18
- Code reviewed: `main` at `3c84b79` (re-checked at `479bc0b`; the two commits in between change Urdu wording and quality docs only)
- Reviewer: quality lane (security part), an agent that wrote none of the reviewed code
- Status: **provisional**. There is no staging stack yet, so every check ran against the code and local throwaway scripts only. Findings need a human approval before they count (brief: "Approval: human, for security findings").
- Tracking table: `docs/security/findings.md`. Gate 5 needs every row closed (fixed and verified, or accepted by a human).

## Summary

| Severity | Count |
| -------- | ----- |
| Critical | 0     |
| High     | 0     |
| Medium   | 5     |
| Low      | 10    |
| Info     | 11    |

No Critical or High findings. Authentication, the scope engine, the admin endpoints, SQL access, file paths, the webhook and the renderer's HTML handling all held up under review. No secrets are in the code or the git history, and none of the exposed V1 credentials (Supabase, Neon, OneSignal) appear in V2.

The five Medium findings:

1. **SEC-01**: the worker sends web push to any URL a user registers: a blind SSRF into the internal Docker networks (messaging).
2. **SEC-02**: the WhatsApp daily cap and city budget are not enforced, and the gate would exempt "critical" templates from them anyway (messaging).
3. **SEC-03**: any account can run up WhatsApp spend by cancelling and re-registering, and a coordinator can queue thousands of paid invitations per minute (api-core).
4. **SEC-04**: sign-in codes go to any country with no global cap, which opens the door to SMS pumping (auth-scopes).
5. **SEC-05**: account deletion leaves the person's V1 legacy rows (name and phone), and those rows have no retention rule (api-core; needs a product decision).

## Scope

All of `main` that runs on the server or handles personal data:

- **Authentication**: OTP request and verify, cooldowns and lockouts, rate limiters, access and refresh tokens, rotation and reuse detection, sign-out and session revocation, invites accepted at sign-in, the daily purge job (`apps/api/src/auth/`, `apps/api/src/modules/auth/`, `packages/db/src/jobs/auth-purge.ts`, `apps/worker/src/auth/purge.ts`).
- **Scope engine and every endpoint**: `packages/contracts/src/scopes.ts`, the route binder `apps/api/src/modules/shared/route.ts`, `middleware/auth-adapter.ts`, and every handler in `apps/api/src/modules/*/routes.ts`. That covers all 95 registry endpoints, including registration, both exports, import, roles and invites, updates, posters, daily ayahs, audit and settings.
- **Injection**: Drizzle `sql` templates and `sql.raw`, LIKE patterns, cursors, CSV exports, response headers, poster storage keys, renderer HTML and CSS.
- **Worker**: WhatsApp webhook (signature, handshake, body limits), outbox and send gate, push providers, poster-render queue and storage, ayah push, reminders.
- **Poster renderer**: network and file isolation, HTML escaping and bidi isolation, CSP, resource limits, token auth, configuration defaults.
- **Infrastructure**: `infra/docker-compose.prod.yml` (networks, hardening, secrets), Caddyfile headers and routes, Dockerfiles, backups, deploy script, cron, CI workflow, CODEOWNERS.
- **Personal data**: loggers and log calls in api, worker, messaging and renderer; account deletion against every table that holds personal data (including `reading_days`, `memorisation`, `posters`, `daily_ayahs` and audit rows); retention of outbox payloads and legacy tables.
- **Secrets**: the working tree and the full history (68 commits, all refs).
- **Dependencies**: `pnpm audit --prod` and full `pnpm audit`.

Out of scope here: the scope matrix run against staging (deliverable 2), the load test, the restore drill (see `docs/quality/restore-drill.md`), and the mobile apps' own code apart from token storage, link handling and the PWA service worker.

## Method

- Read the code by hand, endpoint by endpoint. For each staff endpoint, checked how the resource's city and venue are found before `ctx.authorize`, whether a list is filtered by `scopeFilter`, and whether ids in the path or body are tied to the caller (IDOR).
- Traced each table that holds personal data through `deleteAccount` and the foreign keys' `onDelete` rules in `packages/db/src/schema/`.
- Searched the history with `git log --all -p` for key, token and password patterns (JWTs, AWS, Google, Stripe, GitHub, Slack, Meta tokens, PEM keys, connection strings with passwords, long hex strings) and for Supabase, Neon and OneSignal names and hosts. Also checked file names ever committed (`.env`, `.pem`, `.p8`, service-account files).
- Ran `pnpm audit --prod` and `pnpm audit` (the registry was reachable), then `pnpm why` to see which packages pull in each advisory.
- Proved findings with a throwaway script, `probe.mts`, kept in the session scratchpad and never committed. It imports the real modules and touches no network or database. Its output is quoted under each finding it supports.
- Severity: **Critical** means remote takeover or mass data exposure with no preconditions. **High** means one account's or the platform's data or money is exposed easily. **Medium** means real harm with some precondition or a limited channel. **Low** means a defence-in-depth gap or narrow impact. **Info** means a note, a hardening idea or something to confirm.

## Findings

### SEC-01 (Medium): the worker fetches any web push endpoint a user registers (blind SSRF)

- **Owner:** messaging. The registration-side check belongs to api-core or contracts.
- **Evidence:**
  - `packages/contracts/src/schemas/people.ts:243`: `DeviceRegister.token` is any 8 to 4096 characters.
  - `apps/api/src/modules/me/devices.ts:21-42`: stores the token as given.
  - `packages/messaging/src/providers/webpush.ts:9`: `endpoint: z.url()` accepts any scheme and host, including `http://`, internal names and IP literals.
  - `packages/messaging/src/providers/webpush.ts:67-69`: the worker POSTs to `details.endpoint` with plain `fetch`, which follows redirects.
  - `infra/docker-compose.prod.yml:206-209`: the worker sits on `edge` (internet), `backend` (Postgres) and `render` (renderer).
- **Proof** (`probe.mts`): `DeviceRegister` accepted a webpush token whose endpoint was `http://poster-renderer:8090/render`. `WebPushProvider.send` then fetched `http://poster-renderer:8090/render`, `http://api:3000/v1/auth/code` and `http://169.254.169.254/latest/meta-data/` (fake fetch, nothing left the machine).
- **Impact:** any signed-in person can make the worker send POST requests to hosts on its networks or anywhere on the internet. They do this by registering a crafted "device", then following a venue or registering for a session, so pushes go out. The body is encrypted and the response is not shown, so the SSRF is blind. The renderer needs its bearer token and Postgres does not speak HTTP, so no internal compromise was found. It still lets an attacker probe internal ports and use the server to send traffic elsewhere, and any future internal HTTP service on those networks would be exposed.
- **Fix:**
  - Accept only `https:` endpoints on the known push services: `fcm.googleapis.com`, `*.push.services.mozilla.com` and `updates.push.services.mozilla.com`, `*.notify.windows.com`, `web.push.apple.com` and `*.push.apple.com`. Check this both in `WebPushSubscription` (send time) and at registration, by refining `DeviceRegister` when `provider === 'webpush'`.
  - Send with `redirect: 'error'`.
  - Reject IP-literal hosts.
  - Add a test for each refusal.

### SEC-02 (Medium): the WhatsApp daily cap and city budget are not enforced, and critical templates would bypass them

- **Owner:** messaging
- **Evidence:**
  - `apps/worker/src/main.ts:57-64`: the processor is built without `limits`.
  - `apps/worker/src/outbox/processor.ts:28-32` ("Wave 2 leaves it unset, so no limit is applied") and `:136`.
  - `packages/messaging/src/gate.ts:22` ("Wave 4 fills them in"; it is not filled in) and `:156`: when limits are given, `!template_.critical` skips both the cap and the budget for critical templates.
  - The critical templates include `registration_confirmation` and `coordinator_invite` (`packages/contracts/src/messages.ts`).
  - The product rule (`docs/product/messaging.md`, Rules, Cap) is "at most one WhatsApp template message per person per day, with a monthly budget per city and an alert as it nears the limit".
- **Impact:** nothing limits paid WhatsApp spend per person or per city. Combined with SEC-03, one account or one coordinator can generate open-ended Meta charges, and the console's budget alert never fires.
- **Fix:**
  - Supply `limits` in `main.ts`: the daily cap from `readSettings` (`apps/worker/src/settings.ts:24-49`), the count of WhatsApp sends to the recipient today from `message_outbox`, and the city's spend this month.
  - Apply the city budget to every paid template, critical ones included.
  - Keep critical templates exempt from the one-per-day cap if the owner wants, but add a hard per-recipient ceiling for them (for example 5 a day), so that a loop cannot run up a bill.
  - Add tests for the cap, the budget and the ceiling.

### SEC-03 (Medium): any account can repeat registration confirmations, and staff can bulk-queue invitations

- **Owner:** api-core
- **Evidence:**
  - `apps/api/src/modules/registrations/service.ts:166-176`: an existing registration only blocks a new one while it is not cancelled.
  - `:224` and `:264`: each new registration queues a WhatsApp confirmation keyed by the new registration id.
  - `:327-351`: cancelling is unlimited.
  - `apps/api/src/middleware/rate-limit.ts:23`: the registration bucket allows 20 a minute per person.
  - Coordinator import: `packages/contracts/src/schemas/admin.ts:368` (`IMPORT_MAX_ROWS = 2000`), `apps/api/src/modules/import/service.ts:506-515` (one invitation per row) and `rate-limit.ts:24` (30 requests a minute). Coordinator invitations need no consent.
- **Impact:** a signed-in attendee who loops register and cancel queues a new paid confirmation each time, all to their own number. Only Meta's per-recipient pacing stops this, and SEC-02 removes our own limit. A city coordinator, or a stolen coordinator session, can queue up to 2,000 invitations per request to arbitrary numbers in their city's venues. That is a cost risk and a harassment channel.
- **Fix:**
  - Key the confirmation idempotency on person, session and Pakistan day (for example `registration_confirmation:<userId>:<sessionId>:<date>`), so re-registering does not resend.
  - Cap invitations per actor per day (for example 200), and count them against the city budget.
  - Require a confirmed dry run for imports above a threshold.

### SEC-04 (Medium): sign-in codes go to any country, with no global cap (SMS pumping)

- **Owner:** auth-scopes. A phone schema change would come from contracts.
- **Evidence:**
  - `packages/contracts/src/common.ts:5`: `E164_PATTERN` accepts any country code.
  - `apps/api/src/modules/auth/otp.ts:71-114`: a code is sent after the per-IP and per-phone limits only.
  - `apps/api/src/auth/config.ts:72-75`: 30 requests an hour per IP and 5 an hour per phone. There is no global, per-prefix or daily limit.
  - The SMS fallback is on by default (`infra/.env.example`, `CODE_SMS_FALLBACK`).
  - `docs/product/decisions.md` fixes the country to Pakistan in V2.
- **Proof** (`probe.mts`): `RequestCodeBody` accepted `+447700900123` and `+8823123456789`.
- **Impact:** with many IP addresses (a botnet, or IPv6 ranges, where each /128 is its own key), an attacker can trigger paid WhatsApp and SMS sends to premium-rate international ranges. This is SMS pumping, also called toll fraud. Each phone number allows 5 codes an hour, and the attacker spreads across many numbers.
- **Fix:**
  - Accept only `+92` for sign-in, enforced server-side in `requestCode`, with a configurable allowlist if other countries are ever needed.
  - Add a global hourly ceiling on code sends that raises an alert.
  - Group IPv6 addresses by /64 for the IP key.
  - Test each case.

### SEC-05 (Medium): account deletion leaves V1 legacy rows, and the legacy tables have no retention rule

- **Owner:** api-core (deletion). Needs a product decision; data-migration should be consulted.
- **Evidence:**
  - `apps/api/src/modules/me/profile.ts:120-183`: deletes and anonymises V2 rows only.
  - `packages/db/src/schema/legacy.ts:9-16` (`legacy_registrations.name`, `phone_raw`) and `:34-40` (`legacy_whatsapp_subscribers.phone_raw`, `name`).
  - ADR 0004 says `phone_raw` holds the E.164 number, so these rows can be matched to a V2 account.
  - `docs/product/decisions.md`: "Personal data is kept until the person deletes their account".
- **Impact:** a person who deletes their account keeps their Ramadan 2026 name and number in two tables, with no end date. This is the data the decisions file says to "treat as possibly seen by others".
- **Fix:**
  - In `deleteAccount`, delete the `legacy_registrations` and `legacy_whatsapp_subscribers` rows whose `phone_raw` equals the account's number, in the same transaction.
  - Separately, have the owner set a retention date for both legacy tables, and add a purge job.
  - Add a deletion test that seeds legacy rows.

### SEC-06 (Low): outbox payloads keep personal data after sending

- **Owner:** messaging
- **Evidence:**
  - `apps/worker/src/outbox/repo.ts:89-104`: `markSent` clears the phone but not the payload. The same goes for the failed and dead transitions.
  - Payloads hold names: `apps/api/src/modules/registrations/service.ts:255` (`variables.name`) and `apps/api/src/modules/roles/service.ts:248` (`variables.inviterName`).
  - `apps/api/src/modules/me/profile.ts:167-175`: deletion clears payloads only where the deleted person is the recipient. A deleted coordinator's name stays inside invitations they sent.
- **Impact:** names stay in `message_outbox.payload` forever, outside the tables named in `docs/product/data-model.md`, and some survive account deletion.
- **Fix:** reduce the payload to the template key and non-personal ids once a row reaches `sent`, `failed` or `dead`, or purge payloads older than a few days.

### SEC-07 (Low): sign-in throttling gaps

- **Owner:** auth-scopes
- **Evidence:**
  - `apps/api/src/modules/auth/routes.ts:94`: `/v1/auth/refresh` has no rate limit.
  - The registry's `rateLimit: 'auth_code'` on code and verify (`packages/contracts/src/endpoints.ts`) is not applied; the auth lane uses its own numbers in `apps/api/src/auth/config.ts:72-75`.
  - `apps/api/src/auth/rate-limiter.ts:26`: limiters are in memory, so they reset on restart and are not shared between processes.
  - There is no daily per-phone ceiling. Per number, the cooldown (`config.ts:66-67`) and 5 attempts per code (`otp.ts:182`) allow about 20 to 25 guesses an hour, or about 600 a day.
- **Impact:** a sustained attack on one number has roughly a 1.8 % chance of guessing a code within a month. Each round sends a code to the victim, so they would notice. Unlimited refresh calls cost a database read each.
- **Fix:**
  - Add a per-phone daily cap on codes (for example 10) with a lockout until the next day.
  - Rate-limit refresh per IP.
  - Use a Postgres-backed limiter before running more than one API process.
  - Either make the registry's buckets match, or document that the auth lane's limits replace them.

### SEC-08 (Low): free text accepts control and bidi characters

- **Owner:** contracts
- **Evidence:**
  - `packages/contracts/src/common.ts:43-47` (`LocalizedInput`) and `:89` (`PersonName`): only trimmed, with a length limit.
  - Poster editable fields already refuse these characters (`packages/contracts/src/schemas/posters.ts:64`), but the session snapshot's venue and area names do not (`posters.ts:25`).
  - Those strings reach WhatsApp template variables, posters, the CSV exports and admin screens.
- **Proof** (`probe.mts`): `LocalizedInput` and `PersonName` accepted U+202E (right-to-left override). `PosterFields` refused it.
- **Impact:** a coordinator or attendee can hide or reverse text in venue names, session titles or their own name. That enables spoofing in messages, on printed posters and in exports. The renderer isolates each field but does not strip the characters inside it.
- **Fix:**
  - Move the poster `FORBIDDEN` check into a shared `SafeText` refinement, and use it in `PersonName`, `LocalizedInput`, `LocalizedLongInput` and `teacherName`.
  - Have the renderer strip these characters from snapshot text as a second guard.

### SEC-09 (Low): `onlineLink` accepts any URL scheme

- **Owner:** contracts
- **Evidence:** `packages/contracts/src/schemas/admin.ts:165,181,189` and `schemas/sessions.ts:52` use `z.url()`, which accepts `javascript:` and `data:` (checked with zod in the repository). The user app guards the link (`apps/user-app/src/features/session/links.ts:14-21`), so nothing is exploitable today.
- **Fix:** accept only `https:` (and `http:` if needed) in the contract, so that any future client is safe too.

### SEC-10 (Low): no Content-Security-Policy, the PWA can be framed, and its tokens live in localStorage

- **Owner:** platform. Token storage is user-app's.
- **Evidence:**
  - `infra/caddy/Caddyfile:21-30` sets HSTS, nosniff, Referrer-Policy and Permissions-Policy, but no CSP on either site.
  - `X-Frame-Options` is set for the console only (`:73`).
  - `apps/user-app/src/platform/stores.ts:21`: the PWA keeps the refresh token in localStorage. The console uses sessionStorage.
- **Impact:** no code path today allows XSS (no dangerous sinks with user data were found). If one is ever introduced, there is no second guard against reading the token, and the PWA can be clickjacked.
- **Fix:** send a CSP from Caddy for both sites (`default-src 'self'`; `connect-src 'self'` plus the Quran text host and the maps hosts; `frame-ancestors 'none'`; `object-src 'none'`; `base-uri 'none'`), and add `frame-ancestors 'none'` to the PWA too.

### SEC-11 (Low): the renderer fails open when `APP_ENV` is unset

- **Owner:** renderer
- **Evidence:**
  - `apps/poster-renderer/src/config.ts:7`: `APP_ENV` defaults to `development`.
  - `:16` and `:56`: the token is required only in staging and production.
  - `apps/poster-renderer/src/app.ts:75`: no token means no authentication.
  - Production sets `APP_ENV` as a required variable (`infra/docker-compose.prod.yml:246`), so it is protected today.
- **Proof** (`probe.mts`): `parseRendererEnv({})` returned `APP_ENV: development` with no token.
- **Fix:** default to `production`, the same as the API's auth config, and require the token unless `APP_ENV` is explicitly `development` or `test`.

### SEC-12 (Low): the services connect as the Postgres superuser

- **Owner:** platform. A grants migration would come from contracts.
- **Evidence:** `infra/docker-compose.prod.yml:45,298,313`. The api, the worker and `migrate` all use `qc`, the image's superuser.
- **Impact:** no SQL injection was found. But any future injection, or a compromised container, would have DDL rights and superuser rights, including `COPY ... PROGRAM`.
- **Fix:** keep `qc` (or a new owner role) for migrations only, and run the api and worker as a non-superuser role with DML rights on the application tables and pg-boss's schema.

### SEC-13 (Low): poster creation has no throttle of its own

- **Owner:** api-core
- **Evidence:** `packages/contracts/src/endpoints.ts:917`. `adminPosters.create` (and `regenerate`) use the default bucket, 300 a minute per person. Each call adds up to 4 rows and one render job.
- **Impact:** a coordinator can fill the render queue, the `posters` table and the poster volume, which delays everyone's posters. The renderer itself sheds load (`RENDER_QUEUE_MAX`), so this is a queue and storage problem, not a crash.
- **Fix:** give poster create and regenerate a tighter bucket (for example 10 a minute), and refuse a new poster for a session and template while one is still queued.

### SEC-14 (Low): CI and review guardrails

- **Owner:** platform
- **Evidence:**
  - `.github/workflows/ci.yml` has no `permissions:` block, so the token gets the repository's default scope.
  - Actions are pinned by tag, not by commit SHA (`ci.yml:15-17`).
  - `.github/CODEOWNERS` does not cover `apps/poster-renderer/` (container and template changes need a human, per `ownership.md`), `apps/api/src/modules/me/` (account deletion) or `apps/api/src/modules/registrations/` (personal data and exports).
- **Fix:** add `permissions: contents: read`, pin actions to SHAs, and add the three paths to CODEOWNERS.

### SEC-15 (Low): dependency advisories, in build tooling only

- **Owner:** user-app and admin-app (Expo). `drizzle-kit` belongs to contracts.
- **Evidence:** `pnpm audit --prod` reports node-forge ≤1.4.0 (high, GHSA-86w9-cpqp-85rv), braces ≤3.0.3 (high, GHSA-vfj7-8cjw-p6xm) and uuid <11.1.1 (moderate, GHSA-w5hq-g745-h8pq). All three arrive through `expo` → `@expo/cli`, `@expo/metro` and `@expo/config-plugins`. The full `pnpm audit` adds esbuild ≤0.24.2 (moderate, GHSA-67mh-4wv8-2f99) through `drizzle-kit` → `@esbuild-kit`. `pnpm why` finds none of them in `@qc/api`, `@qc/worker`, `@qc/poster-renderer`, `@qc/db` (production), `@qc/messaging` or `@qc/contracts`.
- **Impact:** developer machines and build runners only. Nothing in the production images is affected.
- **Fix:** upgrade Expo when it ships patched versions, upgrade `drizzle-kit` when it drops `@esbuild-kit`, and re-run the audit on each release candidate.

### SEC-16 (Info): Chromium runs without its own sandbox

- **Owner:** renderer
- **Evidence:** `infra/docker-compose.prod.yml:235-237` documents this. The compensating controls are sound:
  - JavaScript is off in the page (`apps/poster-renderer/src/browser.ts:147`).
  - Requests are blocked three ways: host-resolver and proxy flags (`:57-60`), Playwright interception (`:163-166`) and a strict CSP (`templates/layout.ts:18-21`).
  - Fields are escaped and isolated.
  - The service has an internal-only network, a read-only root, `cap_drop: ALL` and limits on pids, memory and time.
- **Suggestion:** later, enable `chromiumSandbox` with a seccomp profile that allows user namespaces.

### SEC-17 (Info): the API holds the renderer token and joins the render network without using either

- **Owner:** platform
- **Evidence:** `infra/docker-compose.prod.yml:52,116,141`. No `RENDERER_*` variable is read anywhere in `apps/api/src`; the API only queues jobs through pg-boss.
- **Fix:** remove the `poster-client` token and the `render` network from the api service (keep `POSTER_STORAGE_DIR`).

### SEC-18 (Info): the dev compose file publishes Postgres on every interface

- **Owner:** platform
- **Evidence:** `infra/docker-compose.dev.yml:9,12`. The port is `5432:5432` and the password is `qc`.
- **Fix:** change the binding to `127.0.0.1:5432:5432`.

### SEC-19 (Info): backups can be deleted from the server, and deleted accounts stay in them

- **Owner:** platform
- **Evidence:** `infra/backup/backup.sh:127-129`. The server holds rclone credentials that can delete remote copies. Encryption is good: age, public key only on the server, nothing unencrypted on disk. Retention is 14 days for daily copies and 8 weeks for weekly ones.
- **Fix:**
  - Use an append-only or object-lock remote, so an intruder on the server cannot erase the second location.
  - State in the privacy notice that deleted data leaves backups within 8 weeks.

### SEC-20 (Info): two ways of reading the client address

- **Owner:** api-core. The auth side is auth-scopes'.
- **Evidence:** the API binder takes the first `X-Forwarded-For` entry (`apps/api/src/modules/shared/route.ts:141`); the auth lane takes the last (`apps/api/src/auth/context.ts:36`). Both are right only because Caddy replaces the header for untrusted clients and the api publishes no port (`infra/docker-compose.prod.yml:103-161`).
- **Needs confirmation** on staging: send a forged `X-Forwarded-For` through Caddy and check which address each limiter sees.
- **Fix:** share one helper (take the last entry), so that adding a CDN or `trusted_proxies` later cannot make one of the limiters spoofable.

### SEC-21 (Info): the code message states the wrong validity

- **Owner:** messaging
- **Evidence:** the message text uses `CODE_VALIDITY_MINUTES`, which defaults to 10 (`packages/messaging/src/env.ts:38`, `code-sender.ts:78`). Codes actually expire after 5 minutes (`apps/api/src/auth/config.ts:64`).
- **Fix:** take the minutes from the auth TTL, or set both from one variable.

### SEC-22 (Info): handover by invite keeps the old coordinator's access until the invite is accepted

- **Owner:** api-core. Needs confirmation with the product owner.
- **Evidence:** `apps/api/src/modules/auth/invites.ts:115`. The replaced assignment is revoked only when the invite is accepted, and the contract documents this (`InviteBody`). `docs/product/decisions.md` says that "the previous coordinator loses access at once".
- **Fix:** confirm the intent. If access should end at once, revoke when the invite is created, or have the console offer "revoke now".
- **Status: resolved (2026-10-25).** The product owner confirmed the rule in `docs/product/decisions.md`: the previous coordinator loses access at once. A handover invite (`POST /v1/admin/invites` or a coordinator import row with `replacesAssignmentId`) now revokes the replaced venue or city assignment in the same transaction that creates the invite, with a `role.revoke` audit row (`meta.reason: 'handover'`, `meta.inviteId`), whether or not the new coordinator has accepted (`apps/api/src/modules/roles/service.ts`, `createInvite` and `endHandedOverAssignment`; `apps/api/src/modules/import/service.ts`). Access ends on the old holder's next request, because roles are read fresh on every request. Revoking or letting the invite lapse does not give the role back. A resend to the same number may repeat the link to the assignment it already ended; any other number gets `not_found`. Acceptance still ends a replaced assignment that is live, which covers invites created before the change. Tests: `apps/api/src/modules/roles/handover.test.ts` (real tokens), `apps/api/src/test/roles.test.ts`, `apps/api/src/test/import.test.ts`.

### SEC-23 (Info): the PWA service worker can cache a non-page response as the app shell

- **Owner:** user-app
- **Evidence:** `apps/user-app/public/sw.js:48-53`. Every same-origin navigation response is stored as `/`, including non-OK responses and `/api/*` JSON. A crafted link (for example to `/api/v1/config`) replaces the offline shell.
- **Fix:** cache only `response.ok` HTML for app routes, and skip `/api/` and `/webhooks/`.

### SEC-24 (Info): a public GET writes to the database

- **Owner:** api-core
- **Evidence:** `apps/api/src/modules/sessions/public.ts:168`. An anonymous `GET /v1/sessions/{id}/occurrences` runs `topUpOccurrences`.
- **Fix:** rely on the worker's daily top-up, or only top up when the horizon has actually lapsed.

### SEC-25 (Info): staff can tell whether an out-of-scope id exists

- **Owner:** api-core
- **Evidence:** update and export handlers answer `forbidden` for an existing id outside the caller's scope and `not_found` for an unknown one (for example `apps/api/src/modules/registrations/routes.ts:30-32`). The single reads already hide this (`sessions/routes.ts:41-50`, `circles/routes.ts:46-54`). Ids are random UUIDs, so this cannot be used in practice.
- **Fix:** optional. Answer `not_found` for out-of-scope ids everywhere, the same as the single reads.

### SEC-26 (Info): registering a known push token moves it to the new account

- **Owner:** api-core
- **Evidence:** `apps/api/src/modules/me/devices.ts:17-42` does this on purpose, for shared phones. Taking someone's pushes requires their device token, which is not exposed anywhere.
- **Fix:** none needed. Recorded so it is a conscious choice.

## Areas reviewed with no finding

- **Tokens**:
  - Access tokens are HS256 with the algorithm pinned, plus issuer, audience, `exp` and `iat` checks. They carry no personal data or roles (`apps/api/src/auth/tokens.ts`).
  - The keys are separated per purpose by HKDF (`crypto.ts`).
  - Every request re-reads the session and role assignments, so sign-out, suspension and role revocation take effect at once (`middleware.ts:50-102`). The middleware fails closed on error (`:117-121`).
- **OTP**:
  - Codes are 6 digits from `randomInt`, stored as an HMAC bound to the challenge, and compared in constant time.
  - Each attempt is counted atomically before the comparison (`otp.ts:173-185`).
  - Only the newest code works, unknown and used codes answer alike, a fixed test code is refused in production, and sign-in creates nothing until the code is right.
- **Refresh**:
  - Rotation is compare-and-swap. A 10 s grace window returns the identical pair; reuse after the window revokes the session. Only hashes are stored, and the session id alone revokes nothing (`sessions.ts`).
  - The purge job deletes only finished rows, and its log line holds counts only.
- **Scope engine and endpoints**:
  - `can` denies unknown actions. National admins bypass place checks only for levels other than `national`, which is correct. Self actions bind to the caller.
  - The binder fails closed when a staff handler makes no decision (`route.ts:241-245`).
  - Every staff handler loads the target's city and venue from the database before authorising: sessions, occurrences, attendance, registrations, exports, venues, circles, posters, daily ayahs, roles and invites, updates and import (decided row by row).
  - List endpoints filter by `scopeFilter`: venues, circles, sessions, updates, invites, assignments, audit, daily ayahs and the scoped export.
  - Role bodies are discriminated unions, so a role cannot be paired with the wrong kind of place.
  - Self endpoints filter by the caller's id (follows, devices, bookmarks, circle requests, registrations, memorisation, feed read marks).
- **Injection**:
  - All SQL goes through Drizzle parameters. `sql.raw` appears only in schema check constraints built from constants, and in a test helper.
  - LIKE patterns are escaped (`shared/mappers.ts:77`) and cursors are validated.
  - Both CSV writers neutralise formula characters in human text, and only server-made values skip the check.
  - Response headers carry only UUIDs, enums and regex-checked template keys.
  - Poster storage keys are checked segment by segment and re-checked against the root on both sides (`apps/api/src/modules/posters/storage.ts:22-50`, `apps/worker/src/posters/storage.ts:27-70`).
- **Webhook**: HMAC-SHA256 over the raw body with a constant-time check. It returns 503 when unconfigured and is required in production. The verify-token check is constant time. Body limits apply (1 MB at Caddy and in the worker), there are header and request timeouts, and message text is classified and dropped at parse time.
- **Renderer**: input is validated with `.strict()` contract schemas plus a body limit, all text is HTML-escaped and bidi-isolated, error answers never echo values, and limits apply to concurrency, queue, time, heap, browser recycling and container resources.
- **Logs**:
  - The API logger drops personal keys and phone-shaped strings, and request logs carry the route pattern, not the URL.
  - The auth logger records ids and error codes only, and database error messages are never logged.
  - The messaging logger sanitises fields.
  - Caddy writes no access log, because the verify token can appear in a query string.
- **Account deletion**: profiles, devices, follows, consents, bookmarks, reading positions, reading days, memorisation, circle requests, feed read marks, role assignments and sessions cascade. Registrations are anonymised and the attendance names tied to them are cleared. Pending outbox rows to the person are cleared and marked dead. Invites and codes for the number are deleted. `posters.created_by`, `daily_ayahs.set_by`, `audit_log.actor_user_id` and similar columns are set to null, and audit `meta` never holds names or numbers. Exceptions: SEC-05 and SEC-06.
- **Infrastructure**: Postgres and the renderer are on internal networks with no published ports. Services run as non-root with a read-only root, `cap_drop: ALL` and `no-new-privileges`. Images are pinned by digest. The env file is mode 600 and its values are read without sourcing. Backups are encrypted to a public key, and failures raise alerts. Deploys refuse a dirty checkout and validate the tag.

## Secrets and V1 credentials

- **Working tree:** no keys, tokens or passwords. The only connection strings are the local development default (`postgres://qc:qc@localhost:5432/qc`) and placeholders under `example.invalid` and `example.test`. Both `.env.example` files hold placeholders only. No `.env`, `.pem`, `.p8` or service-account file has ever been committed (checked across all 68 commits and all refs).
- **History:** pattern searches over `git log --all -p` found only placeholders, test fakes, font and package checksums, and the development default above.
- **V1 credentials:** no Supabase, Neon or OneSignal URL, key or project id appears anywhere in the tree or the history. The only matches are rule text that forbids them, the migration tool's variable names (`V1_SUPABASE_URL`, `V1_SUPABASE_ANON_KEY`, `V1_NEON_DATABASE_URL`) with fake test values, and the lockfile listing `@neondatabase/serverless` as an optional peer of `drizzle-orm`, which is not installed. The migration fixtures are synthetic ("Sample ...", "Test Person N", reserved-looking numbers).
- **Rotation:** the decision to rotate the exposed V1 database password and push keys at launch (WP13) still applies. V2 does not depend on them.

## Needs staging or a human

1. **Human approval** of each finding and its severity (brief), and owner decisions on SEC-04 (Pakistan-only sign-in) and SEC-05 (legacy retention and deletion). SEC-22 (handover semantics) is resolved: access ends at once.
2. **Staging checks** once the stack exists:
   - SEC-20: forged `X-Forwarded-For` through Caddy.
   - SEC-01: after the fix, register a webpush device with an internal endpoint and confirm the worker refuses it.
   - SEC-10: check the CSP headers.
   - Re-run `pnpm audit` on the release candidate.
3. **Meta pricing and pacing** for sizing SEC-02 and SEC-03. Budgets assume in-window messages are not free (`docs/product/messaging.md`).
4. **Deliverable 2** (the scope matrix against staging) is not done here. This review checked the code paths only.

## Proof script

`probe.mts` lives in the session scratchpad (`security/probe.mts`) and was not committed. It imports the real contract, messaging and renderer modules, uses a fake `fetch`, and opens no sockets or databases. Its output on `3c84b79`:

```
1a DeviceRegister accepts internal endpoint: true
1b worker fetched http://poster-renderer:8090/render -> permanent_failure webpush_http_401
1b worker fetched http://api:3000/v1/auth/code -> permanent_failure webpush_http_401
1b worker fetched http://169.254.169.254/latest/meta-data/ -> permanent_failure webpush_http_401
2 RequestCodeBody accepts +447700900123 true
2 RequestCodeBody accepts +8823123456789 true
3a LocalizedInput accepts U+202E: true
3b PersonName accepts U+202E: true
3c PosterFields refuses U+202E: true
4 renderer APP_ENV default: development token set: false
```

(The 401s come from the fake fetch; what matters is that the request was made to each URL.)
