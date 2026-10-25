---
title: ERPNext integration guide
description: How Quran Circles and an ERPNext (Frappe) site can exchange data, what works today, what has to be built, and the questions that decide the design.
section: integrations
order: 10
---

# ERPNext integration guide

This guide is for Muhammad's ERPNext (Frappe) instance. It covers how the two systems can talk, which parts work **today**, which parts need new work in Quran Circles first, and the exact questions that have to be answered before building.

> **Warning.** Quran Circles has **no partner API key and no outbound webhooks today**. Nothing below that says "proposed" exists in the product. No ERPNext address, DocType or field name has been supplied yet, so none is assumed here; everything specific to the ERPNext site is a question in [the list further down](#questions-for-muhammad).

## What exists today

Checked against the API contract (version {{CONTRACT_VERSION}}), the API source, the worker and the repository's documents. There were no earlier ERPNext notes or code in the repository.

| Need                                                      | Today                | Detail                                                                                                                        |
| --------------------------------------------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Read venues, sessions, occurrences, places                | **Yes, with no key** | Public endpoints, see the [reference](api-reference.md). No "changed since" filter, so a sync reads whole lists page by page. |
| Read who joined (names, numbers, attendance)              | **No**               | Only staff of the venue, city or country can, through the unpublished staff API, and they sign in with a WhatsApp code.       |
| Create or change venues and sessions from outside         | **No**               | Same staff API.                                                                                                               |
| A key for a system (not a person)                         | **No**               | The only sign-in is a person with a phone number and a code. There is no service account, API key or client secret.           |
| Quran Circles calls another system when something happens | **No**               | No outbound webhooks. The only webhook points inwards, from Meta ([webhooks](api-webhooks.md)).                               |
| Calls from a partner's browser page                       | **No**               | The API allows browsers only from Quran Circles' own addresses.                                                               |

Practical consequence: ERPNext can read the public catalogue now, but anything involving people, attendance, writes or real-time events needs new work.

### Why not just use a coordinator's login

A system cannot receive a WhatsApp code, a login shared by several people breaks the audit trail, and a coordinator's role is wide: it exposes the phone numbers of everyone in their scope. Sharing a login is the shortcut to avoid.

## Frappe and ERPNext in brief

What the ERPNext side offers (these are standard Frappe features; confirm the version in the questions below):

| Capability            | How                                                                                                                                                                                                              |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| REST over DocTypes    | `GET/POST /api/resource/<DocType>`, `GET/PUT/DELETE /api/resource/<DocType>/<name>`. Lists take `fields`, `filters`, `limit_start` and `limit_page_length`.                                                      |
| Calling your own code | `POST /api/method/<dotted.path>` for functions marked `@frappe.whitelist()`                                                                                                                                      |
| Authentication        | An API key and secret from a user's "API Access" panel, sent as `Authorization: token <api_key>:<api_secret>`; or OAuth 2 bearer tokens; or a session cookie after login. Use a dedicated, least-privilege user. |
| Outbound events       | The **Webhook** DocType sends an HTTP request when a document is inserted, updated, submitted, cancelled or deleted, with an optional condition and a signature header. It sends only; it does not receive.      |
| Inbound events        | A whitelisted method with `allow_guest=True` that checks a signature itself                                                                                                                                      |
| Scheduled work        | `scheduler_events` in a custom app's `hooks.py` (every hour, daily, cron)                                                                                                                                        |

Example: reading from ERPNext.

```bash
curl -s "https://<erp-host>/api/resource/<DocType>?fields=%5B%22name%22%5D&limit_page_length=20" \
  -H "Authorization: token <api_key>:<api_secret>"
```

Never paste a real key or secret into a chat, a ticket or a repository. The owner sets them directly in the deployment tool's environment settings.

## Three ways to connect, in order of effort

### Option 1: pull the public catalogue into ERPNext (works today)

A scheduled job on the ERPNext side calls the public API and writes venues and sessions into DocTypes. No change to Quran Circles.

- **Good for:** master data in ERPNext (a list of venues and circle schedules for reports, projects, budgets or cost centres).
- **Limits:** read-only; no people; whole-list reads; the data is public anyway.
- **Effort:** a small custom Frappe app, a few hundred lines.

A starting point for the Frappe side (one scheduled function; adapt the DocType and fields after the questions are answered):

```python
import requests, frappe

API = "{{API_BASE}}/v1"

def sync_venues():
    cursor = None
    while True:
        params = {"limit": 100, **({"cursor": cursor} if cursor else {})}
        r = requests.get(f"{API}/venues", params=params, timeout=20)
        r.raise_for_status()
        page = r.json()
        for v in page["items"]:
            upsert_venue(v)           # write to your DocType, matching on v["id"]
        cursor = page["nextCursor"]
        if not cursor:
            break
    frappe.db.commit()
```

Match records on Quran Circles' `id` (a UUID), keep it in a read-only field, and never match on a name. Respect the `429` and `Retry-After` rules in [errors, limits and pagination](api-conventions.md).

### Option 2: partner key plus a "changed since" feed (needs building)

**Proposed.** A key that belongs to a system, not a person, with read access to exactly what the integration needs.

- **Actor.** A new kind of caller, `integration`, in the role-and-scope matrix, with its own small set of actions (for example read the sessions and registrations of one city). It never gets role-management, invitations, messaging, exports or settings.
- **Key.** Created by a national admin in the console, shown once, stored only as a hash. It can be rotated and revoked at once, records when it was last used, is limited to a place (country or city) and has its own rate limit bucket.
- **Sending.** `Authorization: Bearer <key>` over HTTPS. Optionally an IP allow list for the ERPNext host.
- **Feed.** New read endpoints with an `updatedSince` filter and a cursor, returning the minimum fields the integration needs (see question 7 on personal data). Deletions and cancellations are returned as states, not silently removed.
- **Audit.** Every call is recorded with the key id and counts, never with cell contents.
- **Governance.** Partner keys touch sign-in, scope checks and personal data, so they need a contract change request, a human approval and a security review before building. The request is drafted: `docs/engineering/change-requests/2026-10-26-partner-api-and-webhooks.md` in the repository.

### Option 3: add outbound webhooks (needs Option 2 first)

**Proposed.** Quran Circles tells ERPNext when something happens, so ERPNext does not poll.

- **Events.** For example `registration.created`, `registration.cancelled`, `session.created`, `session.updated`, `session.cancelled`, `attendance.recorded`. The final list comes from question 5.
- **Delivery.** From the existing background worker, through the same outbox pattern that makes message sends safe to repeat: each delivery has an id, is retried with backoff for a stated time, and ends in a dead-letter state that an admin can see and replay.
- **Signature.** An HMAC-SHA256 of the timestamp and raw body with a secret per endpoint, in a header, plus the timestamp. The receiver rejects anything older than a few minutes and anything whose signature does not match, comparing in constant time. The secret is shown once and can be rotated.
- **Receiver.** On Frappe, a whitelisted method with `allow_guest=True` that verifies the signature before touching any data and answers `2xx` only after saving. Frappe's own Webhook DocType cannot receive, so this needs a small custom app.

```python
# Proposed receiver on the ERPNext side. Header names are placeholders until the contract is agreed.
import hmac, hashlib, time, frappe

@frappe.whitelist(allow_guest=True)
def qc_webhook():
    body = frappe.request.get_data()
    ts = frappe.get_request_header("X-QC-Timestamp") or ""
    sig = frappe.get_request_header("X-QC-Signature") or ""
    secret = frappe.conf.get("qc_webhook_secret", "").encode()
    expected = hmac.new(secret, ts.encode() + b"." + body, hashlib.sha256).hexdigest()
    if not ts.isdigit() or abs(time.time() - int(ts)) > 300 or not hmac.compare_digest(sig, expected):
        frappe.throw("invalid signature", frappe.AuthenticationError)
    # parse, de-duplicate on the delivery id, save, then return
```

### Recommended order

1. Answer the questions below.
2. Build Option 1 if venue and session master data is all that is needed. It can ship without touching Quran Circles.
3. If people or attendance are needed, approve the partner key (Option 2). Start with **read-only** and one city.
4. Add outbound webhooks (Option 3) only if polling the feed is too slow for the use.
5. Writes from ERPNext into Quran Circles (for example creating sessions) come last, if at all, and need their own review.

## Push, pull and webhooks compared

|                           | Pull (scheduled)                         | Webhook (push)                       | Two-way                       |
| ------------------------- | ---------------------------------------- | ------------------------------------ | ----------------------------- |
| Freshness                 | As often as the schedule                 | Seconds                              | Seconds                       |
| Moving parts              | One job on one side                      | Receiver, signature, retries, replay | Both, plus conflict rules     |
| If the other side is down | The next run catches up                  | Retries, then a dead-letter list     | Needs a reconciliation report |
| Load                      | Predictable, wasteful if nothing changed | Proportional to activity             | Both                          |
| Available                 | Option 1 now; Option 2 for people        | After Option 3                       | Not planned                   |

A hybrid is usual: webhooks for speed and a nightly pull to reconcile anything missed.

## Questions for Muhammad

Answer these and the design can be finished. Please answer in the thread or in a document; send **no** keys, secrets or personal data.

### The ERPNext site

1. **Base URL** of the production site (and of any test or staging site), for example `https://erp.example.com`. Is it reachable from the internet, or only behind a VPN, a tunnel or an IP allow list? If restricted, which addresses may Quran Circles' server connect from?
2. **Version and hosting.** ERPNext and Frappe version (14, 15 or newer), and whether it is on Frappe Cloud or self-hosted. Is the Frappe REST API enabled and are there request limits on your plan or proxy?
3. **Integration user.** May a dedicated user (for example `quran-circles-integration`) be created with a role limited to the DocTypes below? Who generates its API key and secret, and where will they be stored (they go directly into the deployment tool's environment settings by the owner, never into chat or code)?
4. **Time zone and language.** The site's time zone, and whether DocTypes need Urdu fields. Quran Circles sends UTC instants and local dates and times for each session's own time zone.

### What the data should do

5. **Purpose and events.** What should ERPNext do with Quran Circles data (reports, projects, a donor or volunteer list, attendance records, billing later)? Which events matter: a person joining, a person cancelling, a session created, moved or cancelled, attendance recorded?
6. **DocTypes and fields.** For each thing ERPNext should hold:
   - the DocType name (existing, or new custom ones);
   - every field: fieldname, type, mandatory or not, and link fields (for example Territory, Cost Center, Project, Customer, an Education or Event DocType);
   - the naming series or the key that identifies a record.

   The quickest answer is the JSON from `GET /api/resource/DocType/<name>` or an exported fixture, with no data in it.

7. **Personal data.** Which person fields may leave Quran Circles (name, phone number, area, section, consent)? Members agreed to messages from Quran Circles, not necessarily to be stored in another system. The privacy page must say so and consent may need to cover it. The default proposal is **no personal data at all** in the first release (venues, sessions and counts only).
8. **Identity.** How does ERPNext identify a person (mobile number, email, an existing Customer or Contact)? How are duplicates handled, and what about numbers that change?

### Direction and timing

9. **Direction per thing.** For venues, sessions, registrations and attendance: Quran Circles to ERPNext, ERPNext to Quran Circles, or both? If both, which side wins on a conflict, and what happens on delete or cancel?
10. **Push or pull.** Real time through webhooks, or a schedule (hourly, nightly)? What is the acceptable delay? Expected volume: venues (about 200 are planned), members (up to about 50,000 in the first season), joins per day at the peak.
11. **Receiving webhooks.** If push: can the ERPNext site accept a public HTTPS call at an address you control, and can your team build or accept the small custom app that verifies the signature?
12. **When ERPNext is down.** How long should Quran Circles keep retrying, and who is alerted? Is a daily reconciliation report wanted?

### Delivery

13. **Who builds the Frappe side?** The Quran Circles team (we need a test site and developer access) or Muhammad's team (we supply the contract and examples)?
14. **A test site** with synthetic data, and a target date to go live.
15. **Money.** Quran Circles has no fees or billing in this release. Does the integration involve donations, invoices or payments? If so, that is a separate product decision.

## What happens next

- The change request for the partner key and webhooks is written and waits for the owner's decision and a security review.
- Option 1 needs only questions 1, 2, 4 and 6 and can start as soon as they are answered.
- This page will be updated with the answers, with the real DocType names and with the exact endpoints once Option 2 is approved.
