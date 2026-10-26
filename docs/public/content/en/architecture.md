---
title: Architecture overview
description: How the apps, the API, the background worker and the database fit together, without internal detail.
section: platform
order: 10
---

# Architecture overview

A public-safe map of how Quran Circles fits together. It explains the shape and the reasons. Hostnames of internal services, secrets, exact limits and anything that would help an attacker are deliberately left out.

## The big picture

```text
  Member app (iOS, Android, web)     Coordinator app          Admin console (web)
                  \                        |                        /
                   \---------- HTTPS ------+------------------------/
                                          |
                                  Reverse proxy (TLS, security headers)
                                   /               |                \
                          Static web apps       API (/api)       Worker (WhatsApp webhook)
                                                   |                  |        |
                                                   +---- PostgreSQL ---+        +--> Poster renderer
                                                                              +--> WhatsApp, push
```

- **Clients** talk only to the API over HTTPS. Nothing else reaches the database.
- **The API** validates every request against one shared contract, checks the caller's role and place, and writes rows. It never sends a message itself.
- **The worker** does everything that leaves the system: reminders, push, WhatsApp messages, poster renders. It claims work from queues stored in the same PostgreSQL database, so there is no separate queue service to run.
- **The poster renderer** is isolated. Only the worker can reach it, and it has no internet and no database.
- **PostgreSQL** is the single source of truth. Each service connects with its own least-privilege database role; the API cannot change the schema.

## The three apps

| App             | For                                                                 | Built with                                                                                      |
| --------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Member app      | Finding and joining sessions, reminders, Quran reader, prayer times | Expo (React Native) for Android and iOS; the web version is the same code and installs as a PWA |
| Coordinator app | Today's session, attendance, updates, changing a time, posters      | The same stack, for coordinators on phones                                                      |
| Admin console   | Reports, bulk import, exports, coordinators, audit log              | React and Vite, for desktop browsers                                                            |

All three share one typed API client generated from the contract, one set of design tokens, and one set of English and Urdu strings. Layout uses logical properties only, so the same screens mirror for Urdu right-to-left.

## One contract

Every request and response shape, every error code and the role-and-scope matrix live in one package, the contract. From it the build generates:

- the typed client used by all three apps;
- the OpenAPI document that produces the [API reference](api-reference.md) (contract version {{CONTRACT_VERSION}});
- a mock server, so each app's tests render real screens without a network.

The API checks its own responses against the contract before sending them. A response that does not match is a bug caught in testing, not a surprise in production.

## Places and people

The place hierarchy is Country, Province, City, Area, Venue. A venue runs one or more **sessions**: a recurring schedule or a one-off lecture. An **occurrence** is one dated instance of a session; attendance and the day's Quran portion attach to it. Joining a session is a **pledge**, not a reserved seat.

Roles are national admin, city coordinator and venue coordinator, each scoped to a place ([roles and permissions](api-roles.md)). Roles are read from the database on every request, so a handover is immediate.

## Messages

Every notification is a row in an outbox table with a key that makes repeats harmless. The worker checks consent and spending caps, sends through the right channel, and records the result. Order of preference:

1. on-device reminders and in-app feed (free);
2. push (free per message);
3. WhatsApp, which Meta bills per message, so it is used for sign-in codes, confirmations, critical changes and people with no working push.

One tap stops WhatsApp messages. Delivery receipts and STOP replies return through the [WhatsApp webhook](api-webhooks.md).

## Quran and prayer times

Quran text is fetched from a public source and cached on the device; the platform stores no Quran text of its own. Prayer times are computed on the phone (Karachi method, Hanafi Asr) in Pakistan time. The Hijri date uses a built-in table plus an admin-set offset, because months in Pakistan begin by moon sighting.

## Posters

A coordinator picks a template and types a few fields. The date, time and venue come from the session, so a poster cannot disagree with it. The API queues a render, the worker has the renderer lay the poster out with a proper Urdu typeface and produce a PNG or PDF, and the file is stored privately. If the session changes later the poster is marked out of date and can be remade.

## Safety by design

- Personal data is kept until the person deletes their account; deletion removes the profile, registrations and devices, and leaves only anonymised counts.
- No personal data in logs: no phone numbers, names or message bodies.
- Inputs are validated on every request; free text rejects characters that could disguise or reorder text.
- Staff actions are audited. Sign-in has its own rate limits.
- Data stays on infrastructure the owner controls. WhatsApp and push providers act as service providers for delivery only.

See [deployment](deployment.md) for how it is run, and [accessibility and languages](accessibility.md) for the design rules.
