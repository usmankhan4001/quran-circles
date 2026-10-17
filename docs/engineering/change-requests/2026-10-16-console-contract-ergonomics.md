# Change request: small contract gaps the console works around

Requested by: console
Contract: `packages/contracts` exports
What I need:

1. Export types `StaffRoleAssignment` and `AuditEntry` (the schemas exist, the `z.infer` types are not exported). The console derives them from the client's return types in `apps/console/src/api/types.ts`.
2. Keep `issues` on `ApiClientError` for `validation_failed`. The mock and the real API send `issues: { path, code }[]`, but the client drops them, so a form cannot point at the field the server rejected. The console validates with the same Zod schemas first, so this only matters for server-only rules.
3. Say in the endpoint registry which `stringbool` query values the client accepts. The client types them as `'true' | 'false'` strings (`includeArchived`, `includeRevoked`); callers pass booleans by mistake until the compiler tells them.
4. An explicit "resend invite" call, or confirm that Resend means a new `adminRoles.invite` for the same number. The ui spec has a `console.invites.resend` key; the console does not show a Resend action until this is answered.
   Why: each one removes a local workaround or a guess.
   Affected lanes: contracts, console, admin app (same types).
   Workaround meanwhile: as described above.

Applied 2026-10-17 in contract 1.0.0-rc.2 / migration 0008. Item 1: types exported. Item 2: `ApiClientError.issues`. Item 3: documented on `QueryBool`. Item 4: answered, resend is a new `adminRoles.invite` for the same number (documented on the endpoint and in the changelog).

Applied in console 2026-10-17: item 1, `StaffRoleAssignment` and `AuditEntry` come from `@qc/contracts` (the local derived types and `src/api/types.ts` are gone; the console has no attendance screen, so `Attendance` has no local type to replace). Item 2, `ApiClientError.issues` marks the rejected field in the invite, handover, settings and export forms (`fieldIssues` in `src/lib/errors.ts`). Item 3, query flags are sent as `'true'` / `'false'`. Item 4, Resend on waiting and expired invites sends a new `adminRoles.invite` for the same number, role and place.
