# Contract changelog

## 1.0.0-rc.2 (2026-10-17)

Approved by the owner in `docs/engineering/change-requests/2026-10-17-digest.md`. Database migration 0008 goes with it. Existing endpoint ids and shapes keep working, with one exception (see "Not additive").

### New endpoints (73 to 80 operations)

- `adminImport.venues`, `adminImport.coordinators`, `adminImport.sessions`: `POST /v1/admin/import/{kind}`, body `{ dryRun, rows }`, 1 to 2000 rows. The result is `{ dryRun, applied, counts, rows[] }` with one entry per row: `created`, `duplicate` or `invalid`, and `issues: { path, code }[]` for invalid rows. Nothing is written unless `dryRun` is false and no row is invalid. A duplicate is skipped, not an error. Server-only issue codes are listed in `IMPORT_SERVER_ISSUE_CODES` (`invalid_reference`, `area_not_in_city`, `forbidden`). `checkImportRows(kind, rows)` runs the per-row schema check so the server and the mock agree. Idempotent.
- `adminRegistrations.export`: `GET /v1/admin/registrations/export?cityId=&venueId=&from=&to=`, `text/csv`. Header is `REGISTRATION_EXPORT_COLUMNS`. UTF-8 without a byte order mark (the console adds it). People-supplied text starting with `= + - @`, tab or carriage return is neutralised (`csvCell`, exported from `@qc/contracts`). `from` and `to` are inclusive Pakistan-local dates of the registration. At most `REGISTRATION_EXPORT_MAX_ROWS` (50,000) rows. `registrations.export` stays as it was.
- `adminSessions.get`, `adminCircles.get`: one record, the same shape as the list entry. Out of scope answers `not_found`.
- `adminUpdates.preview`: `POST /v1/admin/updates/preview`, the same body as `adminUpdates.post`, returns `{ recipients }`. Sends nothing.

### Changed, additive

- `InviteBody.replacesAssignmentId` (optional, city and venue invites): a handover. When the invite is accepted the new assignment is created and the old one revoked in one transaction.
- Resend an invite = a new `adminRoles.invite` for the same number, role and place. It replaces the pending invite with a new expiry and sends the message again. There is no separate resend call. Documented in the endpoint description.
- Settings: `reminderLeadMinutes { dora, circles }`, each 5 to 1440 minutes, default 60. The response schema uses a default, so older stored settings still parse. `SettingsUpdate` accepts a partial `reminderLeadMinutes`. `whatsappDailyCapPerPerson` stays 0 to 5.
- `me.delete` lists `last_national_admin`. No new error code: it was already one of the 24.
- `not_found` is allowed on `registrations.create`, `adminCircles.create`, `adminSessions.create`, `adminRoles.invite`, `adminRoles.assign`, `adminUpdates.post`, `adminUpdates.preview` and `follows.create`, for a body that points at nothing.
- `CircleUpdate.status` (`published` or `archived`) archives a circle.
- Types exported: `StaffRoleAssignment`, `AuditEntry`, `Attendance`. `ApiClientError.issues` (fifth constructor argument, optional) carries the `{ path, code }[]` of a `validation_failed` answer. `QueryBool` documents that the client sends the strings `'true'` and `'false'`.
- `@qc/contracts/bookmarks` (new subpath): `mapV1Bookmarks`, `AYAH_COUNTS`, `V1_BOOKMARKS_KEY`, `MAX_IMPORT_ITEMS`. `tools/migration` re-exports them.
- Endpoint registry entries can carry a `description`, which the OpenAPI document shows on the operation.
- Mock server, fixtures (`importExamples`, `adminSessions`, `sampleRegistrants`) and tests cover every new endpoint.

### Scopes

No new scope action. The new endpoints reuse existing actions, so no role gains any power and the `SCOPES.md` matrix is unchanged:

| Endpoint                    | Action                                                                                                           |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `adminImport.venues`        | `venue.create`                                                                                                   |
| `adminImport.coordinators`  | `role.assign_national_admin`, `role.assign_city_coordinator`, `role.assign_venue_coordinator` (per row, by role) |
| `adminImport.sessions`      | `session.create`                                                                                                 |
| `adminRegistrations.export` | `registration.export`                                                                                            |
| `adminSessions.get`         | `session.list_admin`                                                                                             |
| `adminCircles.get`          | `circle.list_admin`                                                                                              |
| `adminUpdates.preview`      | `update.post_national`, `update.post_city`, `update.post_venue` (by body scope)                                  |

### Not additive

- `CircleDecisionBody.note` is removed. The server never stored it (personal text must not reach the audit log). A body that still sends `note` is not refused: unknown keys are stripped.

### Database (migration 0008)

`auth_sessions.previous_refresh_token_hash` and `rotated_at`; `users.display_name` nullable; `otp_challenges.locale`; `message_outbox.venue_id` and `provider_message_id`; `legacy_whatsapp_subscribers` unique `(season_tag, phone_raw)`, E.164 check and `city_id`; and `coordinator_invites.replaces_assignment_id` (needed for handover; not in the original request, can be dropped if the owner prefers another way).

### Deferred

Push delivery acknowledgement (Wave 4), server-side template values, optional English in `LocalizedInput`.
