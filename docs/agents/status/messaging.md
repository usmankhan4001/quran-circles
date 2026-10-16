# Status: messaging

Updated: 2026-10-16
Branch: claude/peaceful-archimedes-ain95k (lane `messaging`, no commits made by the lane)

## Done

WP4 Wave 2 items 1 to 7. 281 tests (190 in `@qc/messaging`, 91 in `@qc/worker`), typecheck, eslint and prettier clean for both packages. No test touches a network (loopback sockets only).

- `packages/messaging`: provider interfaces and fakes (push, WhatsApp, SMS, code sender); FCM, APNs (HTTP/2), web push, WhatsApp Cloud, generic SMS gateway; consent gate (`evaluateGate`) and channel plan; retry policy; outbox row drafts; safe logger; `createMessaging(env)` wiring; webhook signature, handshake and parsing.
- `apps/worker`: outbox repo and processor (compare-and-set, `SKIP LOCKED` claims, leases, crash recovery); dispatcher; pg-boss runtime (`outbox-send`, dead-letter queue, per-minute `reminders-reconcile`); reminder reconciler; WhatsApp webhook apply (status, STOP, START) and HTTP server with `/healthz`; config and `main.ts` (`pnpm --filter @qc/worker start`).
- `CodeSender` interface plus `ProviderCodeSender` (WhatsApp auth template, SMS fallback) and `TestCodeSender`. The auth lane has not defined its own yet; mine is `send({phone, code, locale, channel, minutes?}): Promise<void>`.
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
- Auth lane: confirm `CodeSender.send` returning `Promise<void>` (it throws `CodeDeliveryError` on failure) matches their use.

## Contract change requests

- `docs/engineering/change-requests/2026-10-16-outbox-venue-and-provider-id.md`
- `docs/engineering/change-requests/2026-10-16-reminder-lead-setting.md`
- `docs/engineering/change-requests/2026-10-16-messaging-env-vars.md`
- `docs/engineering/change-requests/2026-10-16-push-delivery-ack.md`
