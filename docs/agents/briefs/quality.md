# Brief: quality

Lane: quality
Work packages: WP12
Wave: 5
Priority: P0
Approval: human, for security findings and the sign-off

## Goal

Make sure the product is safe, fast and dependable before the pilot: a security review, scope-rule verification, an evening-spike load test, performance budgets on a low-end Android phone, an accessibility and right-to-left pass, and a repeated restore drill.

## You own

`tests/load/` and `docs/security/` (create both in Wave 5).

## You must not touch

Application code. Findings go to the owning lane as pull request requests or entries in their status file; fixes are made by that lane.

## Read first

`docs/engineering/gates.md` (Gate 5), `docs/engineering/conventions.md`, `docs/product/decisions.md`, `docs/product/messaging.md`, the frozen scope matrix.

## Deliverables

1. **Security review.** Review authentication, the scope engine, registration and export endpoints, the worker, the renderer and the infrastructure. Cover: authorisation bypass and scope leaks, injection, rate limits and lockouts, secrets in code and history, personal data in logs, account deletion, webhook signature checks, dependency vulnerabilities. Write `docs/security/review.md` with findings and severities.
2. **Scope verification.** Re-run the generated scope matrix against the deployed staging stack, not only unit tests.
3. **Load test.** Model a Ramadan evening: many people opening Nearby and registering at once while a push burst goes out. Report latency, errors and database load. Use k6 or similar. Tests run against staging only, with synthetic data.
4. **Low-end Android budgets.** Agree budgets for app start, list scroll and map load on the reference phone and measure them on every release candidate.
5. **Accessibility and right-to-left.** Run the ui lane's checklist across the real screens, at four text sizes, in dark and high contrast, in Urdu and English.
6. **Restore drill.** Repeat the backup restore on staging and time it.
7. **Fix tracking.** Keep `docs/security/findings.md` with each finding, owner and status. Gate 5 needs every finding closed.

## Definition of done

Matches Gate 5: security findings are closed; the load test passes; the budgets are met on the reference phone; right-to-left and text sizes are checked; the restore drill has been repeated. A human has signed it off.

## Commands that must pass

```sh
pnpm check
```

## Decisions to respect

Tests never target production. All data used is synthetic. The exposed V1 credentials are rotated at V2 launch (WP13), and the review must confirm V2 contains none of them.

## Stand-ins

No reference phone yet: run on an emulator with throttling and list the real-device checks for a human. No staging yet: run locally and mark the results provisional.
