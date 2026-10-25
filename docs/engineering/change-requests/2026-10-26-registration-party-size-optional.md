# Change request: make `partySize` optional when joining

Requested by: user-app (member app redesign)
Contract: API (`RegistrationCreate`)
What I need: the join pledge no longer asks for a party size. `partySize` should be optional on `registrations.create` and default to 1 on the server.
Why: the approved member design has no party size ("Joining is a pledge, not a reservation"). The app has no field for it.
Proposed change: in `packages/contracts/src/schemas/people.ts`, `partySize: z.number().int().min(1).max(20).default(1)` (or `.optional()` with the server filling 1). The response `Registration.partySize` can stay.
Affected lanes: contracts, api-core, admin-app (headcounts keep working because every pledge counts as 1).
Workaround meanwhile: the app sends `partySize: 1`. Nothing is blocked.
