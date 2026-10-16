# Brief: messaging

Lane: messaging
Work packages: WP4 (Wave 2), WP14 (Wave 4)
Wave: 2 and 4
Priority: P0 for WP4, P1 for WP14
Approval: human, for the whole lane

## Goal

Everything that sends: the job queue, reminders, push, and the official WhatsApp client, all behind provider interfaces with fake providers for tests. The lane implements the messaging rules exactly: push and on-device first, WhatsApp only where nothing else works, consent checked before every send, a daily cap, and city budgets.

## You own

`apps/worker/` and `packages/messaging/`.

## You must not touch

`apps/api/` (the api-core lane writes the outbox rows; you consume them), `packages/contracts/`, `packages/db/`.

## Read first

`docs/product/messaging.md` (the rules), `docs/product/data-model.md` (message_outbox, consents, devices), the frozen message formats in `packages/contracts`.

## Deliverables

Wave 2 (WP4):

1. **Provider interfaces** in `packages/messaging`: `PushProvider`, `WhatsAppProvider`, `SmsProvider`, each with a fake used by every test.
2. **Queue.** pg-boss in the worker consuming `message_outbox`. Idempotency keys, retries with backoff, a dead-letter state, and a status per message.
3. **Reminders.** Scheduled relative to each session's start time, configurable per program, recomputed when a session changes.
4. **Push.** FCM and APNs for the apps and web push for the PWA, stale-token cleanup, delivery status.
5. **WhatsApp client.** Meta's Cloud API: send approved templates, receive delivery webhooks with signature verification, record opt-in and opt-out. Templates for login code and registration confirmation, in English and Urdu (Urdu as draft until reviewed).
6. **Consent gate.** Every WhatsApp send checks consent. No consent, no send.
7. **Code delivery** for the auth-scopes lane: the provider interface it calls for sign-in codes, with an SMS fallback and a test mode.

Wave 4 (WP14):

8. **Fallback reminders** over WhatsApp for people without a working push token.
9. **Daily cap** of one WhatsApp template message per person per day, settable.
10. **City budgets** with an alert as a city nears its monthly limit.
11. **Spend report** data by city and template category for the console.

## Definition of done

- No test calls Meta, Google, Apple or an SMS service. Fakes only.
- Duplicate outbox rows never produce duplicate messages (idempotency tested).
- Failed sends retry and then land in the dead-letter state, visibly.
- A message to a person without consent is never sent (tested).
- A human has approved WhatsApp template wording and the consent gate.

## Commands that must pass

```sh
pnpm check
pnpm --filter @qc/worker test
pnpm --filter @qc/messaging test
```

## Decisions to respect

Push and on-device reminders first; WhatsApp only for codes, confirmations, critical changes, or people with no working push. Meta bills per delivered message, and the free in-window rule may have ended on 1 October 2026 (unverified), so assume it is not free. Coordinators send only within their own scope, and every send is logged with sender and recipient count. Never log numbers, names or message bodies.

## Stand-ins

Meta not verified: everything runs on the fake provider. No FCM or APNs credentials: run against fakes and keep real credentials out of the repository.
