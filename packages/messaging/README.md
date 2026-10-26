# @qc/messaging

Provider interfaces for push (FCM, APNs, web push), WhatsApp (Meta Cloud API) and SMS, each with a real and a fake implementation, plus the helpers that draft `message_outbox` rows. The API uses it to send sign-in codes and queue messages; the worker uses it to send them.

Owned by the **messaging** lane ([brief](../../docs/agents/briefs/messaging.md)). How messages flow is in [decision 0005](../../docs/engineering/decisions/0005-messaging-outbox-and-providers.md).

## What is where

| Path                  | What it is                                                       |
| --------------------- | ---------------------------------------------------------------- |
| `src/providers/`      | Real provider implementations                                    |
| `src/fakes.ts`        | Fake providers for development and tests (`MESSAGING_MODE=fake`) |
| `src/outbox-draft.ts` | `draftPushRow` and `draftTemplateRow`                            |
| `src/code-sender.ts`  | Sign-in code delivery: WhatsApp first, SMS as fallback           |
| `src/gate.ts`         | Consent and channel checks before a send                         |
| `src/env.ts`          | Reads the provider settings from the environment                 |

## Commands

```sh
pnpm --filter @qc/messaging test
```

## Email templates

`src/email/` renders the branded emails (sign-in code, welcome, join confirmation, session reminder, account deleted) in English and Urdu, light mode only:

```ts
import { render, EMAIL_FROM } from '@qc/messaging/email';
const { subject, html, text } = render('sign_in_code', 'ur', { code: '123456', minutes: 5 });
```

Addresses and links are constants in `src/email/config.ts`. To look at every template: `pnpm --filter @qc/messaging email:previews`.
