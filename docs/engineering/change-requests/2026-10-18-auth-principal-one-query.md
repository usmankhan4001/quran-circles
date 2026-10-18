# Change request: load the principal in one statement

Status: **proposed**. Low priority: not needed for the Gate 5 limits (the four slow routes pass locally after the query changes), but it is the one repeated lookup left on every signed-in request.

Requested by: Gate 5 database performance investigation (orchestrator brief, 2026-10-18)
Contract: none (behaviour inside the auth-scopes lane: `apps/api/src/auth/middleware.ts`)
What I need: `resolve` reads the session and the user (`auth_sessions` joined to `users`), then the person's live role assignments, in two statements, two round trips and two plans on every authenticated request. One statement can return both: the session row with the assignments aggregated beside it, for example

```sql
select s.user_id, s.revoked_at, s.expires_at, u.status,
       coalesce((select json_agg(json_build_object('role', r.role, 'cityId', r.city_id, 'venueId', r.venue_id))
                   from role_assignments r
                  where r.user_id = s.user_id and r.revoked_at is null), '[]') as assignments
  from auth_sessions s join users u on u.id = s.user_id
 where s.id = $1
```

(or the drizzle equivalent with a scalar subquery), keeping every check exactly as it is: the same session, user, revoked, expiry and status checks, and assignments read fresh on every request.

Why: in the local Gate 5 runs (2 API processes, 100 virtual users, about 280 requests a second) every request that carries a token runs these two statements (the load scenario signs in every virtual user, so up to about 560 statements a second), each a planned query (planning was more than half of Postgres's time per statement on this stack). Folding them saves one round trip and one plan per signed-in request. The gain is smaller than the route fixes (they are single-row index lookups) and was not measured on its own.

Proposed change: as above; tests for every role as the lane's rules require (the existing `src/auth` and `auth-wiring` tests cover the checks).

Affected lanes: auth-scopes (owns the file).

Workaround meanwhile: none needed.
