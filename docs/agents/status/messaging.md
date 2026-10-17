# Status: messaging

Updated: 2026-10-17
Branch: claude/peaceful-archimedes-ain95k (lane `messaging`, no commits made by the lane)

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

- Morning ayah time: 06:30 Pakistan time, with a noon cutoff for make-up runs. Confirm, or name another time.
- Morning ayah audience follows all of a person's follows, whatever their per-place alerts setting (alerts are for that place's sessions). Confirm.
- Reminder audience: I include followers of a circle who have alerts on, as well as registrants. Confirm, or limit to registrants.
- Does the WhatsApp daily cap (Wave 4) apply to `critical` templates? The gate currently exempts them.
- Which SMS gateway? `HttpSmsProvider` is a generic JSON stand-in.
- Who gets Meta template approval and a native Urdu review of the template and reminder text?
- Legacy WhatsApp subscribers: they have no `consents` rows, so nothing is sent to them until the data-migration lane records an opt-in or they send START.

## Contract change requests

- Applied 2026-10-17: `outbox-venue-and-provider-id`, `reminder-lead-setting`.
- `messaging-env-vars`: names are in `.env.example`; passing them to the `worker` and `api` services in the compose files (`infra/`) and the webhook reverse-proxy route still need infra work (not this lane).
- `push-delivery-ack`: open.
- `auth-purge-to-db`: **applied 2026-10-17** (moved to `@qc/db`, scheduled at 03:00 Asia/Karachi). Original request: move `purgeStaleAuthRows` (no HTTP dependency, takes a db and a time) into `@qc/db` jobs next to `topUpAllOccurrences`, keeping the API's re-export. The worker then schedules it daily (proposed `0 3 * * *` Asia/Karachi on an `auth-purge` queue, counts-only log line).

## Findings from integration

From the WP11 end-to-end run with the real worker and fake providers (details in `tests/e2e/FINDINGS.md`):

- F-03 (low, **fixed 2026-10-17**): the queue handler in `runtime.ts` no longer logs; `reconcileReminders` logs `reminders.reconciled` once, when a run changed something. Test: `runtime.test.ts` "logs a reconcile that reached the queue once, not twice". The worker test database now also refuses overlapping queries inside a transaction (F-02 guard); no worker code needed a change. `@qc/worker`: 103 tests. Original note: `reminders.reconciled` is logged twice per run (`reminders/reconcile.ts:348` and `runtime.ts:154`), so the log reads as if every reconcile ran twice. Reminders themselves were inserted, re-timed after a schedule change and sent once.
- F-05 (medium, pending outside dependency): web push from the PWA cannot be exercised until the VAPID key pair exists; the flows use a fake `webpush` device.
