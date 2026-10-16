# 0005: Messaging, outbox and providers

Status: proposed
Date: 2026-10-16
Lane: messaging

## Context

V2 sends reminders, registration messages and announcements by push and WhatsApp, and sign-in codes by WhatsApp with an SMS fallback. Meta bills template messages, people can withdraw consent at any time, and a message must never go out twice or to someone who said stop. The frozen contract already fixes the template catalog, the outbox table and the payload shapes. This record covers what the contract leaves open.

## Decision

**Outbox.** `message_outbox` is the only way a notification or template message leaves the system. Anyone who queues one builds the row with `draftPushRow` or `draftTemplateRow` from `@qc/messaging` (payload validated against the contract, cost from the catalog) and inserts it with `ON CONFLICT (idempotency_key) DO NOTHING`. The worker owns sending.

**Status meaning.**

- `queued`: waiting for `next_attempt_at`. A retry returns here with a later time.
- `sending`: claimed by a dispatcher. `next_attempt_at` is the lease; a row stuck in `sending` past its lease is handed out again, or marked `dead` if it has used all attempts.
- `sent`: the provider accepted it. For push this is the final state, because FCM and APNs give no delivery receipt.
- `delivered`: WhatsApp reported delivery or read. A late `sent` or `failed` never moves a row out of `delivered`.
- `failed`: stopped on purpose (no consent, recipient gone, the session was cancelled, invalid payload). Not retried. The code says why (`gate_no_consent`, `occurrence_cancelled`, ...).
- `dead`: retries ran out on a transient error.

All transitions are compare-and-set updates, so two workers or a replayed event cannot double-apply.

**Queue.** A dispatcher loop claims due rows with `FOR UPDATE SKIP LOCKED` and puts one `outbox-send` job per row on pg-boss. The job carries `{outboxId, attempt}`. Exactly-once sending does not rest on the queue: the claim is a compare-and-set, and a job whose attempt no longer matches the row is ignored. pg-boss retries a job only when the database failed; a provider failure is recorded on the row with the backoff in `retry.ts` (5 attempts, 30 s base, x4, 2 h cap, jitter, honouring a provider's retry-after). Jobs out of retries land in `outbox-send-dead` and are logged.

**Consent gate.** `evaluateGate` is a pure function over facts loaded from the database. Templates need the consent purpose in `purpose.ts`; auth codes and coordinator invitations need none. A venue-scoped consent counts only when the venue is known; the outbox has no venue column, so the worker resolves it from the payload's occurrence and otherwise fails closed. Push is free and respects the person's push opt-out. A suspended account receives nothing. The Wave 4 daily-cap and city-budget checks are inputs to the same function (`GateLimits`); Wave 2 leaves them unset.

**Channel choice.** `planChannels` decides what is worth queueing: push for a person with a working device; WhatsApp for `critical` templates whatever the person's push state; WhatsApp for other templates only when the person has no working push and the caller allows the fallback (Wave 4 turns it on per city). SMS is never queued; it is the code-delivery fallback. The send-time gate checks each row again: a non-critical WhatsApp row is refused while a working push device exists, and WhatsApp needs the template's consent. Push respects the person's push opt-out, and an invalid push token revokes that device (`devices.revoked_at`).

**Reminders.** A reconciler runs every minute and once at start. For each upcoming scheduled occurrence it computes the audience (confirmed registrants of the occurrence or its whole session, plus followers of the circle with alerts on, minus anyone without an active account or a working device), inserts one push row per person keyed `reminder:<occurrence>:<user>:push`, re-times and re-words rows still waiting when the schedule or the lead time changes, withdraws rows for cancelled occurrences or removed people, and brings a withdrawn row back if the situation reverses. Sent rows are never touched. Lead time is the `reminder_lead_minutes` setting per program (default 60). A reminder up to 30 minutes late is still sent; older ones are skipped.

**Codes bypass the outbox.** `CodeSender` (WhatsApp authentication template, then SMS) sends sign-in codes directly, because a code that waits behind a queue or is stored in a table is worse than one that fails fast. The code is never persisted or logged. In test mode it is kept in memory only (`TestCodeSender`).

**Webhook in the worker.** The worker serves `GET/POST /webhooks/whatsapp` and `/healthz` on `WORKER_HTTP_PORT`. A POST must carry a valid `X-Hub-Signature-256` (HMAC-SHA256 of the raw body, constant-time compare) or it is rejected before parsing. Events are normalised and message text is reduced to an intent (`opt_in`, `opt_out`, `other`) on the spot. Status events match a row by `biz_opaque_callback_data` (`outbox:<id>`), then by the provider message id kept in the row's payload. A STOP reply revokes the person's active WhatsApp consents; START grants `registration_updates` and `session_reminders` only. Replays are safe in both directions: a replayed STOP cannot undo a later grant and a replayed START cannot undo a later STOP. A failure to store answers 500 so Meta retries.

**Providers.** All sit behind small interfaces with an injected fetch, so tests never touch a network: FCM HTTP v1 (service-account JWT), APNs over HTTP/2 (ES256 provider token, one loopback-tested transport), web push (RFC 8291 and VAPID through the `web-push` library's request builder), WhatsApp Cloud API (positional template parameters per language, copy-code button for authentication), and a generic JSON SMS gateway. `createMessaging(env)` wires them. Fake mode (the default) and test-mode codes are refused when `APP_ENV=production`.

**Environment names.** Mode: `APP_ENV`, `MESSAGING_MODE`, `CODE_DELIVERY_MODE`, `CODE_SMS_FALLBACK`, `CODE_VALIDITY_MINUTES`. WhatsApp: `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_GRAPH_BASE_URL`, `WHATSAPP_API_VERSION`. FCM: `FCM_SERVICE_ACCOUNT_JSON`. APNs: `APNS_TEAM_ID`, `APNS_KEY_ID`, `APNS_PRIVATE_KEY`, `APNS_BUNDLE_ID`, `APNS_PRODUCTION`. Web push: `VAPID_SUBJECT`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`. SMS: `SMS_GATEWAY_URL`, `SMS_GATEWAY_KEY`, `SMS_SENDER`. Worker: `DATABASE_URL`, `WORKER_HTTP_PORT`, `WORKER_POLL_MS`, `WORKER_SEND_CONCURRENCY`, `PUBLIC_WEB_BASE`.

**Logging.** Logs carry ids, channel, template key, counts and error codes. Phone numbers, names, message bodies, template variables and tokens never reach a log: the logger drops keys with those names and redacts phone-shaped strings, and tests assert on a captured log.

## Consequences

- Pushing a `delivered` state for push needs an app-side acknowledgement; until then push rows end at `sent`.
- The outbox has no venue or provider-message-id column, so the worker keeps the provider id in the payload and resolves the venue from the payload. A schema change would make both cleaner (see the change request).
- The SMS gateway is a generic JSON stand-in. A real Pakistani gateway needs its own adapter behind `SmsProvider`.
- Meta must approve the templates (`allMetaSubmissions()` produces the submission bodies) and the Urdu text needs a native reviewer before launch.
- Wave 4 (budget, daily cap, fan-out for announcements) plugs into `GateLimits` and the `limits` hook of the processor without changing the outbox.
