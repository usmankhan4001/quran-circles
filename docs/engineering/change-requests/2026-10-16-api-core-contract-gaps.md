# Change request: small contract gaps found while building the API

Requested by: api-core
Contract: API (`endpoints` error lists, `CircleUpdate`, `PostedUpdate`), schema (`circles`, `updates`)
What I need: five small changes. Each one has a working fallback today, listed below.

1. `me.delete` should list `last_national_admin` in `errors`. A national admin who is the only one left cannot delete their account (the same rule as revoking the last national admin). The contract does not list the code for this endpoint, so the API answers `validation_failed` with the issue `{ path: "confirm", code: "last_national_admin" }`.
2. A body that points at nothing (an unknown `venueId`, `cityId`, `sessionId` in `registrations.create`, `adminCircles.create`, `adminSessions.create`, `adminRoles.invite`, `adminRoles.assign`, `adminUpdates.post`, `follows.create`) has no honest code. `not_found` is not listed for endpoints without path parameters, so the API answers `validation_failed` with the issue `{ path: "<field>", code: "invalid_reference" }`, and `forbidden` to callers with no qualifying role. If `not_found` should be allowed on these, add it to `errorsFor` for body references.
3. Circles cannot be archived and a decision note has nowhere to go. `CircleUpdate` has no `status`, so no endpoint moves a circle to `archived` (the list hides archived circles by default and the status exists in the database). `CircleDecisionBody.note` is accepted, but no column holds it. Fallback: the note is dropped on purpose (personal text must not reach the audit log), the audit row records only `hasNote`, and nothing archives. Proposal: add `status: z.enum(['published','archived'])` to `CircleUpdate`, and either a nullable `decision_note` column on `circles` or remove `note` from the body.
4. `PostedUpdate.recipients` is a count that is only known when the update is sent. The API stores nothing, so `adminUpdates.list` shows the number of people the update reaches now, which drifts as people follow or register. Proposal: add `recipient_count integer` to `updates`, written when the update is posted, and read it back in the list.
5. `AttendanceView.markedAt` has no column. It is derived: the latest entry time, or the occurrence's `updated_at` when only a headcount was saved. Proposal: add `attendance_marked_at timestamptz` and `attendance_marked_by` to `occurrences`.

Why: each is a place where the code does something reasonable but not exactly what the contract says, and a client could be written against the wrong expectation.
Affected lanes: contracts (endpoints, db), api-core, console and admin app (circle archive and the decision note would surface there).
Workaround meanwhile: as described in each item. All five are covered by tests, so a change shows up as a test to update, not as a silent difference.

Partly applied 2026-10-17 in contract 1.0.0-rc.2 / migration 0008. Applied: item 1 (`me.delete` lists `last_national_admin`), item 2 (`not_found` allowed on body references), item 3 (`CircleUpdate.status`; `note` removed from `CircleDecisionBody` instead of adding a column). Not applied: item 4 (`updates.recipient_count`) and item 5 (`attendance_marked_at`); neither was in the approved digest.
