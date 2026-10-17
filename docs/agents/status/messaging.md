# Status: messaging

Updated: 2026-10-17
Branch: claude/peaceful-archimedes-ain95k (lane `messaging`, no commits made by the lane)

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

- Reminder audience: I include followers of a circle who have alerts on, as well as registrants. Confirm, or limit to registrants.
- Does the WhatsApp daily cap (Wave 4) apply to `critical` templates? The gate currently exempts them.
- Which SMS gateway? `HttpSmsProvider` is a generic JSON stand-in.
- Who gets Meta template approval and a native Urdu review of the template and reminder text?
- Legacy WhatsApp subscribers: they have no `consents` rows, so nothing is sent to them until the data-migration lane records an opt-in or they send START.

## Contract change requests

- Applied 2026-10-17: `outbox-venue-and-provider-id`, `reminder-lead-setting`.
- `messaging-env-vars`: names are in `.env.example`; passing them to the `worker` and `api` services in the compose files (`infra/`) and the webhook reverse-proxy route still need infra work (not this lane).
- `push-delivery-ack`: open.
