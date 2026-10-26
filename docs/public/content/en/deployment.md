---
title: Deployment overview
description: How Quran Circles is built, released, backed up and watched, in public-safe terms.
section: platform
order: 20
---

# Deployment overview

How the platform is run. This is the public summary; the operator's runbook has the commands and is not published.

## Environments

| Environment | Data                                         | Messages                                              |
| ----------- | -------------------------------------------- | ----------------------------------------------------- |
| Development | Synthetic seed data on a developer's machine | Fake providers; nothing is sent                       |
| Staging     | Synthetic data                               | Fake providers; a fixed test code instead of WhatsApp |
| Production  | Real                                         | Real WhatsApp and push                                |

Production serves the web app at `https://qurancircle.doraquran.pk` and the API under `/api` on the same address. The admin console has its own address and is not linked from public pages.

## What runs

One group of containers, described by a single Compose file, plus a small override per host:

| Service         | Role                                                                                                                     |
| --------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Web             | Serves the member web app and the console; routes `/api` to the API and the webhook to the worker; sets security headers |
| API             | The HTTP API                                                                                                             |
| Worker          | Background jobs, outgoing messages, the WhatsApp webhook                                                                 |
| Poster renderer | Draws posters; reachable only by the worker                                                                              |
| PostgreSQL 16   | The database, on an internal network with no published port                                                              |
| One-shot jobs   | Create database roles, apply migrations, install the queue schema, in that order, before the API starts                  |

Every long-running service has a health check, a read-only filesystem, no extra Linux capabilities and resource limits. The proxy starts only after the API and worker are healthy.

## Releases

- Every change passes type checking, linting, automated tests and a format check before it can join the main branch. The checks run on every push.
- Production is updated from the main branch. Work that is not meant to go live stays on its own branch until it is.
- Database changes are written to be backward compatible, so a rollback of the code does not need a rollback of the data.
- Each deploy tags images with the commit, takes a backup first and rolls back by itself if a health check fails.
- Secrets (database passwords, signing keys, provider tokens) are entered in the deployment tool or generated on the server. They are never in the repository, in logs or in documents like this one.

## Backups and recovery

- Daily database backups, kept for a fixed number of days in private storage away from the server. Where the host allows it, backups are also encrypted with a key that never lives on the production server.
- Restores are rehearsed, not assumed: a restore into a scratch database proves each backup path. Deleted accounts can remain in backups until they age out.

## Monitoring

- An external uptime check calls the public health address (`{{API_BASE}}/health`) and alerts the owner's phone.
- On the host: container health, disk space, backup age and certificate expiry are checked every few minutes, and failures raise an alert.
- Request logs hold a request id, the route and the status. They never hold query strings, bodies, names or phone numbers.

## Capacity

Planned for about 200 venues and under 50,000 members in the first season, growing nationally. Load tests are re-run at the launch size. A few minutes of downtime on a Ramadan evening is acceptable; a standby server can be added later.

## Mobile apps

- Android is released through Google Play, starting with the internal test track. iOS follows later.
- The web app installs as a PWA and is the fallback if a store release is delayed.
- The app's API address is set per build, so one source produces staging and production builds.
