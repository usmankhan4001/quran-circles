# Notifications and messaging

Reminders cost nothing when they come from the phone and a fee when they come over WhatsApp, so the platform sends them from the device first and uses WhatsApp only where nothing else works.

## Channels

| Channel                 | Used for                                                                                                             | Cost                                 | Notes                                             |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------- |
| On-device reminders     | Session reminders, scheduled from the session schedule                                                               | None per message; offline            | Native apps only. Adhan sound alarms are later    |
| Native push (FCM, APNs) | Session reminders, Updates, changes of time or venue                                                                 | None per message                     | Needs the app and notification permission         |
| Web push                | The same, for PWA users                                                                                              | None per message                     | On iPhone only after Add to Home Screen           |
| In-app feed             | Updates, announcements, history with unread badges                                                                   | None                                 | Always available inside the app                   |
| WhatsApp (official API) | Login codes, registration confirmation, critical changes, fallback for people without push, one reminder per session | Billed per delivered message by Meta | Templates need approval; consent must be recorded |

## Rules

- **Order:** push and on-device reminders first. WhatsApp only for codes, confirmations, critical changes, or people with no working push.
- **Cap:** at most one WhatsApp template message per person per day, with a monthly budget per city and an alert as it nears the limit. Both are settings, not code.
- **Timing:** reminders are relative to each session's own start time, configurable per program.
- **Consent:** a checkbox at registration and a per-venue Alerts toggle. Store the consent time. One tap stops messages.
- **Scope:** admins and coordinators send only within their own city or venue. Every send is logged with who sent it and how many people received it.
- **Privacy:** coordinators see registrants' numbers. Attendees see only the venue's contact number.
- **Visibility:** the console shows message spend, deliveries and failures by city and category.
- **Pricing assumption:** Meta bills per delivered message since 1 July 2025. A third-party report says free in-window messages end on 1 October 2026; this is unverified, so budgets assume in-window messages are not free.
- **Provider interface:** push, WhatsApp and SMS sit behind interfaces in `packages/messaging`, each with a fake provider used by every test.
- **Sign-in codes:** delivered by a WhatsApp authentication template. Until Meta verifies the sender number, an SMS gateway may be used as a fallback. Tests and staging use a test mode.
- **Outbox:** every message is a row in `message_outbox` with an idempotency key, a status and a cost category. Retries use backoff and a dead-letter state.

## Updates feed reach

National updates reach everyone. City and venue updates reach people connected to them: registered, following, or in that city. Admins and coordinators post within their own scope. Unread state is per person.
