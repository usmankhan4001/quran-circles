---
title: The staff API (not published)
description: Why the administrator and coordinator endpoints are not in the public reference, and how partners get access.
section: api
order: 60
---

# The staff API (not published)

The API has a second group of endpoints, under `/v1/admin`, that the coordinator app and the console use. They are **not** documented here, and this is on purpose.

> **Internal.** This is a recommendation for the owner to confirm. The reference can be extended later by publishing a separate, reviewed document for a named partner.

## Why they are left out

| Reason                         | Detail                                                                                                                                                                                   |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| They reach other people's data | Coordinators see the names and phone numbers of everyone who joined their sessions, and can export them. A published recipe makes a stolen coordinator login more useful to an attacker. |
| They spend money               | Updates, invitations and schedule changes send WhatsApp messages that Meta bills per message. Limits exist, but the less a stranger knows about the paths and ceilings, the better.      |
| They change who has access     | Inviting, assigning and handing over roles, and the bulk imports, are the highest-risk operations. They are reviewed by a human before each change.                                      |
| They are built for two clients | The endpoints follow the needs of the console and the coordinator app and change with them. A published promise would slow both down.                                                    |
| The audience is small          | The people who need them already have the apps.                                                                                                                                          |

The public reference stays complete for everything a visitor or member can do, which is what an outside developer normally needs.

## What the staff API does, at a high level

So that integrators know what exists without a recipe for misuse:

- Venues, circles and sessions: create, edit, approve, archive; change a session time or cancel one date.
- Registrants and attendance: list who joined, export a file, mark who came.
- Updates: post a message within a venue, a city or the country, with a preview of how many people it reaches.
- Posters: make, remake and download session posters.
- Roles: invite, assign, hand over and revoke coordinators, one at a time or by file.
- Bulk import of venues, sessions and coordinators, with a dry run first.
- Audit log and platform settings.

Every one of these is checked against the person's role and place on every call ([roles and permissions](api-roles.md)).

## If a partner needs something from it

Do not ask a coordinator to share their sign-in. Ask the owner for a **partner arrangement**. There is no partner key today; [the ERPNext page](erpnext.md) describes what has to be built (a scoped, read-only key with its own limits and an audit trail) and the questions that decide its shape.
