---
title: Roles and permissions
description: Who can do what, and where, in plain language.
section: api
order: 50
---

# Roles and permissions

Quran Circles has three staff roles and, for everyone else, no role at all. What each person can do depends on the role and on **where** they hold it.

## The people

| Who               | How they get access                       | Where it applies               |
| ----------------- | ----------------------------------------- | ------------------------------ |
| Visitor           | Nothing needed                            | Public information only        |
| Member            | Signs in with a WhatsApp code             | Their own data                 |
| Venue coordinator | Invited by a city coordinator or an admin | One venue                      |
| City coordinator  | Invited by a national admin               | One city and every venue in it |
| National admin    | Invited by an existing national admin     | The whole country              |

Staff are also members: a coordinator can follow a venue or join a session for themselves like anyone else.

Roles are read from the database on every request, not from the token. A handover or a revoked role takes effect at once. History stays; the previous coordinator loses access immediately.

## What each can do

`own` means the person's own records only. `place` means within the venue, city or country they hold.

| Capability                                                                | Visitor | Member | Venue coordinator                     | City coordinator | National admin          |
| ------------------------------------------------------------------------- | ------- | ------ | ------------------------------------- | ---------------- | ----------------------- |
| Browse venues, sessions, places, help pages                               | Yes     | Yes    | Yes                                   | Yes              | Yes                     |
| Ask for a sign-in code                                                    | Yes     | Yes    | Yes                                   | Yes              | Yes                     |
| Join a session, follow venues, keep bookmarks and days read, read Updates |         | own    | own                                   | own              | own                     |
| Change consents, devices; delete the account                              |         | own    | own                                   | own              | own                     |
| See who joined a session, with names and numbers                          |         |        | place                                 | place            | place                   |
| Export registrants                                                        |         |        | place                                 | place            | place                   |
| Mark attendance                                                           |         |        | place                                 | place            | place                   |
| Create and edit sessions, change a time, cancel one date                  |         |        | place                                 | place            | place                   |
| Create and edit circles                                                   |         |        | place (new circles wait for approval) | place            | place                   |
| Approve or reject a circle                                                |         |        |                                       | place            | place                   |
| Create or archive a venue                                                 |         |        |                                       | place            | place                   |
| Edit a venue, its public number and facilities                            |         |        | place                                 | place            | place                   |
| Post an update                                                            |         |        | venue                                 | city             | everyone                |
| Make posters                                                              |         |        | place                                 | place            | place                   |
| Set the ayah of the day                                                   |         |        | venue or circle                       | venue or circle  | national, venue, circle |
| Invite or hand over a venue coordinator                                   |         |        |                                       | place            | place                   |
| Invite a city coordinator or a national admin                             |         |        |                                       |                  | Yes                     |
| Read the audit log                                                        |         |        |                                       | place            | place                   |
| Platform settings (for example the Hijri date offset)                     |         |        |                                       |                  | Yes                     |

## Rules that always hold

- **Out of scope looks like it does not exist.** A coordinator asking for another city's session gets `not_found`, so the answer does not reveal what exists.
- **Phone numbers stay private.** Coordinators see the numbers of people who joined their own sessions. Members see only the venue's public contact number.
- **Everything staff do is audited.** Who, what, where and when are recorded. Cell contents of exports and imports are not; only counts are.
- **A national admin cannot be left without one.** The last national admin cannot be removed or delete their account.
- **Messages stay in scope.** A coordinator can only post to the people connected to their own venue or city.

The full matrix lives in the contract (`packages/contracts/SCOPES.md` in the repository) and is checked by tests for every role. This page is the plain-language version.
