---
title: Webhooks
description: The WhatsApp webhook Quran Circles receives from Meta, and the fact that there are no outbound webhooks yet.
section: api
order: 70
---

# Webhooks

There is exactly one webhook, and it points **into** Quran Circles. Meta calls it. You do not.

## WhatsApp webhook (Meta to Quran Circles)

Quran Circles sends sign-in codes, confirmations, reminders and changes through the WhatsApp Cloud API. Meta reports what happened to each message, and what people reply, by calling:

```text
{{API_BASE_SITE}}/webhooks/whatsapp
```

This address is **not** under `/api`; the proxy sends it to the background worker. It is set once in Meta Business Manager by the operator.

### Handshake (GET)

When the operator saves the callback in Meta, Meta sends a `GET` with `hub.mode=subscribe`, `hub.verify_token` and `hub.challenge`. The service answers the challenge only if the token matches the one the operator configured; otherwise `403`. If the webhook is not configured the answer is `503`, so a half-set-up server is obvious.

### Events (POST)

Meta sends `POST` requests with a JSON body and an `X-Hub-Signature-256` header: an HMAC-SHA256 of the raw body, keyed with the app secret. The service:

1. checks the signature on the raw bytes. A wrong or missing signature is `401`, and nothing is stored;
2. parses the JSON. Signed but unreadable is `400` (Meta does not retry it);
3. applies the events, and answers `200` only after they are stored. If storing fails the answer is `500`, so Meta retries.

Two kinds of event matter:

| Event                                                   | What Quran Circles does                                                                                                                          |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Delivery status (`sent`, `delivered`, `read`, `failed`) | Updates the message's record. Statuses only move forward, so a late or repeated report cannot undo a later one. `read` is stored as `delivered`. |
| A reply of STOP or START                                | Withdraws or grants WhatsApp consent. A repeated STOP cannot undo a later opt-in, and a repeated START cannot undo a later STOP.                 |

Limits and care taken: the body is capped at 1 MB; phone numbers are looked up and never logged; processing is safe to repeat.

> **Internal.** Secrets (app secret, verify token, access token) are set only in the deployment tool. They never appear in this repository or on these pages.

### Who should use this

Only the operator who owns the WhatsApp Business account. An integration partner does **not** receive this webhook and should not point their own system at the address.

## Outbound webhooks (Quran Circles to a partner)

**Not available.** The API does not call other systems when a session changes or someone joins. Anything that needs this today has to poll, and the public API has no "changed since" filter. The ERPNext guide describes a signed outbound webhook and a pull endpoint as possibilities, with the open questions; nothing is decided: see [ERPNext integration](erpnext.md).
