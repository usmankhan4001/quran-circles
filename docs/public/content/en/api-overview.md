---
title: API overview
description: Base URL, versions, formats and a first call with the Quran Circles public API.
section: api
order: 10
---

# API overview

The Quran Circles API is a JSON API over HTTPS. The apps, the web app and the admin console all use it, so everything the reference describes is in daily use.

This page covers the public part: what a visitor or a signed-in member can do. The administrator and coordinator part is not published ([why](api-staff.md)).

## Base URL

```text
{{API_BASE}}/v1
```

The health check lives one level up, at `{{API_BASE}}/health`. Every path in the [reference](api-reference.md) starts after `/api`. For example `GET /v1/sessions` is `GET {{API_BASE}}/v1/sessions`.

Staging runs separately with synthetic data. Its address is given to partners directly.

## Versioning

- The version is in the path (`/v1`). A breaking change gets a new path.
- The contract carries its own version, currently **{{CONTRACT_VERSION}}**. It is a release candidate: new fields can be added to responses, so ignore fields you do not know.
- Error codes and their HTTP statuses do not change within a version.

## Formats

| Thing                  | Format                                                                                          |
| ---------------------- | ----------------------------------------------------------------------------------------------- |
| Bodies                 | JSON, `Content-Type: application/json`, UTF-8                                                   |
| Instants               | UTC ISO 8601, for example `2027-02-18T01:15:00Z`. Show them in Pakistan time (UTC+5).           |
| Dates and times of day | Local to the session: `2027-02-18` and `19:30` (24 hour clock)                                  |
| Phone numbers          | E.164, for example `+923001234567`                                                              |
| Ids                    | UUID strings                                                                                    |
| Days of the week       | 0 is Sunday, 6 is Saturday                                                                      |
| Names and place text   | A `Localized` object: `{ "en": "...", "ur": "..." }`. `ur` can be `null`; fall back to English. |

Responses carry both languages together; the client picks one. Send an `X-Request-Id` (letters, digits and dashes) to follow a call through support; every response returns one in the same header.

## Who can call what

- **No sign-in:** browse places, venues, sessions and occurrences, read the national "people read today" number, the ayah of the day, app configuration and help pages, and ask for a sign-in code.
- **Signed in (any member):** join and leave sessions, follow venues, keep bookmarks, record days read, read the Updates feed, manage consents, devices and the account.
- **Staff (coordinators and admins):** not published.

Browsing needs no account. Joining a session needs a phone number verified by a code. See [sign-in](api-auth.md).

## Browser access

Browsers may call the API only from Quran Circles' own web addresses (CORS is an allow list). Server-to-server calls are not affected, but an integration should not rely on browser access. Calls from a partner's website need a partner arrangement; see [ERPNext integration](erpnext.md) for what that would involve.

## A first call

The first five published sessions, as a visitor (no sign-in):

```bash
curl -s "{{API_BASE}}/v1/sessions?limit=5"
```

```json
{
  "items": [{ "id": "00000000-0000-4000-8000-000000000001", "...": "..." }],
  "nextCursor": "opaque-string-or-null"
}
```

Add `cityId` (from `GET /v1/places/cities`), `dayOfWeek`, `timeFrom`, `timeTo`, `section` or `language` to filter. The [pagination rules](api-conventions.md#pagination) explain `nextCursor`.

## What is not in the API

- **Seats.** Joining a session is a pledge to attend. The API does not reserve seats or show seat counts. A session can carry an optional limit that is off by default; when it is on, extra people are told they are waiting for confirmation.
- **Quran text.** The API returns surah and ayah numbers only. The reader fetches and caches the text from its own source.
- **Partner keys and outbound webhooks.** There is no API key for a partner system and the API does not call other systems when something changes. [The ERPNext guide](erpnext.md) explains the gap and the proposed fix.
