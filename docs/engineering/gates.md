# Quality gates

A wave counts as done only when every line of its gate is true and a human signs the gate off. Checks run in CI wherever they can. Record the sign-off in `docs/agents/status/orchestrator.md`.

## Gate 0: after Wave 0, scaffold

- [x] The repository builds: `pnpm check` passes at the repository root.
- [x] CI runs typecheck, lint, tests and the format check.
- [x] Every lane has a written brief in `docs/agents/briefs/`.
- [ ] The VPS is reachable (human).
- [ ] Meta verification has been started (human).

## Gate 1: after Wave 1, contracts

- [ ] The schema migrates up and back cleanly.
- [ ] The API contract covers every P0 endpoint.
- [x] A human has reviewed the role-and-scope matrix.
- [ ] The mock server serves every endpoint.
- [ ] Error codes and message formats are agreed.

## Gate 2: after Wave 2, parallel build

- [ ] Every lane is merged with tests.
- [ ] The scope-rule tests pass for every role.
- [ ] The component kit is published and a human has reviewed it.
- [ ] A migration dry run reports counts per city.
- [ ] Backups run and a restore works on staging.

## Gate 3: after Wave 3, integration

- [ ] End-to-end flows pass in CI: find, register and remind; post an update, then feed and push; code login.
- [ ] The PWA installs and its shell works offline.
- [ ] A person has checked it on a real phone.

## Gate 4: after Wave 4, features

- [ ] Each feature is behind a flag, has scope tests and a reviewer-agent approval.
- [ ] Its Urdu text has been reviewed by a native speaker.

## Gate 5: after Wave 5, hardening

- [ ] Security findings are closed.
- [ ] The evening-spike load test passes.
- [ ] The budgets are met on the reference low-end Android phone.
- [ ] Right-to-left layout and all four text sizes are checked.
- [ ] The restore drill has been repeated.

## Gate 6: after Wave 6, pilot and release

- [ ] Pilot coordinators complete their daily tasks without help.
- [ ] Store forms are accepted.
- [ ] A rollback has been rehearsed.
- [ ] V1 data is migrated and checked.
