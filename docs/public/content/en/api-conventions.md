---
title: Errors, limits and pagination
description: The error format and codes, rate limits, retries, and cursor pagination.
section: api
order: 30
---

# Errors, limits and pagination

## Errors

Every error has the same JSON shape and a stable code. Branch on `error.code`, never on text.

```json
{
  "error": {
    "code": "validation_failed",
    "messageKey": "errors.validation_failed",
    "requestId": "b3f1c0de-0000-4000-8000-000000000000",
    "issues": [{ "path": "phone", "code": "phone_not_pakistan_mobile" }]
  }
}
```

| Field               | Meaning                                                                                                                    |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `code`              | One of the codes below.                                                                                                    |
| `messageKey`        | The key of the user-facing message in English and Urdu (`errors.<code>`). The apps show their own wording for it.          |
| `requestId`         | Quote this to support. It carries no personal data. It matches the `X-Request-Id` response header.                         |
| `issues`            | Only for `validation_failed`: where the input was wrong (`path`) and a short code. It never repeats the input. At most 20. |
| `retryAfterSeconds` | Only for `rate_limited` and `otp_too_many_attempts`: how long to wait. Also sent as `Retry-After`.                         |

### Codes

{{ERROR_TABLE}}

Notes:

- `not_found` is also returned for something that exists but is not yours to see, so an id does not confirm that a record exists.
- `already_registered`, `registration_closed`, `session_full`, `session_cancelled` and `occurrence_in_past` explain why a join did not go through. `session_full` only happens when a session has an optional limit switched on.
- A `5xx` is never your input's fault. Retry reads later; for writes, check state first (see below).

## Rate limits

Limits protect people from abuse and keep a small server fast for everyone.

| Bucket         | Default               | Counted per                                         | Used by                                                         |
| -------------- | --------------------- | --------------------------------------------------- | --------------------------------------------------------------- |
| `default`      | 300 requests a minute | Signed-in person, or client address when signed out | Everything not listed below                                     |
| `registration` | 20 requests a minute  | Signed-in person                                    | Joining a session                                               |
| Sign-in        | Own limits            | Phone number and client address                     | Code requests, code checks, refresh. See [sign-in](api-auth.md) |

The numbers are settings and can change; the behaviour does not. When you are over a limit:

- the status is `429` and the code is `rate_limited`;
- `retryAfterSeconds` and the `Retry-After` header say how long to wait;
- the request had no effect, so you can repeat it after waiting.

Good clients wait the full time, then retry once, and spread background work out. Do not poll faster than once a minute for anything the apps themselves refresh less often.

Behind a shared mobile network many people share one address, so signed-out limits are generous. Sign in to get a limit that is yours alone.

## Retrying safely

The API has no idempotency-key header. Each operation says whether repeating it is safe (the "Safe to repeat" row in the [reference](api-reference.md)).

- Reads and `PUT`, `PATCH` and `DELETE` operations marked safe change nothing on a repeat.
- Creating things (for example a join) is not safe to blindly repeat. After a timeout, read your own list first (`GET /v1/registrations/mine`) to see whether it went through. A second join to the same session answers `already_registered`.
- Never retry `401 token_expired` more than once without refreshing.

## Pagination

List endpoints that can grow use cursors.

```json
{ "items": ["..."], "nextCursor": "opaque-string-or-null" }
```

- Send `limit` (1 to 100; the default is 20 on most lists).
- When `nextCursor` is not `null`, send it back as `cursor` with the same filters to get the next page. When it is `null`, you have everything.
- A cursor is opaque. Do not parse it or store it for long; it can expire.
- Do not change filters between pages.
- Short fixed lists (provinces, a person's follows) return `items` without a cursor.

```bash
curl -s "{{API_BASE}}/v1/venues?limit=50"
curl -s "{{API_BASE}}/v1/venues?limit=50&cursor=<nextCursor>"
```

## Caching

`GET /v1/community/today` can be cached for a minute. Places, venues and sessions change when coordinators edit them; do not cache them for longer than a few minutes, and never cache a signed-in response in a shared cache.
