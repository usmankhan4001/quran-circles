# Status: messaging

Updated: 2026-10-18
Branch: claude/peaceful-archimedes-ain95k (lane `messaging`, no commits made by the lane)

## Done (2026-10-18: safe logger and UUIDs)

- `sanitizeFields` (`src/logger.ts`) no longer blanks canonical UUIDs (8-4-4-4-12 hex, either case, not touching other hex digits) whose groups happen to be all digits, such as a city id in a budget alert: UUIDs are taken out of the string before the phone-shape check, and the rest is still checked. Phone numbers are still blanked anywhere in a string, including next to or glued to a UUID; a near-UUID with a long group still counts as a digit run. Tests in `logger.test.ts` +2. `@qc/messaging` 231 tests in 12 files; typecheck clean.
- Not changed: the API's own logger (`apps/api/src/middleware/logger.ts`) already skips a value that is a UUID as a whole; a UUID inside a longer string there is still treated as phone-shaped (api-core, if it matters).

## Done (2026-10-18: security review fixes SEC-01, SEC-02, SEC-06, SEC-21)

- **SEC-01 (web push SSRF).** Contract (`packages/contracts/src/schemas/people.ts`, cleared by the orchestrator): `DeviceRegister` refuses a `webpush` token unless it is a `PushSubscription` JSON whose endpoint passes `isAllowedWebPushEndpoint` (issue `{ path: 'token', code: 'custom' }`, so the API answers `validation_failed`). Allowed: `https:` only, default port, no user info, no IP literal, host `fcm.googleapis.com`, `updates.push.services.mozilla.com`, `web.push.apple.com`, or a name ending in `.push.services.mozilla.com`, `.notify.windows.com`, `.push.apple.com`. New exports `WEB_PUSH_HOSTS`, `WEB_PUSH_HOST_SUFFIXES`, `isAllowedWebPushEndpoint`, `WebPushSubscriptionToken`, `parseWebPushToken`; tests in `packages/contracts/src/webpush-endpoint.test.ts`; CHANGELOG line under Unreleased. Sender (`packages/messaging/src/providers/webpush.ts`): the same check before every request (on the token and on the URL the library will call), refusal is `invalid_token` / `webpush_endpoint_refused` with no request, so the worker revokes the device; `redirect: 'manual'` and any 3xx (or opaque 0) is `invalid_token` / `webpush_redirect_refused`, never followed; default timeout 5 s (`WEB_PUSH_TIMEOUT_MS`). `HttpRequestInit` gained `redirect`.
- **SEC-02 (WhatsApp cap and city budget).** Gate (`packages/messaging/src/gate.ts`): `docs/product/messaging.md` names no exemption, so critical templates are capped and budgeted like any other (being critical only skips the push-first rule). Sign-in codes (cost category `authentication`) skip the city budget but count toward and are stopped by the per-person cap. Worker: `apps/worker/src/outbox/limits.ts` (`createWhatsAppLimits`) supplies the figures; `main.ts` wires `limits` and `afterSend` into the processor. Defaults: cap 1 per person per Pakistan day (env `WHATSAPP_DAILY_CAP`, 0 to 5; the console setting `whatsapp_daily_cap_per_person` wins), budget 3000 messages per city per Pakistan calendar month (env `WHATSAPP_CITY_MONTHLY_BUDGET`; setting `whatsapp_city_monthly_budget`, a number or `{ default, cities: { <cityId>: n } }`, wins), alert at 80 % (env `WHATSAPP_BUDGET_ALERT_PERCENT`): `whatsapp.city_budget_near` once at the threshold, `whatsapp.city_budget_reached` once at the budget (warn, counts and city id only). Counted: WhatsApp rows `sent`/`delivered` since the day or month start, plus rows another worker is sending that were queued earlier (tie-break in SQL, so two simultaneous rows cannot both take the last slot). A row without `recipient_user_id` is counted against the account with its phone; a number with no account has no history (only the budget limits it); a row without `city_id` has no budget. Blocked rows fail with `gate_daily_cap` / `gate_city_budget`.
- **SEC-06 (personal data in payloads).** `apps/worker/src/outbox/repo.ts` `redactedPayload()`: every finishing transition (sent, delivered, failed, dead, crash-dead, delivery-report failed/delivered, reconciler withdrawal) reduces the payload to `{ channel, template, locale, redacted: true }` or, for push, `{ channel, push: { data }, redacted: true }` (type, deep link, ids). Rows waiting for a retry keep the full payload; a revived reminder gets a fresh one. A row whose recipient account was deleted fails at the gate (`gate_no_recipient`) and is redacted. `redactFinishedPayloads` runs in the daily 03:00 job after the sign-in purge (`outbox.payloads_redacted`, count only) for rows finished before this change.
- **SEC-21 (code validity).** `DEFAULT_CODE_VALIDITY_MINUTES = 5` (the API's `otp.ttlSeconds`); `CODE_VALIDITY_MINUTES` and `ProviderCodeSender` default to it; a caller's `minutes` still wins.
- Tests: `@qc/messaging` 229 (was 197), `@qc/worker` 235 (was 196; new `outbox/limits.test.ts` 26, `outbox/redact.test.ts` 12, config +1, reconcile and runtime assertions extended), `@qc/contracts` 1977 (was 1934; +43 in `webpush-endpoint.test.ts`, count includes the other agent's concurrent work), `@qc/api` 693 passing. Typecheck, `npx eslint` and `npx prettier --check` clean for my files. One existing gate test that encoded the old exemption ("the cap does not stop a critical template") was replaced by its opposite, as SEC-02 requires.

## For other lanes (security fixes)

- **user-app, integration, quality:** fake web push tokens are now refused by `devices.register` (and by the contract mock). Use a subscription JSON, for example `{"endpoint":"https://fcm.googleapis.com/fcm/send/fake-endpoint-id","expirationTime":null,"keys":{"p256dh":"fake-p256dh","auth":"fake-auth"}}`, or `provider: 'fcm'`. Affected: `apps/user-app/src/test/harness.tsx:135` and `features/reminders/service.test.ts:111`, `tests/e2e/src/support/people.ts:109`, `tests/load/src/load/seed.ts:144`, `tests/load/src/scope/world.ts:331`, `tests/load/src/scope/scenarios.ts:636`.
- **auth-scopes:** pass `minutes: otp.ttlSeconds / 60` to `codeSender.send` (the field exists) so the message can never drift from the real lifetime.
- **platform:** add `WHATSAPP_DAILY_CAP`, `WHATSAPP_CITY_MONTHLY_BUDGET`, `WHATSAPP_BUDGET_ALERT_PERCENT` to the worker service, `infra/ENV.md` and `.env.example`; `CODE_VALIDITY_MINUTES` now defaults to 5 (ENV.md and `infra/.env.example` still say 10).
- **contracts:** a `whatsappCityMonthlyBudget` field in `Settings` would let the console edit the budget (the worker already reads the key).

## Done (2026-10-17: poster-render queue, contract 1.0.0-rc.5, migration 0010)

- Queue `poster-render` (`POSTER_RENDER_QUEUE`, payload `PosterRenderJob`, both from `@qc/contracts`) in `apps/worker/src/runtime.ts`: retry 3, backoff from 15 s (max 600 s), expire 120 s, dead letter `poster-render-dead`, batch 1, `WORKER_POSTER_CONCURRENCY` (default 2) per node. The worker sets the queue options with `createQueue` and then `updateQueue`, so they apply even if the API created the queue first. A malformed payload is logged (`posters.job_invalid`) and dropped. `runtime.renderPostersNow()` runs a job directly, for tests.
- Job (`apps/worker/src/posters/render.ts`, `renderPosters`): loads the job's rows that are still `queued` (with the template key), and each row's session with its venue and area. It builds the snapshot with `posterSnapshotFromSession` from the session as it is now (version = `sessions.updated_at`, area name included) and sends one `RendererRenderRequest` per group of rows that share session, template, language and fields (normally the whole job). It checks the answer with `RendererRenderResponse`/`RendererErrorResponse` and each file's sha256 and length. It stores files at `posterStorageKey(...)`, then in one transaction sets `ready`, `storage_key`, `alt_text` and `source_snapshot` (the snapshot the renderer printed), compare-and-set on `status = 'queued'`. Rows made before 0010 (no `language`) render in their `locale`.
- Failures: `failure_code` comes from `posterFailureFromRenderer`. `render_timeout` covers the client timeout (`RENDERER_TIMEOUT_MS`, default 90 s) and pg-boss's abort on expiry. `render_failed` covers a network error, an unreadable answer, a bad hash or a missing format. Retryable codes (`POSTER_FAILURE_RETRYABLE`) leave the rows `queued` and make pg-boss retry while attempts remain; only the last attempt writes `failed`, so a screen never shows "failed" for a poster still being retried. `invalid_request` and `text_too_long` fail at once. A request that cannot be built (bad fields, missing title) is `invalid_request` and the renderer is not called. Storage and database errors throw (pg-boss retries); once retries run out, the dead-letter handler fails the rows still queued with `render_failed` (`posters.job_dead`), so they never stay queued forever. That matters because `regenerate` refuses queued rows.
- Replacement: when a row with `replaces_poster_id` is ready, the old row (same session, not part of this job) is deleted in the same transaction. Its file is deleted after the commit, unless another row still points at the same key: an unchanged regeneration renders to the same content-addressed key. A failed regeneration keeps the old row and file. A failed file delete is logged (`posters.file_delete_failed`) and does not fail the job.
- Idempotent: a duplicate or a retry after success finds no queued rows and makes no renderer call. A retry after the files were stored but before the rows changed rewrites the same keys.
- Storage (`apps/worker/src/posters/storage.ts`): `PosterStorage { put(key, bytes, contentType), get(key) -> bytes | null, delete(key) }`, and `LocalDiskPosterStorage(root)` at `<POSTER_STORAGE_DIR>/<key>`. Keys must be `posters/` plus plain segments (`posterKeySegments`; `..`, absolute and odd keys are refused). Writes go to a temp file and are renamed into place. The api lane's reader should use the same interface and the same key-to-path rule.
- Config (`apps/worker/src/config.ts`), all optional: `RENDERER_URL` (http or https), `RENDERER_TOKEN`, `POSTER_STORAGE_DIR` (must be absolute), `RENDERER_TIMEOUT_MS` (1000 to 110000, default 90000, under the 120 s expiry), `WORKER_POSTER_CONCURRENCY` (1 to 8, default 2). Without the first three the worker starts, logs `posters.not_configured` with the missing names, and each poster job fails its rows with `render_failed`. That error line (`notConfigured`, `missing`) appears on every attempt and the job ends in the dead-letter queue. `missingPosterEnv(config)` lists what is missing.
- Logging: one `posters.render` line per job, counts only (`posters`, `skipped`, `ready`, `failed`, `retrying`, `replaced`, `filesDeleted`, `renderCalls`, `attempt`, `retry`), plus `failure` (the enum code, never text). No ids, names, numbers, poster text, alt text or token; a test checks this.
- Tests: `posters/render.test.ts` 49 (success and request shape, key layout, log content, duplicate run, failed or missing ids, pre-0010 row, current session printed, mixed groups; every failure code on the last attempt and with attempts left; 401; client timeout; job abort; unreachable renderer; busy then success; unbuildable request; storage failure; replacement, same-key replacement, failed regeneration, duplicate after replacement, other session untouched, failed file delete; missing renderer or storage, on every attempt; snapshot from a row). `posters/storage.test.ts` 5. `config.test.ts` +5. `runtime.test.ts` +9 (real pg-boss on PGlite: queue options, options applied over an API-created queue, end to end once with a duplicate send, busy retried via pg-boss, text_too_long not retried, dead letter fails rows, starts without poster config while the outbox still sends, malformed job, on demand). Fake renderer: `src/test/fake-renderer.ts`, loopback `127.0.0.1` only, synthetic token and bytes.
- `@qc/worker`: 196 tests in 10 files pass; typecheck, `npx eslint apps/worker` and `npx prettier --check apps/worker` are clean. `pnpm check` (whole repository) was not run, because the checkout is shared.

## Done (2026-10-17: change request `auth-purge-to-db`)

- Worker schedules the sign-in purge: `runAuthPurge` (`apps/worker/src/auth/purge.ts`) calls `purgeStaleAuthRows` from `@qc/db` on queue `auth-purge`, cron `0 3 * * *` Asia/Karachi (03:00 Pakistan time), key `daily`, singleton, `missed: 'once'`, retries 3 with backoff. `scheduleAuthPurge: false` turns the schedule off; `runtime.authPurgeNow()` for tests. Not wired to an environment variable (same as the top-up and ayah switches).
- One log line per run, `auth.purged`, with `challenges` and `sessions` counts only.
- Tests: 4 in `auth/purge.test.ts` (spent codes and expired or revoked sessions deleted, live and recent ones kept, second run deletes nothing; injected clock; log content has no number, name, hash or id; a database failure throws and logs no success) and 3 in `runtime.test.ts` (schedule registered once across restarts at 03:00 Asia/Karachi; off when told; on demand and via a queue job, keeping the live session). Seed helpers `seedOtpChallenge` and `seedAuthSession` in `src/test/seed.ts`.
- `@qc/worker`: 128 tests in 8 files; typecheck, eslint and prettier clean.

## Done (2026-10-17: morning ayah push, contract 1.0.0-rc.4, migration 0009)

- Joint change with contracts (cleared by the orchestrator): `PushData.type` gains `ayah_of_the_day` (`packages/contracts/src/messages.ts`, one test in `messages.test.ts`, CHANGELOG line under rc.4; the rc.4 "Not in this version" bullet removed). `openapi.json` and `SCOPES.md` are unchanged by the generator (checked), so not regenerated. Nothing else in contracts touched.
- `@qc/messaging`: `PUSH_TYPE_PURPOSE.ayah_of_the_day = 'ayah_daily'`. The send gate therefore treats it like any push: no consent row means on, a revoked `push`/`ayah_daily` row stops it at send time, other purposes do not. Tests: four gate rows plus a check that every contract push type maps to a real purpose.
- i18n: `notifications.ayah.title` and `notifications.ayah.body` (`{surah}`, `{ayah}`, Western digits) added to en and ur with two small insertions after `notifications.reminder.body`. Urdu is a draft under the file's `_meta.status` marker.
- Worker: `runMorningAyah` (`apps/worker/src/ayah/morning.ts`) on queue `ayah-daily`, cron `30 6 * * *` Asia/Karachi (06:30 Pakistan time), key `daily`, singleton, `missed: 'once'`; `runtime.ayahNow()` for tests; `scheduleAyah: false` turns the schedule off.
  - Audience: active account, at least one device not revoked, `ayah_of_the_day` flag on (the city's own row wins, then the global row, then off; the city comes from the profile's area, the API's `resolveFlags` rule), and `consentGranted('push', 'ayah_daily', rows)`.
  - Ayah: `resolveDailyAyah` with all the person's follows (venues and circles, whatever their alerts setting) and that date's `daily_ayahs`. Link: `quran` deep link (web origin when `PUBLIC_WEB_BASE` is set). Key `ayah_daily:<date>:<userId>:push`, `collapseKey` `ayah_daily`, TTL 6 hours, `venue_id` null, `city_id` the person's city.
  - Keyset pages of 500 people, one `INSERT ... ON CONFLICT DO NOTHING` per page. A run that starts at or after 12:00 Pakistan time queues nothing (a make-up run after an outage would otherwise send a "morning" ayah in the evening). If the flag is off everywhere the run stops before reading people.
  - One log line per run, `ayah_daily.run`, counts only (`candidates`, `queued`, `alreadyQueued`, `flagOff`, `consentOff`, `skipped`). The date is not logged because the safe logger redacts `YYYY-MM-DD` as phone-shaped.
  - Tests (15 in `morning.test.ts`, 3 in `runtime.test.ts`): built-in ayah in both languages, web origin, follow resolution (one followed pick, two followed picks fall back to national, a pick for another day ignored), flag off or missing, city override both ways, consent no row / revoked / re-granted / other purpose revoked, no device / revoked device / suspended account, duplicate run and next day, paging, a database failure mid-run and a clean retry, the noon cutoff, log content, end to end send once, blocked at send time after the person turned it off or lost the last device, schedule registered once at 06:30 Asia/Karachi, schedule off, a queue job.
- `purgeStaleAuthRows` was not scheduled at this point (it lived in the API); since done, see above.
- Tests: `@qc/contracts` 1706, `@qc/messaging` 197, `@qc/worker` 121, all passing; typecheck, eslint and prettier clean for the three packages and the i18n files; `@qc/i18n` parity tests pass.

## Done (2026-10-17: contract 1.0.0-rc.2, migration 0008)

- Worker runs the occurrence top-up (`topUpAllOccurrences` from `@qc/db`) on the `occurrences-top-up` queue, cron `30 0 * * *` Asia/Karachi (key `daily`, `missed: 'once'`, singleton queue), horizon `OCCURRENCE_HORIZON_DAYS` (default 90), logging counts only; `runtime.topUpNow()` for tests. `OCCURRENCE_HORIZON_DAYS` still needs adding to `.env.example` and the compose files (platform).
- `draftPushRow` and `draftTemplateRow` accept `venueId` and write `message_outbox.venue_id`; the reminder reconciler sets it (also when reviving a withdrawn reminder).
- The processor checks per-venue consent against `row.venueId`; rows queued before 0008 (no venue) still work it out from the push or update they point at.
- The worker stores the provider's message id in `provider_message_id` instead of `payload.providerMessageId`, and delivery reports without our callback data look the row up by that column. The `biz_opaque_callback_data` path is unchanged.
- Reminders: registrants plus circle followers with alerts on (unchanged), lead time per program from `reminder_lead_minutes`, which is now in the Settings contract and edited by the console.
- `CodeSender.send` returns `{channel}` (`ProviderCodeSender` reports `sms` after a fallback); the auth lane uses it so the response names the right channel. WhatsApp first for everyone, staff included.
- Tests: `@qc/messaging` 191, `@qc/worker` 94, all passing; typecheck, eslint and prettier clean.

## Done (earlier)

WP4 Wave 2 items 1 to 7. 281 tests (190 in `@qc/messaging`, 91 in `@qc/worker`), typecheck, eslint and prettier clean for both packages. No test touches a network (loopback sockets only).

- `packages/messaging`: provider interfaces and fakes (push, WhatsApp, SMS, code sender); FCM, APNs (HTTP/2), web push, WhatsApp Cloud, generic SMS gateway; consent gate (`evaluateGate`) and channel plan; retry policy; outbox row drafts; safe logger; `createMessaging(env)` wiring; webhook signature, handshake and parsing.
- `apps/worker`: outbox repo and processor (compare-and-set, `SKIP LOCKED` claims, leases, crash recovery); dispatcher; pg-boss runtime (`outbox-send`, dead-letter queue, per-minute `reminders-reconcile`); reminder reconciler; WhatsApp webhook apply (status, STOP, START) and HTTP server with `/healthz`; config and `main.ts` (`pnpm --filter @qc/worker start`).
- `CodeSender` interface plus `ProviderCodeSender` (WhatsApp auth template, SMS fallback) and `TestCodeSender`.
- i18n: added `notifications.reminder.title` and `.body` to en and ur (Urdu is a draft).
- Decision record `docs/engineering/decisions/0005-messaging-outbox-and-providers.md`.

## In progress

- Nothing.

## Blocked

- Live use needs Meta template approval (`allMetaSubmissions()` gives the bodies), WhatsApp, FCM, APNs and VAPID credentials, and an SMS gateway choice. All tests run on fakes.

## Questions for the orchestrator

- Posters: the worker prints the session **as it is when the job runs** (a fresh `posterSnapshotFromSession`) and overwrites `source_snapshot` with what the renderer printed, so the out-of-date flag compares against what is actually on the poster. The API's snapshot at create time is therefore only a placeholder. Confirm, or say the worker should render the stored snapshot instead.
- Posters: `posterSnapshotFromSession` takes the API's whole `Session`, but the worker has only the database row. `snapshotOfSessionRow` builds the fields it reads (a typed `Pick`) and casts once. A small contract change that narrows the parameter type to those fields would remove the cast. Shall I file it?
- Posters: `PosterStorage` lives in `apps/worker`, and apps may not import apps, so the api lane copies the interface and the key rule. Should it move to a shared package (for example `@qc/messaging`, which this lane owns, or `@qc/db`) so both use one copy?

- Morning ayah time: 06:30 Pakistan time, with a noon cutoff for make-up runs. Confirm, or name another time.
- Morning ayah audience follows all of a person's follows, whatever their per-place alerts setting (alerts are for that place's sessions). Confirm.
- Reminder audience: I include followers of a circle who have alerts on, as well as registrants. Confirm, or limit to registrants.
- Daily cap and critical templates: following the product rule literally (no exemption), a person who registers for two sessions in one day gets only the first WhatsApp confirmation with the default cap of 1. Confirm, or raise the cap (up to 5) or name exemptions in `docs/product/messaging.md`.
- The safe logger masks any string with a digit-and-hyphen run of 9+ characters, which catches some uuids (`cityId`, `outboxId`), so a budget alert can lose its city id. Should ids be exempt from the phone-shape check?
- Sign-in codes never pass the outbox, so the gate's cap for `auth_code` covers only outbox rows; the API's per-phone limits govern real codes.
- Which SMS gateway? `HttpSmsProvider` is a generic JSON stand-in.
- Who gets Meta template approval and a native Urdu review of the template and reminder text?
- Legacy WhatsApp subscribers: they have no `consents` rows, so nothing is sent to them until the data-migration lane records an opt-in or they send START.

## For other lanes (poster-render)

- For platform: add `RENDERER_URL`, `RENDERER_TOKEN`, `POSTER_STORAGE_DIR` (an absolute path on a volume shared with the api, which reads the files), and optionally `RENDERER_TIMEOUT_MS` and `WORKER_POSTER_CONCURRENCY`, to the worker service, `infra/ENV.md` and `.env.example` (fake values).
- For api-core: enqueue `PosterRenderJob` in the same transaction as the rows or after commit. A job that arrives before the rows are visible finds nothing queued and is skipped. Send it with no queue options of its own; the worker owns them. Read files through the same `PosterStorage` key rule (`<POSTER_STORAGE_DIR>/<storage_key>`).

## Contract change requests

- Applied 2026-10-17: `outbox-venue-and-provider-id`, `reminder-lead-setting`.
- `messaging-env-vars`: names are in `.env.example`; passing them to the `worker` and `api` services in the compose files (`infra/`) and the webhook reverse-proxy route still need infra work (not this lane).
- `push-delivery-ack`: open.
- `auth-purge-to-db`: **applied 2026-10-17** (moved to `@qc/db`, scheduled at 03:00 Asia/Karachi). Original request: move `purgeStaleAuthRows` (no HTTP dependency, takes a db and a time) into `@qc/db` jobs next to `topUpAllOccurrences`, keeping the API's re-export. The worker then schedules it daily (proposed `0 3 * * *` Asia/Karachi on an `auth-purge` queue, counts-only log line).

## Findings from integration

From the WP11 end-to-end run with the real worker and fake providers (details in `tests/e2e/FINDINGS.md`):

- F-03 (low, **fixed 2026-10-17**): the queue handler in `runtime.ts` no longer logs; `reconcileReminders` logs `reminders.reconciled` once, when a run changed something. Test: `runtime.test.ts` "logs a reconcile that reached the queue once, not twice". The worker test database now also refuses overlapping queries inside a transaction (F-02 guard); no worker code needed a change. `@qc/worker`: 103 tests. Original note: `reminders.reconciled` is logged twice per run (`reminders/reconcile.ts:348` and `runtime.ts:154`), so the log reads as if every reconcile ran twice. Reminders themselves were inserted, re-timed after a schedule change and sent once.
- F-05 (medium, pending outside dependency): web push from the PWA cannot be exercised until the VAPID key pair exists; the flows use a fake `webpush` device.
