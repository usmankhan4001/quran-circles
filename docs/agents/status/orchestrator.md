# Status: orchestrator

## Gate sign-offs

| Gate | Wave                      | Signed off by | Date       | Notes                                                                                                                                       |
| ---- | ------------------------- | ------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 0    | Wave 0, scaffold          | pending       |            | Scaffold, CI and briefs are written. VPS and Meta need you                                                                                  |
| 1    | Wave 1, contracts         | Muhammad      | 2026-10-16 | Scope matrix reviewed and approved; contracts, db, mock server and message formats built                                                    |
| 2    | Wave 2, parallel build    | pending       |            | All lanes built and pushed, `pnpm check` passes. Open: UI catalog review (paused for the UI redesign), backups and restore on staging, seed |
| 3    | Wave 3, integration       |               |            |                                                                                                                                             |
| 4    | Wave 4, features          |               |            |                                                                                                                                             |
| 5    | Wave 5, hardening         |               |            |                                                                                                                                             |
| 6    | Wave 6, pilot and release |               |            |                                                                                                                                             |

## Lanes

| Lane              | State                                        | Tests                  |
| ----------------- | -------------------------------------------- | ---------------------- |
| contracts         | done                                         | 1267                   |
| db                | done                                         | 126                    |
| ui                | built; under redesign, do not polish further | 546                    |
| auth-scopes       | done; decision 0002 accepted                 | 201                    |
| api-core          | done, 69 non-auth endpoints served           | 483 (shared with auth) |
| messaging, worker | done                                         | 281                    |
| data-migration    | done, dry run only; no real V1 run yet       | 311                    |
| content           | done                                         | 635                    |
| user-app          | done, web target only                        | 507                    |
| admin-app         | done, web target only                        | 435                    |
| console           | done                                         | 166                    |

Open change requests from the lanes are in `docs/engineering/change-requests/`. They need the orchestrator and a contract decision before Wave 3.

## Open worktrees

None. All work is on branch `claude/peaceful-archimedes-ain95k`.

## Decisions waiting on the orchestrator

- Name the legal owner of the WhatsApp Business account and start Meta verification.
- Share the VPS details and decide the domain name; the app ID follows from the domain.
- Name the native Urdu reviewer, the pilot city and the first coordinators.
- Decide how the work splits between the owner and the full developer.
- Choose a reference low-end Android phone.
- UI catalog review (Gate 2) is pending the UI and screens redesign the user has started.
- Schedule the next features decided with the owner (`docs/product/features-next.md`) and decide their change request (`docs/engineering/change-requests/2026-10-17-next-features.md`).
- Decide the open change requests (auth session grace, users display name, OTP locale, outbox venue/provider id, bulk import, export scope, handover lookup, contract gaps in api-core).
- Meta template approval, native Urdu review, Google Maps key, VAPID keys, store accounts.
- Live prayer-time comparison: run `node packages/content/scripts/compare-aladhan.mjs` with internet access.
