# Contract changelog

## 1.0.0-rc.3 (2026-10-17)

Closes the gaps the Wave 2 follow-up left between rc.2 and the API. Additive only: no endpoint, field, error code or scope action is removed or renamed, no new endpoint, no database change (migration 0008 already has `coordinator_invites.replaces_assignment_id`). The `SCOPES.md` matrix is unchanged.

### Changed, additive

- `Invite.replacesAssignmentId` (uuid or null): the assignment a handover invite replaces, on the `adminRoles.invite` response and on each item of `adminRoles.invites`. The API always sends it (null for a plain invite). It is optional in the TypeScript type only, so rc.2 payloads and hand-written test data still parse and typecheck.
- Resend of a handover: copy `replacesAssignmentId` from the listed invite into the new `InviteBody`. That works for a lapsed invite too. A resend of a still-pending handover invite keeps the link even when the body leaves it out, as long as the replaced assignment is still live (an ended one is dropped rather than carried). A `replacesAssignmentId` that is unknown, ended or at another place is `not_found`, as before. Documented on `adminRoles.invite`.
- `IMPORT_SERVER_ISSUE_CODES` gains `invalid_range`: a recurring session row whose `endsOn` is before its `startsOn` (same day is fine). It is the code `adminRegistrations.export` already uses for a backwards `from`/`to`. New type `ImportServerIssueCode`.
- `adminImport.venues`, `adminImport.coordinators`, `adminImport.sessions` list `conflict` (409): a file that clashes with a write made by someone else between the check and the write (a unique index trips) is refused as a whole and nothing is written. Sending it again is safe; the rows already there come back as `duplicate`.
- `adminRegistrations.export` lists `not_found`: a `cityId` or `venueId` that does not exist is `not_found` for a caller who holds `registration.export` anywhere, and `forbidden` for someone with no export right at all (the rule for unknown ids in a request, as for body references since rc.2; ADR 0011). A known city or venue outside the caller's scope stays `forbidden`.
- Mock: `adminRoles.invite` echoes the body (number, role, place, handover) instead of generated values; `adminRegistrations.export` answers `not_found` for ids the fixtures do not have and `forbidden` for a known venue or city outside the caller's scope.

### Changed on the server (no contract shape change)

- The import race used to answer 400 `validation_failed` with the request-level issue `{ path: 'rows', code: 'changed_during_import' }`, which no contract listed. It now answers 409 `conflict`. Why `conflict` instead of a new issue code: the file itself was valid, the code is not about any one row (so it does not belong in the per-row list), and `conflict` already means "this clashes with something that exists; refresh and try again", which is what the person should do. Clients that show `errors.conflict` need no change.
- The scoped export used to refuse an unknown `venueId` with 403, like a venue out of scope, and gave a national admin an empty file for an unknown `cityId`. Both are now `not_found` for staff.

## Between rc.2 and rc.3: mock server and fixtures only (2026-10-17)

No change to the endpoint registry, the schemas, the scope matrix or `openapi.json`; the contract stays at 1.0.0-rc.2. The mock now serves staff screens.

- Staff sign-in. `staffAccounts` in `@qc/contracts/fixtures` holds one account per role. Ask for a code to its synthetic number, then verify with `123456`:

  | Number          | Token        | Role                                                  |
  | --------------- | ------------ | ----------------------------------------------------- |
  | `+923000000201` | `mock-venue` | venue coordinator, Sample Masjid Al-Noor (Rawalpindi) |
  | `+923000000202` | `mock-city`  | city coordinator, Rawalpindi                          |
  | `+923000000203` | `mock-staff` | national admin                                        |

  `me.get` returns the matching `Me` with its role, and `auth.refresh` with the account's refresh token keeps the role. Any other number signs in as the attendee (`mock-user`, `fixtureMe`), as before.

- Staff tokens are checked with `can` and `scopeFilter`: a role the endpoint's actions do not allow gets `forbidden`; a known session, occurrence, venue or circle (or a body place on creates, update previews and posts, invites and assignments) outside the caller's scope gets `forbidden`, or `not_found` on `adminSessions.get` and `adminCircles.get`. Ids the fixtures do not have go on to the handler.
- Fixture-backed handlers instead of generated rows: `adminVenues.list`, `adminSessions.list`, `adminCircles.list` (scoped, with their filters), `adminSessions.occurrences` (from, to, limit), `adminAttendance.get` (fixture headcount, no entries, not marked) and `registrations.forSession` (`staffRegistrants`: six invented people per session, numbers in the fixture range). Unknown session or occurrence: `not_found`. `adminRegistrations.export` is scoped to the caller.
- Handlers passed to `createMockHandler` get `me` and `principal` on their context (`MockContext`).

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
