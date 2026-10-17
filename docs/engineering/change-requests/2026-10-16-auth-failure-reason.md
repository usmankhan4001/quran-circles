# Change request: expose why a request has no principal

Requested by: api-core
Contract: none (auth lane public surface, `apps/api/src/auth/index.ts`)
What I need: one exported function from the auth lane that returns the reason the current request has no signed-in person: `unauthenticated`, `token_expired` or `account_suspended`. For example `authFailureReason(c): 'unauthenticated' | 'token_expired' | 'account_suspended'`, reading what `authMiddleware` already worked out for that request.
Why: the apps depend on the difference. `token_expired` means "refresh and retry", `unauthenticated` means "sign in", `account_suspended` means "show the suspended screen". api-core's route binder rejects a signed-out call to a signed-in endpoint before the handler runs, and it has to answer with the right one of the three. The reason is recorded per request inside the auth lane, but only `requireAction` can say it.
Proposed change: export the reader next to `authMiddleware`. api-core would then pass it to `createApp` as `authFailure` and delete its probe.
Affected lanes: auth-scopes, api-core.
Workaround meanwhile: `apps/api/src/middleware/auth-lane.ts` builds `requireAction('me.read')`, runs it on the request, and reads the code off the refusal body. It works and is covered by `auth-wiring.test.ts` (expired token, forged token, suspended account), but it parses a response to learn a value, and it breaks if `requireAction` ever changes its body or its order of checks.

Applied in api 2026-10-17: `authFailureReason(c)` is exported from `apps/api/src/auth/index.ts` (with the `AuthFailure` type); `middleware/auth-lane.ts` passes it as `authFailure` and the `requireAction` probe is deleted. Covered by `modules/auth/sessions.test.ts` and `test/auth-wiring.test.ts`.
