# Data model

One schema serves both programs. The contracts lane (WP1) turns this into the Drizzle schema in `packages/db`; this file is the brief, not the schema.

## Hierarchy and scopes

```
Country > Province > City > Area > Venue > Circle (optional) > Session > Occurrence
```

- A national admin acts everywhere.
- A city or regional coordinator acts on everything under their city.
- A venue coordinator acts on everything under their venue.

Every permission is a role assignment with a scope (a city or a venue). The scope matrix lives in `packages/contracts` and is the single source for the API, the apps and the tests.

## Tables

| Group               | Tables                                                                                                       | Purpose                                                                                                                               |
| ------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| Places              | provinces, cities, areas, venues (with facilities)                                                           | The hierarchy. Venues hold the public contact number, map position and facilities checklist                                           |
| Programs            | programs, seasons, circles, sessions, occurrences (with portion and recap note)                              | Dora and Circles share one session model. Dora has a season row per Ramadan                                                           |
| People              | users, profiles, role_assignments, devices                                                                   | Phone-verified accounts, optional profile fields, roles with a scope, push tokens per device                                          |
| Participation       | registrations, follows, consents, attendance, circle_progress, circle_requests, bookmarks, reading_positions | Who registered or follows what, consent records, coordinator attendance marks, circle progress, demand requests, synced reading state |
| Messaging           | updates, update_reads, message_templates, message_outbox                                                     | Feed items by scope, per-person read state for badges, approved wording, every outgoing message with status and cost category         |
| Posters and content | poster_templates, posters, content_pages                                                                     | Locked templates, generated posters with the session details they were made from, editable pages in English and Urdu                  |
| Safety              | audit_log                                                                                                    | Who changed what, and in which scope                                                                                                  |
| Legacy              | legacy_registrations, legacy_whatsapp_subscribers                                                            | Ramadan 2026 data kept apart from new accounts; subscribers are marked as needing re-consent                                          |

Facilities checklist on a venue: women's section, parking, wudu area, access for elders and wheelchairs, child-friendly, entrance notes.

## Rules

- **Identity:** the verified phone number is the account. Store it normalised (E.164, +92 for Pakistan).
- **Session and occurrence:** a session is a recurring schedule or a one-off lecture. An occurrence is one dated instance. Attendance, portion, recap and circle progress attach to occurrences.
- **Time:** store UTC, show Pakistan time (UTC+5).
- **Deletion:** deleting an account removes personal data and keeps only anonymised counts.
- **Consent:** every consent row has a channel, a purpose, a granted time and a revoked time. The worker checks it before every WhatsApp send.
- **Audit:** every write by an admin or coordinator writes an audit row with actor, action, entity and scope.
- **Circle requests:** area-level only, one active request per person per area, with an expiry; the person can cancel.
- **Poster accuracy:** a poster stores the session details it was made from, so the console can flag it out of date when the session changes.
- **Migrations:** reversible SQL. Never edit a migration that has been applied; add a new one.
- **Attendance for drop-ins:** a headcount plus optional names.
