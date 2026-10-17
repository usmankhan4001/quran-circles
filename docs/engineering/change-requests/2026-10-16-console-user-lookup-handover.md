# Change request: hand a venue to someone who has not held a role yet

Requested by: console
Contract: endpoints (`adminRoles.*`), schemas (`InviteBody`)
What I need: either (a) `replacesAssignmentId` on `InviteBody`, so a handover can name a phone number instead of an existing user id, or (b) a scoped lookup `GET /v1/admin/users?phone=` that returns `{ id, displayName }` for an exact E.164 match.
Why: the handover uses `adminRoles.assign({ role, userId, venueId | cityId, replacesAssignmentId })`, which needs the new coordinator's `userId`. There is no way for a city coordinator to find a user id from a phone number, so the console only offers people who already hold an active role it can list. A new person has to be invited first, sign in, and only then can the venue be handed over. That is two steps for the most common handover.
Proposed change: option (a) is the smaller one. An invite with `replacesAssignmentId` stays pending; when the person accepts, the server creates the new assignment and ends the old one in the same transaction. Option (b) leaks whether a number has an account, so it must be limited to exact matches, rate limited and audited.
Affected lanes: contracts, auth-scopes, api-core, console.
Workaround meanwhile: the handover dialog lists current role holders (from `adminRoles.list`) and says, when nobody else is available, to invite the person first and come back after they sign in.

Applied 2026-10-17 in contract 1.0.0-rc.2 / migration 0008.

Applied in console 2026-10-17: the handover dialog offers "Someone who already has a role" (`adminRoles.assign` with `replacesAssignmentId`) or "A phone number" (`adminRoles.invite` with `replacesAssignmentId`; nothing changes until the invite is accepted).
